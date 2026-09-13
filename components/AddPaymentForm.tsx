"use client";

import React, { useState, useTransition } from "react";
import { addPaymentAction } from "@/lib/actions";

interface AddPaymentFormProps {
  projectId: string;
  onPaymentAdded?: (newPayment: any) => void;
  onClose?: () => void;
}

export default function AddPaymentForm({
  projectId,
  onPaymentAdded,
  onClose,
}: AddPaymentFormProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Please enter a valid payment amount greater than 0.");
      return;
    }

    startTransition(async () => {
      try {
        const created = await addPaymentAction(
          projectId,
          amountNum,
          method,
          note.trim() || null,
          paidOn
        );

        if (onPaymentAdded) {
          onPaymentAdded(created);
        }

        setAmount("");
        setNote("");
        if (onClose) {
          onClose();
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to add payment.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Amount Received (₹) <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="1"
            min="1"
            required
            placeholder="e.g. 25000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Payment Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
          >
            <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
            <option value="UPI">UPI / GPay / PhonePe</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Date of Payment
          </label>
          <input
            type="date"
            required
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Reference / Note
          </label>
          <input
            type="text"
            placeholder="e.g. 50% Kickoff Advance, UTR: 38291..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isPending ? "Recording..." : "Record Payment Entry"}
        </button>
      </div>
    </form>
  );
}
