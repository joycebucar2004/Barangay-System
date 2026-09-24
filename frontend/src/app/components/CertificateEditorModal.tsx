import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, RotateCcw, Save, X } from "lucide-react";
import {
  CERTIFICATE_CSS,
  CERTIFICATE_FIELDS,
  CERTIFICATE_PLACEHOLDERS,
  certificatePageInnerHtml,
  chipsToTokens,
  defaultCertificateTemplate,
  placeholderChip,
  templateForDocType,
  tokensToChips,
  type CertificatePlaceholder,
} from "../lib/certificate";
import type { ApiDocumentType, ApiRequest, CertificateContent } from "../lib/api";

// Only the header/footer of the page use this; the editable fields show placeholders instead.
function sampleRequest(docType: ApiDocumentType): ApiRequest {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: "BR-XXXX-XXX", residentId: "", residentName: "", docType: docType.name, status: "Approved", purpose: "",
    submittedAt: today, updatedAt: today, fee: docType.fee, paid: false, address: "", contactNo: "", files: [],
  };
}

export function CertificateEditorModal({ docType, onClose, onSave }: {
  docType: ApiDocumentType;
  onClose: () => void;
  onSave: (name: string, template: CertificateContent | null) => Promise<void>;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function render(template: CertificateContent) {
    if (!pageRef.current) return;
    const withChips = {} as CertificateContent;
    for (const field of CERTIFICATE_FIELDS) withChips[field] = tokensToChips(template[field]);
    pageRef.current.innerHTML = certificatePageInnerHtml(sampleRequest(docType), withChips, { editable: true });
  }

  // Set once (not via React state) so typing inside the contenteditable areas isn't overwritten on re-render.
  useEffect(() => {
    render(templateForDocType(docType.name, [docType]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType.name]);

  function insertPlaceholder(key: CertificatePlaceholder) {
    const selection = window.getSelection();
    const inEditableField = !!selection?.anchorNode && !!pageRef.current?.contains(selection.anchorNode) &&
      !!(selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode.parentElement)?.closest("[contenteditable='true']");
    if (!inEditableField) {
      setError("Click inside the certificate text where the placeholder should go, then pick it.");
      return;
    }
    setError("");
    document.execCommand("insertHTML", false, `${placeholderChip(key)}&nbsp;`);
  }

  async function handleSave() {
    if (!pageRef.current) return;
    const template = {} as CertificateContent;
    for (const field of CERTIFICATE_FIELDS) {
      const el = pageRef.current.querySelector(`[data-field="${field}"]`);
      template[field] = el ? chipsToTokens(el) : "";
    }
    if (!template.body.includes("{{NAME}}") || !template.body.includes("{{PURPOSE}}")) {
      setError("The certificate body must include the Resident Name and Purpose placeholders.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(docType.name, template);
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not save the certificate template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setError("");
    setSaving(true);
    try {
      await onSave(docType.name, null);
      render(defaultCertificateTemplate(docType.name));
    } catch (err: any) {
      setError(err.message || "Could not reset the certificate template.");
    } finally {
      setSaving(false);
    }
  }

  const toolButton = "flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors";
  // onMouseDown preventDefault keeps the text cursor inside the certificate while clicking toolbar buttons.
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "rgba(15,28,46,0.75)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{CERTIFICATE_CSS}</style>
      <div className="bg-card border-b border-border px-5 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="text-base font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Certificate Template — {docType.name}</div>
            <div className="text-xs text-muted-foreground">
              Applies to every {docType.name} certificate. Blue tags are filled in with each resident's details automatically.
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onMouseDown={keepSelection} onClick={() => document.execCommand("bold")} className={toolButton} title="Bold"><Bold size={15} /></button>
            <button onMouseDown={keepSelection} onClick={() => document.execCommand("italic")} className={toolButton} title="Italic"><Italic size={15} /></button>
            <button onMouseDown={keepSelection} onClick={() => document.execCommand("underline")} className={toolButton} title="Underline"><Underline size={15} /></button>
          </div>
          <button onClick={handleReset} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-60" title="Discard your edits and go back to the built-in wording">
            <RotateCcw size={15} /> Reset to Default
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors">
            <X size={15} /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            <Save size={15} /> {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Insert:</span>
          {(Object.keys(CERTIFICATE_PLACEHOLDERS) as CertificatePlaceholder[]).map((key) => (
            <button
              key={key}
              onMouseDown={keepSelection}
              onClick={() => insertPlaceholder(key)}
              className="px-2.5 py-1 rounded-md bg-[#e6ecf7] text-[#1a3a6b] text-xs font-semibold hover:bg-[#d5def0] transition-colors"
            >
              + {CERTIFICATE_PLACEHOLDERS[key]}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm px-5 py-2 border-b border-red-100">{error}</div>}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto w-fit shadow-2xl">
          <div ref={pageRef} className="cert-page" />
        </div>
      </div>
    </div>
  );
}
