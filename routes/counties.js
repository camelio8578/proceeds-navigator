// Owns: HTTP handlers for /api/counties — county reference data retrieval.
// Does NOT own: SQL queries (db/counties.js), UI pages (public/counties.html), seeding logic.

const express = require('express');
const router = express.Router();
const db = require('../db/counties');

// GET /api/counties — returns all county reference records
router.get('/', async (req, res) => {
  try {
    const counties = await db.listCounties();
    res.json(counties);
  } catch (err) {
    console.error('GET /api/counties error:', err.message);
    res.status(500).json({ error: 'Failed to fetch county data' });
  }
});

module.exports = router;