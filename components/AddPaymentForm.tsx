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
        <div className="p-3 bg-rose-50 border border-rose-200 text-signal-red text-[12px] font-medium rounded-md">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1">
            Amount Received (₹) <span className="text-signal-red">*</span>
          </label>
          <input
            type="number"
            step="1"
            min="1"
            required
            placeholder="e.g. 25000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-semibold text-ink tabular-nums"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1">
            Payment Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink cursor-pointer"
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
          <label className="block text-[12px] font-medium text-gray-700 mb-1">
            Date of Payment
          </label>
          <input
            type="date"
            required
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-gray-700 mb-1">
            Reference / Note
          </label>
          <input
            type="text"
            placeholder="e.g. 50% Kickoff Advance, UTR: 38291..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
          />
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 text-[12px] font-medium text-white bg-signal-green hover:bg-emerald-700 rounded-md disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isPending ? "Recording..." : "Record Payment Entry"}
        </button>
      </div>
    </form>
  );
}
