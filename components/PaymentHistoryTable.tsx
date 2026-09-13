"use client";

import React, { useState, useTransition } from "react";
import { deletePaymentAction } from "@/lib/actions";

export interface PaymentItem {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  paidOn: string;
  createdAt?: string;
}

interface PaymentHistoryTableProps {
  payments: PaymentItem[];
  onPaymentDeleted?: (paymentId: string) => void;
}

export default function PaymentHistoryTable({
  payments,
  onPaymentDeleted,
}: PaymentHistoryTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "UPI":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Bank Transfer":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Cash":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Cheque":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const handleDelete = async (paymentId: string, amount: number) => {
    if (!confirm(`Are you sure you want to delete this payment of ${formatCurrency(amount)}? This will automatically decrease the project's received amount.`)) {
      return;
    }

    setDeletingId(paymentId);
    startTransition(async () => {
      try {
        await deletePaymentAction(paymentId);
        if (onPaymentDeleted) {
          onPaymentDeleted(paymentId);
        }
      } catch (err: any) {
        alert(err?.message || "Failed to delete payment.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  if (payments.length === 0) {
    return (
      <div className="bg-slate-50/70 p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
        <span className="text-2xl block mb-1">💳</span>
        <p className="font-semibold text-slate-600">No payment logs recorded yet</p>
        <p className="text-[11px] mt-0.5">Use &quot;Record Payment&quot; to log incoming client milestones.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <th className="py-3 px-4">Date Paid</th>
            <th className="py-3 px-4 text-right">Amount (₹)</th>
            <th className="py-3 px-4 text-center">Payment Method</th>
            <th className="py-3 px-4">Notes / Reference</th>
            <th className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => {
            const isDeleting = deletingId === p.id;

            return (
              <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                  {new Date(p.paidOn).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                  {formatCurrency(p.amount)}
                </td>

                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getMethodBadge(
                      p.method
                    )}`}
                  >
                    {p.method}
                  </span>
                </td>

                <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                  {p.note || <span className="text-slate-300 italic">—</span>}
                </td>

                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    disabled={isDeleting || isPending}
                    onClick={() => handleDelete(p.id, p.amount)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Delete payment"
                  >
                    {isDeleting ? "..." : "🗑️"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
