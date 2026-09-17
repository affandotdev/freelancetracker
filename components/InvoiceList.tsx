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
        return "bg-emerald-50 text-signal-green border-emerald-200";
      case "Sent":
        return "bg-blue-50 text-accent border-blue-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
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
      <div className="bg-white p-8 rounded-lg border border-dashed border-border text-center text-gray-400 text-[13px]">
        <p className="font-medium text-ink">No invoices generated yet</p>
        <p className="text-[12px] mt-0.5 text-gray-400">Click &quot;+ Generate Invoice&quot; to create a printable invoice.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full text-left border-collapse table-zebra text-[13px]">
        <thead>
          <tr className="bg-surface border-b border-border text-[11px] font-medium text-gray-500">
            <th className="py-2.5 px-4">Invoice #</th>
            <th className="py-2.5 px-4">Date Issued</th>
            <th className="py-2.5 px-4">Due Date</th>
            <th className="py-2.5 px-4 text-right">Amount</th>
            <th className="py-2.5 px-4 text-center">Status</th>
            <th className="py-2.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => {
            const isUpdating = updatingId === inv.id;
            const isDeleting = deletingId === inv.id;

            return (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 font-medium text-accent whitespace-nowrap">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="hover:underline flex items-center gap-1"
                  >
                    <span>{inv.invoiceNumber}</span>
                  </Link>
                </td>

                <td className="py-3 px-4 text-gray-700 whitespace-nowrap tabular-nums">
                  {new Date(inv.issueDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                <td className="py-3 px-4 text-gray-500 whitespace-nowrap tabular-nums">
                  {inv.dueDate
                    ? new Date(inv.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>

                <td className="py-3 px-4 text-right font-medium text-ink whitespace-nowrap tabular-nums">
                  {formatCurrency(inv.amount)}
                </td>

                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <select
                    value={inv.status}
                    disabled={isUpdating || isPending}
                    onChange={(e) =>
                      handleStatusChange(inv.id, e.target.value as "Draft" | "Sent" | "Paid")
                    }
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border focus:outline-none cursor-pointer ${getStatusBadge(
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
                      className="px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-blue-50 border border-border rounded-md transition-colors"
                    >
                      View / Print
                    </Link>

                    <button
                      type="button"
                      disabled={isDeleting || isPending}
                      onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                      className="text-[12px] font-medium text-gray-400 hover:text-signal-red transition-colors disabled:opacity-40 cursor-pointer"
                      title="Delete invoice"
                    >
                      {isDeleting ? "..." : "Delete"}
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
