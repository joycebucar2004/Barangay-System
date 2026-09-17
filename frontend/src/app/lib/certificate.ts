import type { ApiRequest } from "./api";

const MUNICIPALITY_SEAL_URL = "/seals/municipality-bilar.jpg";
const BARANGAY_SEAL_URL = "/seals/barangay-campagao.jpg";

// No officials directory exists yet — the signatory is fixed to the seeded admin/Officer
// account rather than "whoever is currently viewing" (which would let a resident's own
// name appear as the signing Barangay Captain when reprinting their own copy).
const BARANGAY_CAPTAIN_NAME = "Ernesto V. Bautista";

const DOC_TITLES: Record<string, string> = {
  "Barangay Clearance": "Barangay Clearance",
  "Indigency Certificate": "Certificate of Indigency",
  "Residency Certificate": "Certificate of Residency",
  "Business Permit": "Barangay Business Clearance",
  "Good Moral Certificate": "Certificate of Good Moral Character",
  "First-Time Job Seeker Certificate": "First-Time Job Seeker Certificate",
  "Certificate of Cohabitation": "Certificate of Cohabitation",
};

function calcAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function civilStatusLabel(civilStatus?: string) {
  if (!civilStatus) return "of legal age";
  return civilStatus.toLowerCase();
}

// Simple, standard-format drafts — short and to the point, matching the wording barangays
// commonly use ("THIS IS TO CERTIFY that...") rather than dense legal paragraphs.
function bodyFor(request: ApiRequest): string {
  const name = `<strong>${escapeHtml(request.residentName.toUpperCase())}</strong>`;
  const age = calcAge(request.dateOfBirth);
  const agePart = age !== null ? `${age} years old, ` : "";
  const civilPart = civilStatusLabel(request.civilStatus);
  const address = escapeHtml(request.address || "Barangay Campagao");
  const purpose = escapeHtml(request.purpose);

  switch (request.docType) {
    case "Indigency Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${name}, ${agePart}${civilPart} and a resident of ${address}, belongs to an indigent family in this barangay whose income is insufficient to meet their family's basic needs.
        <br/><br/>
        This certification is issued upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
    case "Residency Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${name}, ${agePart}${civilPart}, is a bona fide resident of ${address}, Barangay Campagao, Municipality of Bilar, Province of Bohol.
        <br/><br/>
        This certification is issued upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
    case "Business Permit":
      return `<strong>THIS IS TO CERTIFY</strong> that the business establishment operated by ${name}, located at ${address}, has been granted clearance by this barangay to operate within its jurisdiction, subject to compliance with existing barangay ordinances and regulations.
        <br/><br/>
        This clearance is valid for one (1) year from the date of issue unless sooner revoked for cause, and is issued upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
    case "Good Moral Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${name}, ${agePart}${civilPart} and a resident of ${address}, is personally known to this office to be of good moral character and a law-abiding citizen, with no derogatory record filed in this barangay.
        <br/><br/>
        This certification is issued upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
    case "First-Time Job Seeker Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${name}, ${agePart}${civilPart} and a resident of ${address}, is a <strong>FIRST-TIME JOB SEEKER</strong> as defined under Republic Act No. 11261, otherwise known as the "First Time Jobseekers Assistance Act," and has not been previously employed since reaching the legal working age.
        <br/><br/>
        This certification is issued to avail of the one-time waiver of fees for government clearances and documents under R.A. No. 11261, upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
    case "Certificate of Cohabitation":
      return `<strong>THIS IS TO CERTIFY</strong> that ${name}, ${agePart}${civilPart} and a resident of ${address}, is known to this office and to the community to have been living together with his/her partner continuously as husband and wife for a period of at least five (5) years, without any legal impediment to marry each other.
        <br/><br/>
        This certification is issued pursuant to Article 34 of the Family Code of the Philippines, upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
    case "Barangay Clearance":
    default:
      return `<strong>THIS IS TO CERTIFY</strong> that ${name}, ${agePart}${civilPart} and a resident of ${address} has no pending civil or criminal case in this barangay, nor is known to be a member or supporter of any subversive organization.
        <br/><br/>
        This further certifies that he/she is a person of good moral character and a law-abiding citizen of this community.
        <br/><br/>
        This certification is issued upon the request of the above-named person for ${purpose} and for whatever legal purpose it may serve.`;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function buildCertificateHtml(request: ApiRequest, { soft }: { soft: boolean }): string {
  const issuedDate = new Date(`${request.updatedAt}T00:00:00`);
  const day = issuedDate.getDate();
  const monthYear = issuedDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const dateIssued = issuedDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  const title = DOC_TITLES[request.docType] || request.docType;

  const editable = soft ? `contenteditable="true"` : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — ${escapeHtml(request.residentName)}</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; color: #111; margin: 0; padding: 0; }
  .toolbar { font-family: "Segoe UI", sans-serif; font-size: 13px; background: #eef2f8; color: #35486b; padding: 10px 20px; border-bottom: 1px solid #d3dbe8; }
  .page { border: 4px double #1a3a6b; padding: 32px 48px; min-height: 9.5in; position: relative; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1a3a6b; padding-bottom: 14px; margin-bottom: 26px; }
  .header .seal { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .header .titles { flex: 1; text-align: center; }
  .header .titles .republic { font-size: 13px; line-height: 1.5; }
  .header .titles .barangay-name { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; color: #1a3a6b; margin-top: 3px; text-transform: uppercase; }
  .office { text-align: center; font-size: 13px; letter-spacing: 1px; font-weight: bold; margin-bottom: 6px; }
  .doc-title { text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 28px; }
  .to-whom { font-weight: bold; margin-bottom: 18px; }
  .body-text { font-size: 15px; line-height: 2; text-align: justify; margin-bottom: 18px; }
  .issued { font-size: 15px; line-height: 2; text-align: justify; margin-bottom: 60px; }
  .signature { text-align: right; margin-bottom: 60px; }
  .signature .name { font-weight: bold; text-decoration: underline; font-size: 15px; }
  .signature .title { font-size: 13px; }
  .footer { position: absolute; bottom: 36px; left: 48px; right: 48px; font-size: 13px; line-height: 1.9; border-top: 1px solid #999; padding-top: 10px; }
  [contenteditable="true"] { outline: none; border-radius: 3px; }
  [contenteditable="true"]:hover, [contenteditable="true"]:focus { outline: 1px dashed #1a3a6b; outline-offset: 4px; background: rgba(26,58,107,0.04); }
  @media print {
    .no-print { display: none; }
    [contenteditable="true"] { outline: none !important; background: none !important; }
  }
</style>
</head>
<body>
  ${soft ? `<div class="toolbar no-print">Soft copy — click any text below to correct it, then use your browser's print/save-as-PDF to keep a copy. Nothing here is saved back to the system.</div>` : ""}
  <div class="page">
    <div class="header">
      <img class="seal" src="${MUNICIPALITY_SEAL_URL}" alt="Municipality of Bilar seal" />
      <div class="titles">
        <div class="republic">
          Republic of the Philippines<br/>
          Province of Bohol<br/>
          Municipality of Bilar
        </div>
        <div class="barangay-name">Barangay Campagao</div>
      </div>
      <img class="seal" src="${BARANGAY_SEAL_URL}" alt="Barangay Campagao seal" />
    </div>

    <div class="office">OFFICE OF THE BARANGAY CAPTAIN</div>
    <div class="doc-title" ${editable}>${escapeHtml(title)}</div>

    <div class="to-whom">TO WHOM IT MAY CONCERN:</div>

    <div class="body-text" ${editable}>${bodyFor(request)}</div>

    <div class="issued" ${editable}>
      <strong>ISSUED</strong> this ${day}<sup>${ordinalSuffix(day)}</sup> day of ${monthYear} at Barangay Campagao, Municipality of Bilar, Province of Bohol upon request of the interested party for whatever legal purpose it may serve.
    </div>

    <div class="signature">
      <div class="name" ${editable}>${escapeHtml(BARANGAY_CAPTAIN_NAME.toUpperCase())}</div>
      <div class="title" ${editable}>Barangay Captain</div>
    </div>

    <div class="footer" ${editable}>
      Cert. No.: ${escapeHtml(request.id)}<br/>
      O.R. No.: ______________________<br/>
      Date Issued: ${dateIssued}<br/>
      Doc. Stamp: ${request.fee === 0 ? "Exempted (Free)" : request.paid ? "Paid" : "Unpaid"}
    </div>
  </div>
  ${soft ? "" : "<script>window.onload = () => window.print();</script>"}
</body>
</html>`;
}

export function printCertificate(request: ApiRequest) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(buildCertificateHtml(request, { soft: false }));
  win.document.close();
}

// Preview shown to staff/admin once a request has been verified, so they can review — and, if the
// autofilled details are wrong, directly correct — the certificate before the formal approval +
// payment step that unlocks the official printable copy.
export function previewCertificateSoftCopy(request: ApiRequest) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(buildCertificateHtml(request, { soft: true }));
  win.document.close();
}

function ordinalSuffix(n: number) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}
