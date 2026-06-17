// Owns: all SQL queries for the letters table.
// Does NOT own: HTTP handling (routes/leads.js), HTML generation (services/letter.js).

const pool = require('./index');

async function createLetter(leadId, html) {
  const result = await pool.query(
    `INSERT INTO letters (lead_id, letter_html, status) VALUES ($1, $2, 'draft') RETURNING id, lead_id, generated_at, status`,
    [leadId, html]
  );
  return result.rows[0];
}

async function getLatestLetterByLeadId(leadId) {
  const result = await pool.query(
    `SELECT id, lead_id, generated_at, status FROM letters WHERE lead_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [leadId]
  );
  return result.rows[0] || null;
}

async function getLetterHtml(letterId) {
  const result = await pool.query(
    `SELECT letter_html FROM letters WHERE id = $1`,
    [letterId]
  );
  return result.rows[0] ? result.rows[0].letter_html : null;
}

async function getLettersByLeadId(leadId) {
  const result = await pool.query(
    `SELECT id, lead_id, generated_at, status FROM letters WHERE lead_id = $1 ORDER BY generated_at DESC`,
    [leadId]
  );
  return result.rows;
}

async function updateLetterStatus(letterId, status) {
  const valid = ['draft', 'sent', 'returned'];
  if (!valid.includes(status)) throw new Error(`Invalid letter status: ${status}`);
  const result = await pool.query(
    `UPDATE letters SET status = $1 WHERE id = $2 RETURNING id, lead_id, generated_at, status`,
    [status, letterId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createLetter,
  getLatestLetterByLeadId,
  getLetterHtml,
  getLettersByLeadId,
  updateLetterStatus,
};
