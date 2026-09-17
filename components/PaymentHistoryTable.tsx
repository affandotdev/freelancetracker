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
        return "bg-gray-50 text-gray-700 border-gray-200";
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
      <div className="bg-white p-8 rounded-lg border border-dashed border-border text-center text-gray-400 text-[13px]">
        <p className="font-medium text-ink">No payment logs recorded yet</p>
        <p className="text-[12px] mt-0.5 text-gray-400">Use &quot;Record Payment&quot; to log incoming client milestones.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full text-left border-collapse table-zebra text-[13px]">
        <thead>
          <tr className="bg-surface border-b border-border text-[11px] font-medium text-gray-500">
            <th className="py-2.5 px-4">Date Paid</th>
            <th className="py-2.5 px-4 text-right">Amount</th>
            <th className="py-2.5 px-4 text-center">Method</th>
            <th className="py-2.5 px-4">Notes / Reference</th>
            <th className="py-2.5 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {payments.map((p) => {
            const isDeleting = deletingId === p.id;

            return (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 font-medium text-ink whitespace-nowrap tabular-nums">
                  {new Date(p.paidOn).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                <td className="py-3 px-4 text-right font-medium text-signal-green whitespace-nowrap tabular-nums">
                  {formatCurrency(p.amount)}
                </td>

                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <span
                    className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${getMethodBadge(
                      p.method
                    )}`}
                  >
                    {p.method}
                  </span>
                </td>

                <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                  {p.note || <span className="text-gray-300 italic">—</span>}
                </td>

                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    disabled={isDeleting || isPending}
                    onClick={() => handleDelete(p.id, p.amount)}
                    className="text-[12px] font-medium text-gray-400 hover:text-signal-red transition-colors disabled:opacity-40 cursor-pointer"
                    title="Delete payment"
                  >
                    {isDeleting ? "..." : "Delete"}
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
