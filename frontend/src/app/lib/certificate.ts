import { api } from "./api";
import type { ApiDocumentType, ApiRequest, CertificateContent } from "./api";

const MUNICIPALITY_SEAL_URL = "/seals/municipality-bilar.jpg";
const BARANGAY_SEAL_URL = "/seals/barangay-campagao.jpg";

// No officials directory exists yet — the signatory defaults to the seeded admin/Officer account.
// The admin can change it per document type from the certificate template editor.
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

export const CERTIFICATE_FIELDS: (keyof CertificateContent)[] = ["title", "body", "issued", "signatoryName", "signatoryTitle"];

// All rules are scoped under .cert-page so the admin editor can render it inside the app.
export const CERTIFICATE_CSS = `
  .cert-page { box-sizing: border-box; width: 7.5in; min-height: 10in; background: #fff; color: #111; font-family: "Times New Roman", Times, serif; border: 4px double #1a3a6b; padding: 32px 48px 150px; position: relative; text-align: left; }
  .cert-page * { box-sizing: border-box; }
  .cert-page .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1a3a6b; padding-bottom: 14px; margin-bottom: 26px; }
  .cert-page .seal { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .cert-page .titles { flex: 1; text-align: center; }
  .cert-page .republic { font-size: 13px; line-height: 1.5; }
  .cert-page .barangay-name { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; color: #1a3a6b; margin-top: 3px; text-transform: uppercase; }
  .cert-page .office { text-align: center; font-size: 13px; letter-spacing: 1px; font-weight: bold; margin-bottom: 6px; }
  .cert-page .doc-title { text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 28px; }
  .cert-page .to-whom { font-weight: bold; margin-bottom: 18px; font-size: 15px; }
  .cert-page .body-text { font-size: 15px; line-height: 2; text-align: justify; margin-bottom: 18px; }
  .cert-page .issued { font-size: 15px; line-height: 2; text-align: justify; margin-bottom: 60px; }
  .cert-page .signature { text-align: right; }
  .cert-page .signature .name { font-weight: bold; text-decoration: underline; font-size: 15px; }
  .cert-page .signature .title { font-size: 13px; }
  .cert-page .footer { position: absolute; bottom: 36px; left: 48px; right: 48px; font-size: 13px; line-height: 1.9; border-top: 1px solid #999; padding-top: 10px; }
  .cert-page [contenteditable="true"] { outline: 1px dashed rgba(26,58,107,0.35); outline-offset: 4px; border-radius: 2px; }
  .cert-page .ph { display: inline-block; padding: 0 6px; margin: 0 1px; border-radius: 4px; background: #e6ecf7; color: #1a3a6b; font-family: "Segoe UI", sans-serif; font-size: 12px; font-weight: 600; line-height: 1.6; user-select: all; }
  .cert-page [contenteditable="true"]:focus { outline: 2px solid #1a3a6b; background: rgba(26,58,107,0.04); }
`;

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function ordinalSuffix(n: number) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

// Placeholders the admin can drop into a template; each is filled from the request when a PDF is made.
export const CERTIFICATE_PLACEHOLDERS = {
  NAME: "Resident Name",
  AGE: "Age",
  CIVIL_STATUS: "Civil Status",
  ADDRESS: "Address",
  PURPOSE: "Purpose",
  DAY: "Day Issued",
  MONTH_YEAR: "Month & Year Issued",
  DATE_ISSUED: "Date Issued",
} as const;
export type CertificatePlaceholder = keyof typeof CERTIFICATE_PLACEHOLDERS;

const TOKEN_PATTERN = /\{\{(NAME|AGE|CIVIL_STATUS|ADDRESS|PURPOSE|DAY|MONTH_YEAR|DATE_ISSUED)\}\}/g;

// Built-in wording per document type, written with placeholders. Used until the admin saves their own.
function defaultBodyTemplate(docType: string): string {
  const intro = `{{NAME}}, {{AGE}} years old, {{CIVIL_STATUS}} and a resident of {{ADDRESS}}`;
  const closing = `This certification is issued upon the request of the above-named person for {{PURPOSE}} and for whatever legal purpose it may serve.`;
  switch (docType) {
    case "Indigency Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${intro}, belongs to an indigent family in this barangay whose income is insufficient to meet their family's basic needs.<br><br>${closing}`;
    case "Residency Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that {{NAME}}, {{AGE}} years old, {{CIVIL_STATUS}}, is a bona fide resident of {{ADDRESS}}, Barangay Campagao, Municipality of Bilar, Province of Bohol.<br><br>${closing}`;
    case "Business Permit":
      return `<strong>THIS IS TO CERTIFY</strong> that the business establishment operated by {{NAME}}, located at {{ADDRESS}}, has been granted clearance by this barangay to operate within its jurisdiction, subject to compliance with existing barangay ordinances and regulations.<br><br>This clearance is valid for one (1) year from the date of issue unless sooner revoked for cause, and is issued upon the request of the above-named person for {{PURPOSE}} and for whatever legal purpose it may serve.`;
    case "Good Moral Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${intro}, is personally known to this office to be of good moral character and a law-abiding citizen, with no derogatory record filed in this barangay.<br><br>${closing}`;
    case "First-Time Job Seeker Certificate":
      return `<strong>THIS IS TO CERTIFY</strong> that ${intro}, is a <strong>FIRST-TIME JOB SEEKER</strong> as defined under Republic Act No. 11261, otherwise known as the "First Time Jobseekers Assistance Act," and has not been previously employed since reaching the legal working age.<br><br>This certification is issued to avail of the one-time waiver of fees for government clearances and documents under R.A. No. 11261, upon the request of the above-named person for {{PURPOSE}} and for whatever legal purpose it may serve.`;
    case "Certificate of Cohabitation":
      return `<strong>THIS IS TO CERTIFY</strong> that ${intro}, is known to this office and to the community to have been living together with his/her partner continuously as husband and wife for a period of at least five (5) years, without any legal impediment to marry each other.<br><br>This certification is issued pursuant to Article 34 of the Family Code of the Philippines, upon the request of the above-named person for {{PURPOSE}} and for whatever legal purpose it may serve.`;
    case "Barangay Clearance":
    default:
      return `<strong>THIS IS TO CERTIFY</strong> that ${intro} has no pending civil or criminal case in this barangay, nor is known to be a member or supporter of any subversive organization.<br><br>This further certifies that he/she is a person of good moral character and a law-abiding citizen of this community.<br><br>${closing}`;
  }
}

export function defaultCertificateTemplate(docType: string): CertificateContent {
  return {
    title: escapeHtml(DOC_TITLES[docType] || docType),
    body: defaultBodyTemplate(docType),
    issued: `<strong>ISSUED</strong> this {{DAY}} day of {{MONTH_YEAR}} at Barangay Campagao, Municipality of Bilar, Province of Bohol upon request of the interested party for whatever legal purpose it may serve.`,
    signatoryName: escapeHtml(BARANGAY_CAPTAIN_NAME.toUpperCase()),
    signatoryTitle: "Barangay Captain",
  };
}

// The admin's saved template for this document type, or the built-in one.
export function templateForDocType(docType: string, docTypes: ApiDocumentType[]): CertificateContent {
  const defaults = defaultCertificateTemplate(docType);
  const saved = docTypes.find((d) => d.name === docType)?.certificateTemplate;
  if (!saved) return defaults;
  const result = { ...defaults };
  for (const field of CERTIFICATE_FIELDS) {
    if (typeof saved[field] === "string") result[field] = saved[field];
  }
  return result;
}

function issuedDate(request: ApiRequest) {
  return new Date(`${request.updatedAt}T00:00:00`);
}

function placeholderValues(request: ApiRequest): Record<CertificatePlaceholder, string> {
  const date = issuedDate(request);
  const day = date.getDate();
  const age = calcAge(request.dateOfBirth);
  return {
    // Name and purpose are always bold, whatever formatting the template has around them.
    NAME: `<strong>${escapeHtml(request.residentName.toUpperCase())}</strong>`,
    PURPOSE: `<strong>${escapeHtml(request.purpose)}</strong>`,
    AGE: age !== null ? String(age) : "___",
    CIVIL_STATUS: escapeHtml(civilStatusLabel(request.civilStatus)),
    ADDRESS: escapeHtml(request.address || "Barangay Campagao"),
    DAY: `${day}<sup>${ordinalSuffix(day)}</sup>`,
    MONTH_YEAR: date.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    DATE_ISSUED: date.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }),
  };
}

// Sanitizes the template first, then swaps in escaped request values, so neither a saved template
// nor resident-entered text can inject markup.
export function fillCertificateTemplate(template: CertificateContent, request: ApiRequest): CertificateContent {
  const values = placeholderValues(request);
  const fill = (html: string) => sanitizeCertificateHtml(html).replace(TOKEN_PATTERN, (_, key: CertificatePlaceholder) => values[key]);
  const result = {} as CertificateContent;
  for (const field of CERTIFICATE_FIELDS) result[field] = fill(template[field]);
  return result;
}

// Editor helpers: tokens are shown as non-editable chips so they can't be half-deleted or mistyped.
export function placeholderChip(key: CertificatePlaceholder): string {
  return `<span class="ph" contenteditable="false" data-ph="${key}">${CERTIFICATE_PLACEHOLDERS[key]}</span>`;
}

export function tokensToChips(html: string): string {
  return sanitizeCertificateHtml(html).replace(TOKEN_PATTERN, (_, key: CertificatePlaceholder) => placeholderChip(key));
}

export function chipsToTokens(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("[data-ph]").forEach((chip) => {
    const key = chip.getAttribute("data-ph") || "";
    chip.replaceWith(document.createTextNode(key in CERTIFICATE_PLACEHOLDERS ? `{{${key}}}` : ""));
  });
  return sanitizeCertificateHtml(clone.innerHTML);
}

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "SUP", "SUB", "P", "DIV", "SPAN"]);

// Rebuilds the HTML keeping only basic formatting tags with no attributes.
export function sanitizeCertificateHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const out = document.createElement("div");

  function copy(from: Node, to: Node) {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(node.textContent || ""));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE"].includes(el.tagName)) return;
        if (ALLOWED_TAGS.has(el.tagName)) {
          const clean = document.createElement(el.tagName.toLowerCase());
          copy(el, clean);
          to.appendChild(clean);
        } else {
          copy(el, to);
        }
      }
    });
  }
  copy(template.content, out);
  return out.innerHTML;
}

export function certificatePageInnerHtml(request: ApiRequest, content: CertificateContent, { editable }: { editable: boolean }): string {
  const field = (name: keyof CertificateContent) => `data-field="${name}"${editable ? ` contenteditable="true"` : ""}`;
  const dateIssued = issuedDate(request).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

  return `
    <div class="header">
      <img class="seal" src="${MUNICIPALITY_SEAL_URL}" alt="Municipality of Bilar seal" />
      <div class="titles">
        <div class="republic">Republic of the Philippines<br/>Province of Bohol<br/>Municipality of Bilar</div>
        <div class="barangay-name">Barangay Campagao</div>
      </div>
      <img class="seal" src="${BARANGAY_SEAL_URL}" alt="Barangay Campagao seal" />
    </div>
    <div class="office">OFFICE OF THE BARANGAY CAPTAIN</div>
    <div class="doc-title" ${field("title")}>${content.title}</div>
    <div class="to-whom">TO WHOM IT MAY CONCERN:</div>
    <div class="body-text" ${field("body")}>${content.body}</div>
    <div class="issued" ${field("issued")}>${content.issued}</div>
    <div class="signature">
      <div class="name" ${field("signatoryName")}>${content.signatoryName}</div>
      <div class="title" ${field("signatoryTitle")}>${content.signatoryTitle}</div>
    </div>
    <div class="footer">
      Cert. No.: ${escapeHtml(request.id)}<br/>
      O.R. No.: ______________________<br/>
      Date Issued: ${dateIssued}<br/>
      Doc. Stamp: ${request.fee === 0 ? "Exempted (Free)" : request.paid ? "Paid" : "Unpaid"}
    </div>`;
}

async function waitForImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve(); })
    )
  );
}

async function buildCertificatePdf(request: ApiRequest, docTypes: ApiDocumentType[], { soft }: { soft: boolean }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;";
  host.innerHTML = `<style>${CERTIFICATE_CSS}</style><div class="cert-page">${certificatePageInnerHtml(request, fillCertificateTemplate(templateForDocType(request.docType, docTypes), request), { editable: false })}</div>`;
  document.body.appendChild(host);
  try {
    const page = host.querySelector(".cert-page") as HTMLElement;
    await waitForImages(page);
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });

    const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
    const maxW = 7.5, maxH = 10;
    let w = maxW, h = (canvas.height / canvas.width) * maxW;
    if (h > maxH) { w = w * (maxH / h); h = maxH; }
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", (8.5 - w) / 2, 0.5, w, h);

    if (soft) {
      pdf.setGState(pdf.GState({ opacity: 0.12 }));
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(80);
      pdf.setTextColor(26, 58, 107);
      pdf.text("SOFT COPY", 4.25, 6.2, { align: "center", angle: 45 });
      pdf.setGState(pdf.GState({ opacity: 1 }));
    } else {
      pdf.autoPrint();
    }
    pdf.setProperties({ title: `${request.id} ${request.docType}${soft ? " (Soft Copy)" : ""}`, author: "Barangay Campagao" });
    return pdf;
  } finally {
    host.remove();
  }
}

// Opens the certificate as a read-only PDF in a new tab. The tab is opened right away (before any
// awaiting) so popup blockers allow it; `source` may be a loader, e.g. one that first records the print.
// soft = watermarked "SOFT COPY" for viewing; otherwise the official copy, which opens the print dialog.
export async function openCertificatePdf(source: ApiRequest | (() => Promise<ApiRequest | null>), { soft }: { soft: boolean }) {
  const win = window.open("", "_blank");
  if (win) win.document.write(`<p style="font-family:sans-serif;padding:24px;color:#35486b">Generating certificate PDF…</p>`);
  try {
    const request = typeof source === "function" ? await source() : source;
    if (!request) {
      win?.close();
      return;
    }
    // Fetched fresh so the admin's latest template edits apply immediately, without a page reload.
    const { documentTypes } = await api.listDocumentTypes();
    const pdf = await buildCertificatePdf(request, documentTypes, { soft });
    const fileName = `${request.id}-${request.docType.replace(/\s+/g, "-")}${soft ? "-soft-copy" : ""}.pdf`;
    if (win && !win.closed) {
      win.location.href = URL.createObjectURL(pdf.output("blob"));
    } else {
      pdf.save(fileName);
    }
  } catch (err) {
    win?.close();
    throw err;
  }
}
