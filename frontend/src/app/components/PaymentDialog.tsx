import { useState } from "react";
import { Banknote, X } from "lucide-react";
import type { ApiRequest } from "../lib/api";

export function PaymentDialog({ request, onClose, onConfirm }: {
  request: ApiRequest;
  onClose: () => void;
  onConfirm: (amountTendered: number) => Promise<void>;
}) {
  const [cashReceived, setCashReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const balance = request.balance ?? request.fee;
  const cash = Number(cashReceived);
  const validCash = Number.isFinite(cash) && cash >= 0.01;
  const tendered = validCash ? Math.round(cash * 100) / 100 : 0;
  const payment = Math.min(balance, tendered);
  const change = Math.max(0, tendered - payment);
  const balanceAfter = Math.max(0, balance - payment);

  async function submit() {
    if (!validCash || saving) return;
    setSaving(true);
    try {
      await onConfirm(tendered);
      onClose();
    } catch {
      // The caller shows the server error; keep the dialog open so the amount can be corrected.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4" onClick={() => !saving && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="record-payment-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
        <header className="flex items-start justify-between bg-gradient-to-r from-[#102b52] to-[#24508f] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#f3d27a]"><Banknote size={22} /></div>
            <div><h2 id="record-payment-title" className="text-xl font-bold">Record a Payment</h2><p className="mt-0.5 text-sm text-blue-100">{request.residentName} · {request.id}</p></div>
          </div>
          <button aria-label="Close payment dialog" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-50"><X size={18} /></button>
        </header>

        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div><div className="text-sm font-semibold text-blue-900">{request.docType}</div><div className="mt-0.5 text-xs text-blue-700">Balance due on this request</div></div>
            <div className="text-xl font-extrabold text-blue-950">₱{balance.toFixed(2)}</div>
          </div>

          <div>
            <label htmlFor="payment-cash-received" className="mb-1.5 block text-sm font-semibold text-slate-800">Cash received</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center font-semibold text-slate-500">₱</span>
              <input id="payment-cash-received" autoFocus type="number" min="0.01" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} placeholder="0.00" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-8 pr-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Enter the amount handed to staff. Partial payments are allowed; any excess is calculated as change.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div className="rounded-lg bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Applied</div><div className="mt-1 text-base font-bold text-slate-900">₱{payment.toFixed(2)}</div></div>
            <div className="rounded-lg bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Change</div><div className="mt-1 text-base font-bold text-emerald-700">₱{change.toFixed(2)}</div></div>
            <div className="rounded-lg bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Balance left</div><div className="mt-1 text-base font-bold text-amber-700">₱{balanceAfter.toFixed(2)}</div></div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button disabled={!validCash || saving} onClick={() => void submit()} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"><Banknote size={16} />{saving ? "Saving payment..." : "Save Payment"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
