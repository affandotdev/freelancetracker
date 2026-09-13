"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { updateInvoiceStatusAction, deleteInvoiceAction } from "@/lib/actions";

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  amount: number;
  status: string; // Draft | Sent | Paid
  notes: string | null;
}

interface InvoiceListProps {
  invoices: InvoiceItem[];
  onStatusChanged?: (invoiceId: string, newStatus: string) => void;
  onInvoiceDeleted?: (invoiceId: string) => void;
}

export default function InvoiceList({
  invoices,
  onStatusChanged,
  onInvoiceDeleted,
}: InvoiceListProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Sent":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const handleStatusChange = async (invoiceId: string, nextStatus: "Draft" | "Sent" | "Paid") => {
    setUpdatingId(invoiceId);
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction(invoiceId, nextStatus);
        if (onStatusChanged) {
          onStatusChanged(invoiceId, nextStatus);
        }
      } catch (err: any) {
        alert(err?.message || "Failed to update invoice status.");
      } finally {
        setUpdatingId(null);
      }
    });
  };

  const handleDelete = async (invoiceId: string, invNum: string) => {
    if (!confirm(`Delete invoice ${invNum}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(invoiceId);
    startTransition(async () => {
      try {
        await deleteInvoiceAction(invoiceId);
        if (onInvoiceDeleted) {
          onInvoiceDeleted(invoiceId);
        }
      } catch (err: any) {
        alert(err?.message || "Failed to delete invoice.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  if (invoices.length === 0) {
    return (
      <div className="bg-slate-50/70 p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
        <span className="text-2xl block mb-1">📄</span>
        <p className="font-semibold text-slate-600">No invoices generated yet</p>
        <p className="text-[11px] mt-0.5">Click &quot;+ Generate Invoice&quot; to create a printable, sequential invoice.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <th className="py-3 px-4">Invoice #</th>
            <th className="py-3 px-4">Date Issued</th>
            <th className="py-3 px-4">Due Date</th>
            <th className="py-3 px-4 text-right">Amount (₹)</th>
            <th className="py-3 px-4 text-center">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => {
            const isUpdating = updatingId === inv.id;
            const isDeleting = deletingId === inv.id;

            return (
              <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4 font-extrabold text-blue-600 whitespace-nowrap">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="hover:underline flex items-center gap-1"
                  >
                    <span>{inv.invoiceNumber}</span>
                    <span className="text-slate-300 font-bold">↗</span>
                  </Link>
                </td>

                <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                  {new Date(inv.issueDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                  {inv.dueDate
                    ? new Date(inv.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>

                <td className="py-3 px-4 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                  {formatCurrency(inv.amount)}
                </td>

                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <select
                    value={inv.status}
                    disabled={isUpdating || isPending}
                    onChange={(e) =>
                      handleStatusChange(inv.id, e.target.value as "Draft" | "Sent" | "Paid")
                    }
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer ${getStatusBadge(
                      inv.status
                    )}`}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Paid">Paid</option>
                  </select>
                </td>

                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-lg transition-all"
                    >
                      View / Print 🖨️
                    </Link>

                    <button
                      type="button"
                      disabled={isDeleting || isPending}
                      onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40 cursor-pointer"
                      title="Delete invoice"
                    >
                      {isDeleting ? "..." : "🗑️"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
