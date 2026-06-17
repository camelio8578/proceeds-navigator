/**
 * Verify CSV Import feature end-to-end
 * Run: node verify-csv-import.js
 */
const http = require('http');
const fs = require('fs');

const BASE = process.env.APP_URL || 'http://localhost:3000';

function request(method, path, body, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {},
    };
    if (contentType) options.headers['Content-Type'] = contentType;

    const req = (url.protocol === 'https:' ? require('https') : http).request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function multipartUpload(path, filename, csvContent) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const boundary = '----FormBoundary' + Date.now();
    const body = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      csvContent + `\r\n` +
      `--${boundary}--\r\n`
    );

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = (url.protocol === 'https:' ? require('https') : http).request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function verify() {
  console.log('=== CSV Import Verification ===\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Import endpoint exists
  console.log('1. Testing import endpoint exists...');
  try {
    const res = await multipartUpload('/api/leads/import', 'test.csv',
      'county,parcel_apn,property_address,sale_date,excess_amount,claimant_name,claimant_type,source_url\n' +
      'San Diego,999-TEST-001,123 Verify St,2025-06-15,25000.00,Test Claimant,individual,https://example.com\n'
    );
    if (res.status === 200 && res.body.imported >= 0) {
      console.log('   PASS - Import endpoint responds correctly');
      console.log('   Result:', JSON.stringify(res.body));
      passed++;
    } else {
      console.log('   FAIL - Unexpected response:', res.status, JSON.stringify(res.body));
      failed++;
    }
  } catch (e) {
    console.log('   FAIL - Error:', e.message);
    failed++;
  }

  // Test 2: Duplicate detection
  console.log('\n2. Testing duplicate detection...');
  try {
    const res = await multipartUpload('/api/leads/import', 'test-dup.csv',
      'county,parcel_apn,sale_date,excess_amount,claimant_name\n' +
      'San Diego,999-TEST-001,2025-06-15,25000.00,Test Claimant\n'
    );
    if (res.status === 200 && res.body.duplicates >= 1) {
      console.log('   PASS - Duplicate correctly detected');
      console.log('   Result:', JSON.stringify(res.body));
      passed++;
    } else {
      console.log('   FAIL - Duplicate not detected:', JSON.stringify(res.body));
      failed++;
    }
  } catch (e) {
    console.log('   FAIL - Error:', e.message);
    failed++;
  }

  // Test 3: Validation (missing excess_amount)
  console.log('\n3. Testing validation (missing excess_amount)...');
  try {
    const res = await multipartUpload('/api/leads/import', 'test-bad.csv',
      'county,parcel_apn,sale_date,excess_amount,claimant_name\n' +
      'San Diego,999-TEST-002,2025-06-15,,Bad Lead\n'
    );
    if (res.status === 200 && res.body.errors >= 1) {
      console.log('   PASS - Validation caught missing excess_amount');
      console.log('   Result:', JSON.stringify(res.body));
      passed++;
    } else {
      console.log('   FAIL - Validation missed:', JSON.stringify(res.body));
      failed++;
    }
  } catch (e) {
    console.log('   FAIL - Error:', e.message);
    failed++;
  }

  // Test 4: Dashboard page includes import button
  console.log('\n4. Testing dashboard has Import CSV button...');
  try {
    const res = await request('GET', '/dashboard');
    const html = typeof res.body === 'string' ? res.body : '';
    if (html.includes('Import CSV') && html.includes('import-csv-modal')) {
      console.log('   PASS - Dashboard contains import UI');
      passed++;
    } else {
      console.log('   FAIL - Import UI not found in dashboard HTML');
      failed++;
    }
  } catch (e) {
    console.log('   FAIL - Error:', e.message);
    failed++;
  }

  // Cleanup: delete test lead
  try {
    const leads = await request('GET', '/api/leads?search=999-TEST-001');
    if (leads.body && Array.isArray(leads.body)) {
      for (const lead of leads.body) {
        await request('DELETE', `/api/leads/${lead.id}`);
      }
    }
  } catch (e) { /* cleanup best-effort */ }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

verify().catch(e => { console.error('Verification failed:', e); process.exit(1); });
