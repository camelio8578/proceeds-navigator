// Owns: CSV parsing and lead auto-scoring logic.
// Does NOT own: database writes, HTTP request handling.

function parseCSV(text) {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  function splitLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current); current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }

  const lines = [];
  let buf = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQ = !inQ;
    if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQ) {
      if (ch === '\r') i++;
      if (buf.trim()) lines.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) lines.push(buf);

  if (lines.length < 2) return [];

  const headers = splitLine(lines[0]).map(h =>
    h.trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
    return obj;
  });
}

function autoScoreLead(row) {
  let score = 25;

  const amount = parseFloat(row.excess_amount) || 0;
  if (amount >= 50000) score += 35;
  else if (amount >= 25000) score += 25;
  else if (amount >= 10000) score += 15;
  else if (amount >= 5000) score += 8;

  const name = (row.claimant_name || '').trim().toLowerCase();
  if (name && name !== 'unknown' && name !== 'n/a' && name !== 'none') score += 15;

  const ctype = (row.claimant_type || '').trim().toLowerCase();
  if (['individual', 'owner', 'former owner', 'property owner'].includes(ctype)) score += 10;

  if (row.sale_date) {
    const saleDate = new Date(row.sale_date);
    if (!isNaN(saleDate.getTime())) {
      const deadline = new Date(saleDate);
      deadline.setFullYear(deadline.getFullYear() + 1);
      const daysLeft = (deadline - new Date()) / (1000 * 60 * 60 * 24);
      if (daysLeft < 0) score -= 10;
      else if (daysLeft <= 90) score += 15;
      else if (daysLeft <= 180) score += 10;
      else score += 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}

module.exports = { parseCSV, autoScoreLead };
