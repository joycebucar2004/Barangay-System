import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { CERTIFICATE_CSS, certificatePageInnerHtml, fillCertificateTemplate, templateForDocType } from "../lib/certificate";
import type { ApiDocumentType, ApiRequest } from "../lib/api";

// Illustrative residents shown on the sample certificates — not real people.
const SAMPLES: { name: string; purpose: string; dob: string; civil: ApiRequest["civilStatus"]; address: string }[] = [
  { name: "Juan P. Dela Cruz", purpose: "Employment Requirement", dob: "1995-03-14", civil: "Single", address: "Purok 2, Campagao" },
  { name: "Maria Clara S. Reyes", purpose: "Medical Assistance", dob: "1988-07-22", civil: "Married", address: "Purok 4, Campagao" },
  { name: "Jose Miguel A. Ramos", purpose: "Bank Account Opening", dob: "1990-11-05", civil: "Married", address: "Purok 1, Campagao" },
  { name: "Ana Liza T. Garcia", purpose: "Sari-sari Store Operation", dob: "1984-01-30", civil: "Widowed", address: "Purok 3, Campagao" },
  { name: "Carlos B. Mendoza", purpose: "College Scholarship", dob: "2005-09-18", civil: "Single", address: "Purok 5, Campagao" },
  { name: "Rosa M. Villanueva", purpose: "First Job Application", dob: "2004-04-09", civil: "Single", address: "Purok 2, Campagao" },
  { name: "Pedro L. Santos", purpose: "PhilHealth Registration", dob: "1992-12-01", civil: "Married", address: "Purok 6, Campagao" },
];

const PAGE_WIDTH = 720; // .cert-page is 7.5in at 96dpi

function sampleRequest(doc: ApiDocumentType, index: number): ApiRequest {
  const s = SAMPLES[index % SAMPLES.length];
  const today = new Date().toISOString().split("T")[0];
  return {
    id: `SAMPLE-${String(index + 1).padStart(3, "0")}`, residentId: "", residentName: s.name, docType: doc.name, status: "Released",
    purpose: s.purpose, submittedAt: today, updatedAt: today, fee: doc.fee, paid: true, address: s.address, contactNo: "",
    dateOfBirth: s.dob, civilStatus: s.civil, files: [],
  };
}

function CertificateThumbnail({ doc, docTypes, index }: { doc: ApiDocumentType; docTypes: ApiDocumentType[]; index: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_WIDTH));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const request = sampleRequest(doc, index);
  const html = certificatePageInnerHtml(request, fillCertificateTemplate(templateForDocType(doc.name, docTypes), request), { editable: false });

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden bg-white shadow-xl ring-1 ring-black/5" style={{ aspectRatio: "720 / 960" }}>
      <div className="cert-page pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="-rotate-[30deg] text-4xl font-black tracking-[0.3em] text-[#1a3a6b]/10" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>SAMPLE</span>
      </div>
    </div>
  );
}

export function CertificateShowcase({ docTypes, onRequest }: { docTypes: ApiDocumentType[]; onRequest: () => void }) {
  return (
    <>
      <style>{CERTIFICATE_CSS}</style>
      <div className="flex flex-wrap justify-center gap-5">
        {docTypes.map((doc, i) => (
          <div key={doc.name} className="group flex w-full flex-col overflow-hidden sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)] xl:w-[calc(25%-0.9375rem)] rounded-3xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#1a3a6b]/10">
            <div className="relative overflow-hidden px-8 pt-8 pb-0" style={{ background: "linear-gradient(160deg, #1a3a6b 0%, #0d2244 100%)" }}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(212,160,23,0.35) 0%, rgba(212,160,23,0) 70%)" }} />
              <div className="absolute left-4 top-3 rounded-full bg-[#d4a017] px-2.5 py-0.5 text-xs font-bold text-[#0f1c2e] shadow">
                {doc.fee > 0 ? `₱${doc.fee.toLocaleString()}` : "FREE"}
              </div>
              <div className="relative mx-auto mt-3 w-[82%] translate-y-5 -rotate-2 transition-transform duration-300 group-hover:translate-y-3 group-hover:rotate-0">
                <CertificateThumbnail doc={doc} docTypes={docTypes} index={i} />
              </div>
            </div>

            <div className="relative flex flex-1 flex-col p-5 pt-7">
              <h3 className="text-lg font-extrabold leading-snug text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{doc.name}</h3>
              <div className="mt-1 text-sm font-semibold text-[#b8860b]">
                {doc.fee > 0 ? `Processing fee: ₱${doc.fee.toLocaleString()}.00` : "Free of charge"}
              </div>

              <div className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Requirements</div>
              <ul className="mt-2.5 flex-1 space-y-2">
                {doc.requirements.map((req) => (
                  <li key={req.requirement} className="flex items-start gap-2 text-[13px] leading-snug text-foreground/80">
                    {req.required ? (
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle size={17} className="mt-0.5 shrink-0 text-muted-foreground/50" />
                    )}
                    <span>
                      {req.requirement}
                      {!req.required && <span className="ml-1.5 text-xs text-muted-foreground">(optional)</span>}
                    </span>
                  </li>
                ))}
                {doc.requirements.length === 0 && <li className="text-sm text-muted-foreground">No requirements listed.</li>}
              </ul>

              <button
                onClick={onRequest}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Request this document <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
