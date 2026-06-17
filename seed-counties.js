// One-shot seed script for county reference data.
// Run once: node seed-counties.js
// Safe to re-run — uses ON CONFLICT upsert.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./db/index');
const { upsertCounty } = require('./db/counties');

const counties = [
  {
    name: 'San Diego',
    treasurer_contact: {
      name: 'Hon. Dan McAllister',
      title: 'San Diego County Treasurer-Tax Collector',
      address: '1600 Pacific Highway, Suite 162',
      city: 'San Diego, CA 92101',
      phone: '(619) 531-1300',
      fax: '(619) 531-1347',
      email: 'ttcwebmail@sdcottreasurer.com',
    },
    claim_requirements: 'File Claim Application (online or in-person). Provide proof of ownership interest in surplus funds (deed, assignment, court order). Valid government-issued photo ID required. If claiming on behalf of another party, provide notarized authorization. Surplus must be claimed within one year of sale date.',
    filing_fees: 'No filing fee for initial claim.',
    processing_timeline: '6–12 months. Claim reviewed by Tax Collector, then submitted to California Controller for escheatment review. Claimant notified by mail of determination.',
    website_url: 'https://www.sdtreasurer.com',
  },
  {
    name: 'Los Angeles',
    treasurer_contact: {
      name: 'Hon. Keith Knox',
      title: 'Los Angeles County Treasurer and Tax Collector',
      address: '225 N. Hill Street, Room 121',
      city: 'Los Angeles, CA 90012',
      phone: '(213) 974-2101',
      fax: '(213) 617-7169',
      email: 'ttc@lacounty.gov',
    },
    claim_requirements: 'File Claim for Excess Proceeds form (available on TTC website). Attach certified copy of deed or other document establishing ownership interest. Include copy of tax sale certificate. Provide government-issued photo ID. If entity, include resolution or authorization. Claim must be filed within one year of the tax sale.',
    filing_fees: 'No filing fee for initial claim.',
    processing_timeline: '6–12 months. Claims reviewed by Tax Collector, then forwarded to California Controller if unclaimed. Claimant notified in writing.',
    website_url: 'https://ttc.lacounty.gov',
  },
  {
    name: 'Sacramento',
    treasurer_contact: {
      name: 'Hon. Jennifer V. Ross',
      title: 'Sacramento County Treasurer-Tax Collector',
      address: '700 H Street, Suite 1710',
      city: 'Sacramento, CA 95814',
      phone: '(916) 874-7474',
      fax: '(916) 874-7789',
      email: 'treastax@saccounty.net',
    },
    claim_requirements: 'File Claim for Excess Proceeds (form TTC-40 or equivalent). Attach proof of ownership interest (deed, assignment, court order, or recorded instrument). Provide government-issued photo ID. If business entity, include authorization resolution. Claimant must demonstrate valid ownership or legal right to the excess funds.',
    filing_fees: 'No filing fee for initial claim.',
    processing_timeline: '3–6 months. Sacramento County typically processes faster than larger counties. Claims reviewed by Tax Collector staff; written determination issued within 60 days of complete submission.',
    website_url: 'https://www.sacottreasurer.com',
  },
  {
    name: 'Fresno',
    treasurer_contact: {
      name: 'Hon. Vikram S. Grewal',
      title: 'Fresno County Treasurer-Tax Collector',
      address: '2400 Ventura Street',
      city: 'Fresno, CA 93721',
      phone: '(559) 600-3486',
      fax: '(559) 455-2436',
      email: 'ttctax@fresnocountyca.gov',
    },
    claim_requirements: 'File Claim Application for Excess Proceeds. Provide certified copy of deed or document establishing claimant ownership interest in the property. Include copy of tax certificate or official sale record. Valid government-issued photo ID required. Written notarized authorization if agent is filing on behalf of claimant. Claims must be submitted within one year of sale date.',
    filing_fees: 'No filing fee for initial claim.',
    processing_timeline: '4–8 months. Claims reviewed by Fresno County Tax Collector, then forwarded to State Controller if unclaimed after county review. Written notification of determination provided.',
    website_url: 'https://www.fresnocountyca.gov/government/government-updates/treasurer-tax-collector',
  },
];

async function seed() {
  console.log('Seeding county reference data...');
  for (const county of counties) {
    try {
      const result = await upsertCounty(county);
      console.log(`  ✓ ${result.name}`);
    } catch (err) {
      console.error(`  ✗ ${county.name}: ${err.message}`);
    }
  }
  console.log('Done.');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  pool.end();
  process.exit(1);
});