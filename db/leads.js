// Owns: all SQL queries for the leads table and case_notes table.
// Does NOT own: HTTP request/response handling, CSV parsing, scoring logic.

const pool = require('./index');

async function listLeads({ status, date_from, date_to, sort, order, search }) {
  let query = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  let idx = 1;

  if (status && status !== 'all') {
    query += ` AND status = $${idx++}`;
    params.push(status);
  }
  if (date_from) {
    query += ` AND sale_date >= $${idx++}`;
    params.push(date_from);
  }
  if (date_to) {
    query += ` AND sale_date <= $${idx++}`;
    params.push(date_to);
  }
  if (search) {
    query += ` AND (claimant_name ILIKE $${idx} OR apn ILIKE $${idx} OR property_address ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  const sortCol = ['score', 'excess_amount', 'sale_date', 'status', 'created_at'].includes(sort) ? sort : 'score';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${sortCol} ${sortOrder}`;

  const result = await pool.query(query, params);
  return result.rows;
}

async function getLeadById(id) {
  const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getAnalytics() {
  const result = await pool.query(`
    SELECT
      COALESCE(SUM(excess_amount) FILTER (WHERE status IN ('new','contacted','engaged','filed')), 0)::numeric AS pipeline_value,
      COUNT(*) FILTER (WHERE score >= 70 AND status IN ('new','contacted','engaged','filed'))::int AS tier_high,
      COUNT(*) FILTER (WHERE score >= 40 AND score < 70 AND status IN ('new','contacted','engaged','filed'))::int AS tier_mid,
      COUNT(*) FILTER (WHERE score < 40 AND status IN ('new','contacted','engaged','filed'))::int AS tier_low,
      COUNT(*) FILTER (WHERE status = 'new')::int AS status_new,
      COUNT(*) FILTER (WHERE status = 'contacted')::int AS status_contacted,
      COUNT(*) FILTER (WHERE status = 'engaged')::int AS status_engaged,
      COUNT(*) FILTER (WHERE status = 'filed')::int AS status_filed,
      COUNT(*) FILTER (WHERE status = 'recovered')::int AS status_recovered,
      COALESCE(AVG(score) FILTER (WHERE status IN ('new','contacted','engaged','filed')), 0)::int AS avg_score,
      COUNT(*) FILTER (
        WHERE status IN ('new','contacted','engaged','filed')
        AND deadline IS NOT NULL
        AND deadline >= CURRENT_DATE
        AND deadline <= CURRENT_DATE + INTERVAL '30 days'
      )::int AS deadline_30,
      COUNT(*) FILTER (
        WHERE status IN ('new','contacted','engaged','filed')
        AND deadline IS NOT NULL
        AND deadline >= CURRENT_DATE
        AND deadline <= CURRENT_DATE + INTERVAL '60 days'
      )::int AS deadline_60,
      COUNT(*) FILTER (
        WHERE status IN ('new','contacted','engaged','filed')
        AND deadline IS NOT NULL
        AND deadline >= CURRENT_DATE
        AND deadline <= CURRENT_DATE + INTERVAL '90 days'
      )::int AS deadline_90,
      COUNT(*) FILTER (WHERE status IN ('new','contacted','engaged','filed'))::int AS active_total
    FROM leads
  `);
  return result.rows[0];
}

async function getStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
      COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted_count,
      COUNT(*) FILTER (WHERE status = 'engaged')::int AS engaged_count,
      COUNT(*) FILTER (WHERE status = 'filed')::int AS filed_count,
      COUNT(*) FILTER (WHERE status = 'recovered')::int AS recovered_count,
      COUNT(*) FILTER (WHERE status = 'dead')::int AS dead_count,
      COALESCE(SUM(excess_amount), 0)::numeric AS total_value,
      COALESCE(SUM(excess_amount) FILTER (WHERE status IN ('new','contacted','engaged','filed')), 0)::numeric AS active_value,
      COALESCE(AVG(score) FILTER (WHERE status IN ('new','contacted','engaged','filed')), 0)::int AS avg_score
    FROM leads
  `);
  return result.rows[0];
}

async function createLead({ county, apn, sale_date, excess_amount, claimant_name, property_address, score, status, deadline, notes, email, phone, mailing_address, contact_source }) {
  const result = await pool.query(
    `INSERT INTO leads (county, apn, sale_date, excess_amount, claimant_name, property_address, score, status, deadline, notes, email, phone, mailing_address, contact_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [county || 'San Diego', apn, sale_date, excess_amount, claimant_name, property_address, score || 0, status || 'new', deadline, notes, email || null, phone || null, mailing_address || null, contact_source || null]
  );
  return result.rows[0];
}

async function updateLead(id, { county, apn, sale_date, excess_amount, claimant_name, property_address, score, status, deadline, notes, email, phone, mailing_address, contact_source }) {
  const result = await pool.query(
    `UPDATE leads SET county=$1, apn=$2, sale_date=$3, excess_amount=$4, claimant_name=$5,
     property_address=$6, score=$7, status=$8, deadline=$9, notes=$10, updated_at=NOW(),
     email=$11, phone=$12, mailing_address=$13, contact_source=$14
     WHERE id=$15 RETURNING *`,
    [county, apn, sale_date, excess_amount, claimant_name, property_address, score, status, deadline, notes, email || null, phone || null, mailing_address || null, contact_source || null, id]
  );
  return result.rows[0] || null;
}

async function transitionLead(id, newStatus) {
  const current = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
  if (!current.rows[0]) return null;
  const oldStatus = current.rows[0].status;

  const updated = await pool.query(
    'UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, id]
  );

  await pool.query(
    `INSERT INTO case_notes (lead_id, note, note_type) VALUES ($1, $2, 'status_change')`,
    [id, `Status changed from "${oldStatus}" to "${newStatus}"`]
  );

  return updated.rows[0];
}

async function stampClaimLetter(id) {
  const result = await pool.query(
    'UPDATE leads SET claim_letter_generated_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

async function getNotesByLeadId(leadId) {
  const result = await pool.query(
    'SELECT * FROM case_notes WHERE lead_id = $1 ORDER BY created_at DESC',
    [leadId]
  );
  return result.rows;
}

async function addNote(leadId, { note, note_type }) {
  const result = await pool.query(
    'INSERT INTO case_notes (lead_id, note, note_type) VALUES ($1, $2, $3) RETURNING *',
    [leadId, note.trim(), note_type || 'note']
  );
  return result.rows[0];
}

async function listAllForDedup() {
  const result = await pool.query('SELECT county, apn, sale_date FROM leads');
  return result.rows;
}

async function bulkInsertLead({ county, apn, saleDate, excessAmount, claimantName, propertyAddress, score, deadline, notes, email, phone, mailingAddress, contactSource }) {
  await pool.query(
    `INSERT INTO leads (county, apn, sale_date, excess_amount, claimant_name, property_address, score, status, deadline, notes, email, phone, mailing_address, contact_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9, $10, $11, $12, $13)`,
    [county, apn, saleDate, excessAmount, claimantName, propertyAddress, score, deadline, notes, email, phone, mailingAddress, contactSource]
  );
}

module.exports = {
  listLeads,
  getLeadById,
  getAnalytics,
  getStats,
  createLead,
  updateLead,
  transitionLead,
  stampClaimLetter,
  getNotesByLeadId,
  addNote,
  listAllForDedup,
  bulkInsertLead,
};
