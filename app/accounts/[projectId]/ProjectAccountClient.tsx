"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import ExportCsvButton from "@/components/ExportCsvButton";
import PaymentHistoryTable, { PaymentItem } from "@/components/PaymentHistoryTable";
import AddPaymentForm from "@/components/AddPaymentForm";
import InvoiceList, { InvoiceItem } from "@/components/InvoiceList";
import { createInvoiceAction } from "@/lib/actions";

interface ProjectAccountData {
  id: string;
  name: string;
  client: string;
  clientEmail: string | null;
  category: string;
  status: string;
  priority: string;
  totalAmount: number;
  receivedAmount: number;
  balance: number;
  deadline: string | null;
  description: string | null;
  createdAt: string;
}

interface ProjectAccountClientProps {
  project: ProjectAccountData;
  initialPayments: PaymentItem[];
  initialInvoices: InvoiceItem[];
}

export default function ProjectAccountClient({
  project,
  initialPayments,
  initialInvoices,
}: ProjectAccountClientProps) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Invoice creation form state
  const [invoiceAmount, setInvoiceAmount] = useState<string>(
    project.balance > 0 ? project.balance.toString() : project.totalAmount.toString()
  );
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>("");
  const [invoiceNotes, setInvoiceNotes] = useState<string>("");
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [isInvoicePending, startInvoiceTransition] = useTransition();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Recalculate dynamic totals from payment state
  const totalReceived = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingBalance = Math.max(0, project.totalAmount - totalReceived);
  const collectionRate =
    project.totalAmount > 0
      ? Math.min(100, Math.round((totalReceived / project.totalAmount) * 100))
      : 0;

  // Prepare CSV export data for this project's payments
  const paymentCsvData = payments.map((p) => ({
    "Date Paid": new Date(p.paidOn).toLocaleDateString("en-IN"),
    "Client": project.client,
    "Project": project.name,
    "Amount (INR)": p.amount,
    "Payment Method": p.method,
    "Notes": p.note || "",
  }));

  const handlePaymentAdded = (newPayment: any) => {
    setPayments((prev) => [
      {
        id: newPayment.id,
        amount: newPayment.amount,
        method: newPayment.method,
        note: newPayment.note,
        paidOn: newPayment.paidOn
          ? new Date(newPayment.paidOn).toISOString()
          : new Date().toISOString(),
      },
      ...prev,
    ]);
    setIsPaymentModalOpen(false);
  };

  const handlePaymentDeleted = (paymentId: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInvoiceError(null);

    const amountNum = parseFloat(invoiceAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setInvoiceError("Please enter a valid invoice amount.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", project.id);
    formData.append("amount", amountNum.toString());
    if (invoiceDueDate) formData.append("dueDate", invoiceDueDate);
    if (invoiceNotes) formData.append("notes", invoiceNotes);

    startInvoiceTransition(async () => {
      try {
        const created = await createInvoiceAction(formData);
        setInvoices((prev) => [
          {
            id: created.id,
            invoiceNumber: created.invoiceNumber,
            issueDate: created.issueDate ? new Date(created.issueDate).toISOString() : new Date().toISOString(),
            dueDate: created.dueDate ? new Date(created.dueDate).toISOString() : null,
            amount: created.amount,
            status: created.status,
            notes: created.notes,
          },
          ...prev,
        ]);
        setIsInvoiceModalOpen(false);
        // Automatically navigate to the print-friendly invoice
        router.push(`/invoices/${created.id}`);
      } catch (err: any) {
        setInvoiceError(err?.message || "Failed to generate invoice.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Bar with Back Navigation & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <BackButton fallbackHref="/accounts" label="Back to Accounts Ledger" />

        <div className="flex items-center gap-2">
          <ExportCsvButton
            filename={`${project.name.toLowerCase().replace(/\s+/g, "_")}_payments`}
            data={paymentCsvData}
            label="Export Payment History (CSV)"
          />
        </div>
      </div>

      {/* Project Financial Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              {project.category} • Client Account
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {project.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Client: <span className="font-bold text-slate-900">{project.client}</span>
              {project.clientEmail && ` (${project.clientEmail})`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Record Payment</span>
            </button>

            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Generate Invoice</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Total Contract Value
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 block mt-0.5">
              {formatCurrency(project.totalAmount)}
            </span>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Total Cash Received
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 block mt-0.5">
              {formatCurrency(totalReceived)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
              {collectionRate}% collected
            </span>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Outstanding Balance
            </span>
            <span
              className={`text-xl sm:text-2xl font-black block mt-0.5 ${
                remainingBalance > 0 ? "text-amber-600" : "text-slate-400"
              }`}
            >
              {formatCurrency(remainingBalance)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {remainingBalance === 0 ? "Paid in full" : "Pending client payout"}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Payment History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Payment History</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {payments.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Individual payments recorded against this project.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all cursor-pointer"
          >
            + Add Payment Entry
          </button>
        </div>

        <PaymentHistoryTable
          payments={payments}
          onPaymentDeleted={handlePaymentDeleted}
        />
      </div>

      {/* Section 2: Invoices List */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Invoices</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {invoices.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Generated invoices for client billing and PDF export.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsInvoiceModalOpen(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200 transition-all cursor-pointer"
          >
            + Generate Invoice
          </button>
        </div>

        <InvoiceList
          invoices={invoices}
          onStatusChanged={(id, newStatus) =>
            setInvoices((prev) =>
              prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
            )
          }
          onInvoiceDeleted={(id) =>
            setInvoices((prev) => prev.filter((i) => i.id !== id))
          }
        />
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Record Incoming Payment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {project.name} • {project.client}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <AddPaymentForm
              projectId={project.id}
              onPaymentAdded={handlePaymentAdded}
              onClose={() => setIsPaymentModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Generate Invoice
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Creates an auto-numbered, printable invoice document.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {invoiceError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                ⚠️ {invoiceError}
              </div>
            )}

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Invoice Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-900"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setInvoiceAmount(remainingBalance.toString())}
                    className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 cursor-pointer"
                  >
                    Set to Outstanding Balance ({formatCurrency(remainingBalance)})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Notes / Deliverable Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Milestone 2 Deliverable: Dashboard & Responsive API Integration"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInvoicePending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isInvoicePending ? "Generating..." : "Generate & View Invoice ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
