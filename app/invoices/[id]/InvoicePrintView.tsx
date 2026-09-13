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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <BackButton
            fallbackHref={`/accounts/${invoice.project.id}`}
            label="Back to Project Accounts"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Status:</span>
            <select
              value={status}
              disabled={isPending}
              onChange={(e) =>
                handleStatusChange(e.target.value as "Draft" | "Sent" | "Paid")
              }
              className="text-xs font-bold px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer select-none"
          >
            <span>🖨️ Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Sheet - Full print fidelity */}
      <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 space-y-8 text-slate-900">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-100 pb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                WP
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 leading-tight">
                  WorkPlan Studio
                </h2>
                <p className="text-xs text-slate-500">
                  Freelance Design & Engineering Services
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              team@workplan.dev • www.workplan.dev
            </p>
          </div>

          <div className="sm:text-right">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              INVOICE
            </h1>
            <p className="text-base font-extrabold text-blue-600 mt-1">
              {invoice.invoiceNumber}
            </p>
            <div className="mt-2 inline-block">
              <span
                className={`text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border ${
                  status === "Paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : status === "Sent"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {status === "Paid" ? "PAID IN FULL" : status}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Date Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Billed To:
            </span>
            <p className="text-sm font-black text-slate-900">{invoice.project.client}</p>
            {invoice.project.clientEmail && (
              <p className="text-slate-600">{invoice.project.clientEmail}</p>
            )}
            <p className="text-slate-500 pt-1 font-semibold">
              Project: {invoice.project.name}
            </p>
            <p className="text-slate-400 text-[11px]">
              Category: {invoice.project.category}
            </p>
          </div>

          <div className="space-y-2 sm:text-right flex flex-col justify-center bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Date Issued:
              </span>
              <span className="font-bold text-slate-800 text-xs">
                {new Date(invoice.issueDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            {invoice.dueDate && (
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Payment Due Date:
                </span>
                <span className="font-bold text-amber-700 text-xs">
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
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">Description & Deliverable</th>
                <th className="py-3 px-5 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-5 px-5">
                  <p className="font-bold text-slate-900 text-sm">
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
                <td className="py-5 px-5 text-right font-black text-slate-900 text-base align-top">
                  {formatCurrency(invoice.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Payment Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-600 max-w-sm w-full space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Payment Instructions / Bank Details:
            </span>
            <p className="font-semibold text-slate-800">Bank Transfer / UPI Accepted</p>
            <p className="text-[11px]">A/C Name: WorkPlan Freelance Studio</p>
            <p className="text-[11px]">Account #: 009281928392 • IFSC: HDFC0001234</p>
            <p className="text-[11px]">UPI ID: pay.workplan@okhdfcbank</p>
          </div>

          {/* Amount Due Box */}
          <div className="sm:text-right space-y-2 w-full sm:w-auto">
            <div className="text-xs text-slate-500 flex justify-between sm:justify-end gap-6">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-800">
                {formatCurrency(invoice.amount)}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex justify-between sm:justify-end gap-6">
              <span>Taxes / Fees:</span>
              <span className="font-bold text-slate-800">₹0</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between sm:justify-end items-baseline gap-6">
              <span className="text-sm font-bold text-slate-700">Total Due:</span>
              <span className="text-2xl font-black text-slate-900">
                {formatCurrency(invoice.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-8 border-t border-slate-100 text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-600">
            Thank you for working with WorkPlan Studio!
          </p>
          <p className="text-[11px] mt-1">
            Questions regarding this invoice? Contact us at team@workplan.dev.
          </p>
        </div>
      </div>
    </div>
  );
}
