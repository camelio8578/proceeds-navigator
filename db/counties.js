// Owns: all SQL queries for the counties table.
// Does NOT own: HTTP handling, UI, or seeding logic.

const pool = require('./index');

async function listCounties() {
  const result = await pool.query(
    'SELECT id, name, treasurer_contact, claim_requirements, filing_fees, processing_timeline, website_url FROM counties ORDER BY name ASC'
  );
  return result.rows;
}

async function getCountyByName(name) {
  const result = await pool.query(
    'SELECT * FROM counties WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  return result.rows[0] || null;
}

async function upsertCounty({ name, treasurer_contact, claim_requirements, filing_fees, processing_timeline, website_url }) {
  const result = await pool.query(
    `INSERT INTO counties (name, treasurer_contact, claim_requirements, filing_fees, processing_timeline, website_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (name) DO UPDATE SET
       treasurer_contact = EXCLUDED.treasurer_contact,
       claim_requirements = EXCLUDED.claim_requirements,
       filing_fees = EXCLUDED.filing_fees,
       processing_timeline = EXCLUDED.processing_timeline,
       website_url = EXCLUDED.website_url
     RETURNING *`,
    [name, JSON.stringify(treasurer_contact), claim_requirements, filing_fees, processing_timeline, website_url]
  );
  return result.rows[0];
}

module.exports = { listCounties, getCountyByName, upsertCounty };