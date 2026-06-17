// Owns: HTML generation for §4675 claim letters.
// Does NOT own: database stamping (db/leads.js, db/letters.js), HTTP handling (routes/leads.js).

const COMPANY_CONTACT_EMAIL = 'proceeds-navigator@polsia.app';

function buildClaimLetterHtml(l) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
  const fmtMoney = v => v ? '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';

  const countyFull = `${l.county} County`;
  const claimantName = l.claimant_name || '[CLAIMANT NAME]';

  // Deadline: 1 year from sale date if not stored
  let deadlineDisplay = fmtDate(l.deadline);
  if (!l.deadline && l.sale_date) {
    const d = new Date(l.sale_date);
    d.setFullYear(d.getFullYear() + 1);
    deadlineDisplay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claim Letter — ${claimantName} — APN ${l.apn}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #111; background: #fff; }
    .page { max-width: 720px; margin: 0 auto; padding: 1.25in 1in 1in 1in; }
    .letterhead { text-align: center; border-bottom: 2px solid #111; padding-bottom: 0.75rem; margin-bottom: 1.5rem; }
    .letterhead h1 { font-size: 18pt; font-weight: bold; letter-spacing: 0.04em; margin-bottom: 0.2rem; }
    .letterhead p { font-size: 10pt; color: #333; }
    .date-block { text-align: right; margin-bottom: 1.5rem; }
    .recipient { margin-bottom: 1.5rem; }
    .recipient p { line-height: 1.4; }
    .subject-line { font-weight: bold; margin-bottom: 1.25rem; border-bottom: 1px solid #ccc; padding-bottom: 0.4rem; }
    p { margin-bottom: 1rem; }
    .claim-box { border: 1px solid #222; padding: 1rem 1.25rem; margin: 1.25rem 0; background: #f9f9f9; }
    .claim-box table { width: 100%; border-collapse: collapse; }
    .claim-box td { padding: 0.3rem 0; vertical-align: top; }
    .claim-box td:first-child { font-weight: bold; width: 45%; }
    .response-box { border: 1px solid #555; padding: 0.75rem 1rem; margin: 1rem 0; background: #f5f5f5; font-size: 10.5pt; }
    .response-box p { margin-bottom: 0.4rem; }
    .signature-block { margin-top: 2rem; }
    .disclaimer { margin-top: 2rem; padding: 0.75rem 1rem; border: 2px solid #c00; font-size: 9pt; color: #333; line-height: 1.5; }
    .disclaimer strong { color: #c00; }
    .print-controls { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
    .print-controls button { padding: 8px 16px; font-size: 13px; font-family: Arial, sans-serif; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; }
    .btn-print { background: #222; color: #fff; }
    .btn-close { background: #e5e5e5; color: #333; }
    .btn-print:hover { background: #444; }
    .btn-close:hover { background: #ccc; }
    @media print { .print-controls { display: none; } body { font-size: 11pt; } .page { padding: 0.5in 0.75in; } }
  </style>
</head>
<body>
  <div class="print-controls">
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
    <button class="btn-close" onclick="window.close()">&#x2715; Close</button>
  </div>
  <div class="page">
    <div class="letterhead">
      <h1>Excess Proceeds Claim Notice</h1>
      <p>Prepared pursuant to California Revenue &amp; Taxation Code §4675</p>
      <p style="margin-top:0.3rem;">Contact: ${COMPANY_CONTACT_EMAIL}</p>
    </div>
    <div class="date-block"><p>${today}</p></div>
    <div class="recipient">
      <p><strong>To:</strong></p>
      <p>${countyFull} Treasurer-Tax Collector</p>
      <p>Tax Sale Excess Proceeds Division</p>
      <p>${countyFull}, California</p>
    </div>
    <div class="subject-line">
      RE: Claim for Excess Proceeds — APN: ${l.apn}${l.property_address ? ' — ' + l.property_address : ''}
    </div>
    <p>Dear ${countyFull} Treasurer-Tax Collector,</p>
    <p>This letter serves as formal notice of intent to file a claim for excess proceeds arising from the tax-defaulted property sale described below, pursuant to <strong>California Revenue &amp; Taxation Code §4675</strong>. The claimant identified herein, or their authorized representative, asserts an interest in the surplus funds held by ${countyFull} following the conclusion of the applicable tax sale.</p>
    <div class="claim-box">
      <table>
        <tr><td>Claimant Name:</td><td>${claimantName}</td></tr>
        <tr><td>Assessor's Parcel Number (APN):</td><td>${l.apn}</td></tr>
        ${l.property_address ? `<tr><td>Property Address:</td><td>${l.property_address}</td></tr>` : ''}
        <tr><td>County:</td><td>${countyFull}</td></tr>
        <tr><td>Tax Sale Date:</td><td>${fmtDate(l.sale_date)}</td></tr>
        <tr><td>Excess Proceeds Amount:</td><td>${fmtMoney(l.excess_amount)}</td></tr>
        <tr><td>Claim Filing Deadline:</td><td>${deadlineDisplay}</td></tr>
        <tr><td>Legal Authority:</td><td>Cal. Rev. &amp; Tax. Code §4675</td></tr>
      </table>
    </div>
    <p>Under California Revenue &amp; Taxation Code §4675, the former owner of record (or other party of interest) is entitled to claim excess proceeds from a tax-defaulted property sale within <strong>one (1) year</strong> of the date of sale. The claim filing deadline for this matter is <strong>${deadlineDisplay}</strong>. We respectfully request that your office provide any required claim forms, instructions, or documentation needed to complete the formal filing process.</p>
    <p>Please direct all correspondence regarding this matter to the contact information provided below. We are prepared to supply supporting documentation, including proof of ownership interest, identification, and any county-specific claim forms upon request.</p>

    <div class="response-box">
      <p><strong>Response Instructions — Please Reply By:</strong> ${deadlineDisplay}</p>
      <p>To respond or inquire about this claim, contact us at: <strong>${COMPANY_CONTACT_EMAIL}</strong></p>
      <p>Reference APN <strong>${l.apn}</strong> and claimant name <strong>${claimantName}</strong> in all correspondence.</p>
    </div>

    <p>Thank you for your attention to this matter. We look forward to your timely response and to resolving this claim in accordance with California law.</p>
    <p>Sincerely,</p>
    <div class="signature-block">
      <p>_______________________________</p>
      <p><strong>${claimantName}</strong></p>
      <p>Claimant / Authorized Representative</p>
      <br>
      <p>Date: _______________________________</p>
      <br>
      <p>Contact / Mailing Address:</p>
      <p>${l.mailing_address ? l.mailing_address.replace(/\n/g, '<br>') : '_______________________________'}</p>
      ${!l.mailing_address ? '<p>_______________________________</p><p>_______________________________</p>' : ''}
      <p>Phone: ${l.phone || '________________________'}</p>
      <p>Email: ${l.email || '________________________'}</p>
    </div>
    <div class="disclaimer">
      <strong>IMPORTANT LEGAL NOTICE &amp; CONTINGENCY FEE DISCLOSURE:</strong> This document was prepared as a claim letter by a private surplus proceeds recovery service. <strong>This firm is not a government agency.</strong> Claimants may file directly with the County Treasurer-Tax Collector at no cost — you are not required to use a third-party service or representative. If you engage our recovery services, fees are contingency-based (a percentage of recovered proceeds) and are governed by a separate written agreement. No fee is charged if no recovery is made. This notice does not constitute legal advice. Claimants are encouraged to consult an attorney regarding their rights under California Revenue &amp; Taxation Code §4675. For questions, contact ${COMPANY_CONTACT_EMAIL}.
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildClaimLetterHtml };
