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
        router.push(`/invoices/${created.id}`);
      } catch (err: any) {
        setInvoiceError(err?.message || "Failed to generate invoice.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <BackButton fallbackHref="/accounts" label="Back to Accounts" />

        <div className="flex items-center gap-2">
          <ExportCsvButton
            filename={`${project.name.toLowerCase().replace(/\s+/g, "_")}_payments`}
            data={paymentCsvData}
            label="Export Payments (CSV)"
          />
        </div>
      </div>

      {/* Project Financial Header */}
      <div className="bg-white p-6 rounded-lg border border-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-gray-500 block">
              {project.category} · Client Account
            </span>
            <h1 className="text-xl font-semibold text-ink tracking-tight">
              {project.name}
            </h1>
            <p className="text-[13px] text-gray-600">
              Client: <span className="font-medium text-ink">{project.client}</span>
              {project.clientEmail && ` (${project.clientEmail})`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-3.5 py-1.5 text-[13px] font-medium text-white bg-signal-green hover:bg-emerald-700 rounded-md transition-colors cursor-pointer"
            >
              + Record Payment
            </button>

            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="px-3.5 py-1.5 text-[13px] font-medium text-ink hover:text-accent bg-surface hover:bg-gray-100 border border-border rounded-md transition-colors cursor-pointer"
            >
              + Generate Invoice
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="bg-surface p-4 rounded-md border border-border">
            <span className="text-[11px] font-medium text-gray-500 block">
              Contract value
            </span>
            <span className="text-xl font-semibold text-ink block mt-0.5 tabular-nums">
              {formatCurrency(project.totalAmount)}
            </span>
          </div>

          <div className="bg-surface p-4 rounded-md border border-border">
            <span className="text-[11px] font-medium text-gray-500 block">
              Cash received
            </span>
            <span className="text-xl font-semibold text-signal-green block mt-0.5 tabular-nums">
              {formatCurrency(totalReceived)}
            </span>
            <span className="text-[11px] text-signal-green font-medium block mt-0.5 tabular-nums">
              {collectionRate}% collected
            </span>
          </div>

          <div className="bg-surface p-4 rounded-md border border-border">
            <span className="text-[11px] font-medium text-gray-500 block">
              Outstanding balance
            </span>
            <span
              className={`text-xl font-semibold block mt-0.5 tabular-nums ${
                remainingBalance > 0 ? "text-signal-amber" : "text-gray-400"
              }`}
            >
              {formatCurrency(remainingBalance)}
            </span>
            <span className="text-[11px] text-gray-400 block mt-0.5">
              {remainingBalance === 0 ? "Paid in full" : "Pending settlement"}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Payment History Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink tracking-tight flex items-center gap-2">
              <span>Payment History</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {payments.length}
              </span>
            </h2>
            <p className="text-[12px] text-gray-500">
              Individual payments recorded against this project.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="text-[12px] font-medium text-signal-green hover:underline cursor-pointer"
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
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink tracking-tight flex items-center gap-2">
              <span>Invoices</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {invoices.length}
              </span>
            </h2>
            <p className="text-[12px] text-gray-500">
              Generated invoices for client billing and PDF export.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsInvoiceModalOpen(true)}
            className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white max-w-md w-full p-6 rounded-lg border border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Record Incoming Payment
                </h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {project.name} · {project.client}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-ink text-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white max-w-md w-full p-6 rounded-lg border border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Generate Invoice
                </h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Creates an auto-numbered, printable invoice document.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-gray-400 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            {invoiceError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-signal-red text-[12px] font-medium rounded-md">
                {invoiceError}
              </div>
            )}

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Invoice Amount (₹) <span className="text-signal-red">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-semibold text-ink tabular-nums"
                />
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setInvoiceAmount(remainingBalance.toString())}
                    className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    Set to outstanding balance ({formatCurrency(remainingBalance)})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Notes / Deliverable Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Milestone 2 Deliverable: Dashboard & Responsive API Integration"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInvoicePending}
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isInvoicePending ? "Generating..." : "Generate & View"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
