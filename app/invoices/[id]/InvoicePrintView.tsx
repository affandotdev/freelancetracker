"use client";

import React, { useState, useTransition } from "react";
import BackButton from "@/components/BackButton";
import { updateInvoiceStatusAction } from "@/lib/actions";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  amount: number;
  status: string;
  notes: string | null;
  project: {
    id: string;
    name: string;
    client: string;
    clientEmail: string | null;
    category: string;
    totalAmount: number;
    receivedAmount: number;
    description: string | null;
  };
}

interface InvoicePrintViewProps {
  invoice: InvoiceData;
}

export default function InvoicePrintView({ invoice }: InvoicePrintViewProps) {
  const [status, setStatus] = useState(invoice.status);
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleStatusChange = (newStatus: "Draft" | "Sent" | "Paid") => {
    setStatus(newStatus);
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction(invoice.id, newStatus);
      } catch (err: any) {
        alert(err?.message || "Failed to update status.");
      }
    });
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Action Bar - Hidden in Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden bg-white p-4 rounded-lg border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <BackButton
            fallbackHref={`/accounts/${invoice.project.id}`}
            label="Back to Project Accounts"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={status}
              disabled={isPending}
              onChange={(e) =>
                handleStatusChange(e.target.value as "Draft" | "Sent" | "Paid")
              }
              className="text-xs font-medium px-2.5 py-1 bg-white border border-border rounded-md focus:outline-none cursor-pointer text-ink"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer select-none"
          >
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Sheet - Full print fidelity */}
      <div className="bg-white p-8 sm:p-12 rounded-lg border border-border shadow-xs print:shadow-none print:border-none print:p-0 print:m-0 space-y-8 text-ink">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-ink text-white flex items-center justify-center font-bold text-xs">
                WP
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink leading-tight">
                  WorkPlan Studio
                </h2>
                <p className="text-xs text-slate-500">
                  Freelance Deliverables & Engineering Services
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              team@workplan.dev • www.workplan.dev
            </p>
          </div>

          <div className="sm:text-right">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              INVOICE
            </h1>
            <p className="text-sm font-semibold text-accent mt-1 tabular-nums">
              {invoice.invoiceNumber}
            </p>
            <div className="mt-2 inline-block">
              <span
                className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                  status === "Paid"
                    ? "bg-emerald-50 text-signal-green border-emerald-200"
                    : status === "Sent"
                    ? "bg-blue-50 text-accent border-blue-200"
                    : "bg-surface text-slate-700 border-border"
                }`}
              >
                {status === "Paid" ? "PAID IN FULL" : status}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Date Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1 bg-surface p-4 rounded-lg border border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              Billed To:
            </span>
            <p className="text-sm font-bold text-ink">{invoice.project.client}</p>
            {invoice.project.clientEmail && (
              <p className="text-slate-600">{invoice.project.clientEmail}</p>
            )}
            <p className="text-slate-600 pt-1 font-medium">
              Project: {invoice.project.name}
            </p>
            <p className="text-slate-400 text-[11px]">
              Category: {invoice.project.category}
            </p>
          </div>

          <div className="space-y-2 sm:text-right flex flex-col justify-center bg-surface p-4 rounded-lg border border-border">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Date Issued:
              </span>
              <span className="font-semibold text-ink text-xs tabular-nums">
                {new Date(invoice.issueDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            {invoice.dueDate && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Payment Due Date:
                </span>
                <span className="font-semibold text-signal-amber text-xs tabular-nums">
                  {new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface border-b border-border text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Description & Deliverable</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-4 px-4">
                  <p className="font-semibold text-ink text-sm">
                    {invoice.project.name} — Professional Deliverable Services
                  </p>
                  {invoice.notes && (
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                      {invoice.notes}
                    </p>
                  )}
                  {invoice.project.description && (
                    <p className="text-slate-400 text-[11px] mt-1">
                      {invoice.project.description}
                    </p>
                  )}
                </td>
                <td className="py-4 px-4 text-right font-bold text-ink text-base align-top tabular-nums">
                  {formatCurrency(invoice.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Payment Instructions */}
          <div className="bg-surface p-4 rounded-lg border border-border text-xs text-slate-600 max-w-sm w-full space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
              Payment Instructions / Bank Details:
            </span>
            <p className="font-semibold text-ink">Bank Transfer / UPI Accepted</p>
            <p className="text-[11px]">A/C Name: WorkPlan Freelance Studio</p>
            <p className="text-[11px] tabular-nums">Account #: 009281928392 • IFSC: HDFC0001234</p>
            <p className="text-[11px]">UPI ID: pay.workplan@okhdfcbank</p>
          </div>

          {/* Amount Due Box */}
          <div className="sm:text-right space-y-1.5 w-full sm:w-auto">
            <div className="text-xs text-slate-500 flex justify-between sm:justify-end gap-6">
              <span>Subtotal:</span>
              <span className="font-semibold text-ink tabular-nums">
                {formatCurrency(invoice.amount)}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex justify-between sm:justify-end gap-6">
              <span>Taxes / Fees:</span>
              <span className="font-semibold text-ink tabular-nums">₹0</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between sm:justify-end items-baseline gap-6">
              <span className="text-sm font-semibold text-slate-700">Total Due:</span>
              <span className="text-2xl font-bold text-ink tabular-nums">
                {formatCurrency(invoice.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-8 border-t border-border text-center text-xs text-slate-400">
          <p className="font-medium text-slate-600">
            Thank you for working with WorkPlan Studio
          </p>
          <p className="text-[11px] mt-1">
            Questions regarding this invoice? Contact us at team@workplan.dev.
          </p>
        </div>
      </div>
    </div>
  );
}
