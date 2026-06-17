// Owns: HTTP handlers for /api/leads — CRUD, analytics, CSV import, claim letters.
// Does NOT own: SQL queries (db/leads.js, db/letters.js), CSV parsing/scoring (services/csv.js), letter HTML (services/letter.js).

const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/leads');
const lettersDb = require('../db/letters');
const { parseCSV, autoScoreLead } = require('../services/csv');
const { buildClaimLetterHtml } = require('../services/letter');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/leads/demo-request — capture demo request email from marketing page
router.post('/demo-request', async (req, res) => {
  try {
    const { email, source } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    // Log for now; future migration will store to a demo_requests table
    console.log(`[demo-request] email=${email} source=${source || 'unknown'}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/leads/demo-request error:', err.message);
    res.status(500).json({ error: 'Failed to record request' });
  }
});

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const rows = await db.listLeads(req.query);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/leads error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/analytics
router.get('/analytics', async (req, res) => {
  try {
    const data = await db.getAnalytics();
    res.json(data);
  } catch (err) {
    console.error('GET /api/leads/analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/leads/stats
router.get('/stats', async (req, res) => {
  try {
    const data = await db.getStats();
    res.json(data);
  } catch (err) {
    console.error('GET /api/leads/stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/leads/import
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const text = req.file.buffer.toString('utf8');
    const rows = parseCSV(text);
    if (!rows.length) return res.status(400).json({ error: 'No data rows found in CSV' });

    const existing = await db.listAllForDedup();
    const existingSet = new Set(
      existing.map(r => {
        const c = (r.county || '').toLowerCase();
        const a = (r.apn || '').toLowerCase();
        const d = r.sale_date ? new Date(r.sale_date).toISOString().split('T')[0] : '';
        return `${c}|${a}|${d}`;
      })
    );

    let imported = 0;
    let duplicates = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const county = (row.county || 'San Diego').trim();
      const apn = (row.parcel_apn || row.apn || '').trim();
      const saleDate = (row.sale_date || '').trim() || null;
      const excessAmount = parseFloat(row.excess_amount);
      const claimantName = (row.claimant_name || '').trim() || null;
      const propertyAddress = (row.property_address || '').trim() || null;

      if (!county) { errors.push({ row: i + 2, reason: 'Missing county' }); continue; }
      if (isNaN(excessAmount)) { errors.push({ row: i + 2, reason: 'Missing or invalid excess_amount' }); continue; }

      const dedupKey = `${county.toLowerCase()}|${apn.toLowerCase()}|${saleDate || ''}`;
      if (existingSet.has(dedupKey)) { duplicates++; continue; }

      const score = autoScoreLead(row);

      let deadline = null;
      if (saleDate) {
        const d = new Date(saleDate);
        if (!isNaN(d.getTime())) {
          d.setFullYear(d.getFullYear() + 1);
          deadline = d.toISOString().split('T')[0];
        }
      }

      const email = (row.email || '').trim() || null;
      const phone = (row.phone || '').trim() || null;
      const mailingAddress = (row.mailing_address || '').trim() || null;
      const contactSource = (row.contact_source || '').trim() || null;
      const sourceUrl = (row.source_url || '').trim() || null;

      let notes = '';
      if (row.claimant_type) notes += `Claimant type: ${row.claimant_type}. `;
      if (sourceUrl) notes += `Source: ${sourceUrl}`;
      notes = notes.trim() || null;

      await db.bulkInsertLead({ county, apn, saleDate, excessAmount, claimantName, propertyAddress, score, deadline, notes, email, phone, mailingAddress, contactSource });
      existingSet.add(dedupKey);
      imported++;
    }

    res.json({ imported, duplicates, errors: errors.length, error_details: errors.slice(0, 50), total_rows: rows.length });
  } catch (err) {
    console.error('POST /api/leads/import error:', err.message);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const lead = await db.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    console.error('GET /api/leads/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads
router.post('/', async (req, res) => {
  try {
    const lead = await db.createLead(req.body);
    res.status(201).json(lead);
  } catch (err) {
    console.error('POST /api/leads error:', err.message);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req, res) => {
  try {
    const lead = await db.updateLead(req.params.id, req.body);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    console.error('PUT /api/leads/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// POST /api/leads/:id/transition
router.post('/:id/transition', async (req, res) => {
  try {
    const { status: newStatus } = req.body;
    const valid = ['new', 'contacted', 'engaged', 'filed', 'recovered', 'dead'];
    if (!valid.includes(newStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
    }
    const lead = await db.transitionLead(req.params.id, newStatus);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    console.error('POST /api/leads/:id/transition error:', err.message);
    res.status(500).json({ error: 'Failed to transition lead' });
  }
});

// GET /api/leads/:id/notes
router.get('/:id/notes', async (req, res) => {
  try {
    const notes = await db.getNotesByLeadId(req.params.id);
    res.json(notes);
  } catch (err) {
    console.error('GET /api/leads/:id/notes error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/leads/:id/notes
router.post('/:id/notes', async (req, res) => {
  try {
    const { note, note_type } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ error: 'Note text is required' });
    const added = await db.addNote(req.params.id, { note, note_type });
    res.status(201).json(added);
  } catch (err) {
    console.error('POST /api/leads/:id/notes error:', err.message);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// POST /api/leads/:id/claim-letter — legacy endpoint, kept for backward compat
router.post('/:id/claim-letter', async (req, res) => {
  try {
    const lead = await db.stampClaimLetter(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const html = buildClaimLetterHtml(lead);
    res.type('html').send(html);
  } catch (err) {
    console.error('POST /api/leads/:id/claim-letter error:', err.message);
    res.status(500).json({ error: 'Failed to generate claim letter' });
  }
});

// POST /api/leads/:id/generate-letter — generates, persists, and returns letter HTML
router.post('/:id/generate-letter', async (req, res) => {
  try {
    const lead = await db.stampClaimLetter(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const html = buildClaimLetterHtml(lead);
    const letter = await lettersDb.createLetter(lead.id, html);
    // Return metadata + HTML so client can open preview without a second fetch
    res.json({ letter_id: letter.id, generated_at: letter.generated_at, status: letter.status, html });
  } catch (err) {
    console.error('POST /api/leads/:id/generate-letter error:', err.message);
    res.status(500).json({ error: 'Failed to generate letter' });
  }
});

// GET /api/leads/:id/letter-preview — serves latest letter HTML for in-browser preview
router.get('/:id/letter-preview', async (req, res) => {
  try {
    const letter = await lettersDb.getLatestLetterByLeadId(req.params.id);
    if (!letter) return res.status(404).json({ error: 'No letter generated yet for this lead' });
    const html = await lettersDb.getLetterHtml(letter.id);
    if (!html) return res.status(404).json({ error: 'Letter HTML not found' });
    res.type('html').send(html);
  } catch (err) {
    console.error('GET /api/leads/:id/letter-preview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch letter preview' });
  }
});

// GET /api/leads/:id/letters — list all letters for a lead (id, generated_at, status)
router.get('/:id/letters', async (req, res) => {
  try {
    const letters = await lettersDb.getLettersByLeadId(req.params.id);
    res.json(letters);
  } catch (err) {
    console.error('GET /api/leads/:id/letters error:', err.message);
    res.status(500).json({ error: 'Failed to fetch letters' });
  }
});

// PATCH /api/leads/:id/letters/:letterId/status — update letter status (draft/sent/returned)
router.patch('/:id/letters/:letterId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const letter = await lettersDb.updateLetterStatus(req.params.letterId, status);
    if (!letter) return res.status(404).json({ error: 'Letter not found' });
    res.json(letter);
  } catch (err) {
    console.error('PATCH /api/leads/:id/letters/:letterId/status error:', err.message);
    res.status(err.message.startsWith('Invalid') ? 400 : 500).json({ error: err.message });
  }
});

module.exports = router;
