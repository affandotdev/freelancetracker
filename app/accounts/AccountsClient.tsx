"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ExportCsvButton from "@/components/ExportCsvButton";
import { addPaymentAction } from "@/lib/actions";

export interface AccountProject {
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
  createdAt: string;
  updatedAt: string;
}

interface AccountsClientProps {
  initialProjects: AccountProject[];
}

export default function AccountsClient({ initialProjects }: AccountsClientProps) {
  const [projects, setProjects] = useState<AccountProject[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"All" | "Paid" | "Partial" | "Unpaid">("All");

  // Payment Recording Modal State
  const [selectedProject, setSelectedProject] = useState<AccountProject | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentNote, setPaymentNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Financial aggregates
  const totalContractValue = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
  }, [projects]);

  const totalReceivedValue = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.receivedAmount || 0), 0);
  }, [projects]);

  const totalPendingValue = useMemo(() => {
    return Math.max(0, totalContractValue - totalReceivedValue);
  }, [totalContractValue, totalReceivedValue]);

  const collectionRate = useMemo(() => {
    return totalContractValue > 0
      ? Math.round((totalReceivedValue / totalContractValue) * 100)
      : 0;
  }, [totalContractValue, totalReceivedValue]);

  // Filtering
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.clientEmail && p.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterTab === "Paid") return p.totalAmount > 0 && p.receivedAmount >= p.totalAmount;
      if (filterTab === "Partial")
        return p.receivedAmount > 0 && p.receivedAmount < p.totalAmount;
      if (filterTab === "Unpaid")
        return p.totalAmount > 0 && p.receivedAmount === 0;

      return true;
    });
  }, [projects, searchQuery, filterTab]);

  // CSV Export Data
  const ledgerCsvData = useMemo(() => {
    return filteredProjects.map((p) => ({
      "Client Name": p.client,
      "Client Email": p.clientEmail || "",
      "Project Name": p.name,
      "Category": p.category,
      "Contract Amount (INR)": p.totalAmount,
      "Received Amount (INR)": p.receivedAmount,
      "Outstanding Balance (INR)": p.balance,
      "Status": p.status,
      "Payment Status":
        p.totalAmount > 0 && p.receivedAmount >= p.totalAmount
          ? "Paid in Full"
          : p.receivedAmount > 0
          ? "Partially Paid"
          : "Unpaid",
    }));
  }, [filteredProjects]);

  const handleOpenPaymentModal = (project: AccountProject) => {
    setSelectedProject(project);
    setPaymentAmount(project.balance > 0 ? project.balance.toString() : "");
    setPaymentMethod("Bank Transfer");
    setPaymentNote("");
    setErrorMsg(null);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Please enter a valid payment amount greater than 0.");
      return;
    }

    startTransition(async () => {
      try {
        await addPaymentAction(
          selectedProject.id,
          amountNum,
          paymentMethod,
          paymentNote.trim() || null
        );
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === selectedProject.id) {
              const updatedReceived = p.receivedAmount + amountNum;
              return {
                ...p,
                receivedAmount: updatedReceived,
                balance: Math.max(0, p.totalAmount - updatedReceived),
              };
            }
            return p;
          })
        );
        setSelectedProject(null);
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to record payment.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <BackButton fallbackHref="/" label="Back to Dashboard" />
        <div className="flex items-center gap-2">
          <ExportCsvButton
            filename="accounts_ledger"
            data={ledgerCsvData}
            label="Export Ledger (CSV)"
          />
          <Link
            href="/projects/new"
            className="inline-flex items-center px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors"
          >
            + Add Project
          </Link>
        </div>
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Accounts & Financial Ledger
          </h1>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-border">
            Admin
          </span>
        </div>
        <p className="text-[13px] text-gray-500 mt-1">
          Complete breakdown of client billings, collected cash, pending receivables, and payment adjustments.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Total contracted
          </p>
          <p className="text-2xl font-semibold text-ink tracking-tight tabular-nums">
            {formatCurrency(totalContractValue)}
          </p>
          <p className="text-[12px] text-gray-400 mt-1 tabular-nums">
            Across {projects.length} contract{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Cash collected
          </p>
          <p className="text-2xl font-semibold text-signal-green tracking-tight tabular-nums">
            {formatCurrency(totalReceivedValue)}
          </p>
          <p className="text-[12px] text-signal-green font-medium mt-1 tabular-nums">
            {collectionRate}% collection rate
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Pending receivables
          </p>
          <p className="text-2xl font-semibold text-signal-amber tracking-tight tabular-nums">
            {formatCurrency(totalPendingValue)}
          </p>
          <p className="text-[12px] text-gray-400 mt-1">
            Awaiting client settlement
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Settlement ratio
          </p>
          <p className="text-2xl font-semibold text-ink tracking-tight tabular-nums">
            {collectionRate}%
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-accent h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-80 px-2">
          <input
            type="text"
            placeholder="Search by client or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-[13px] bg-transparent border-none focus:outline-none placeholder:text-gray-400 font-normal"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          {(["All", "Paid", "Partial", "Unpaid"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterTab === tab
                  ? "bg-ink text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab === "All" && `All (${projects.length})`}
              {tab === "Paid" && "Paid in Full"}
              {tab === "Partial" && "Partially Paid"}
              {tab === "Unpaid" && "Unpaid"}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Ledger Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-zebra">
            <thead>
              <tr className="bg-surface border-b border-border text-[11px] font-medium text-gray-500">
                <th className="py-3 px-4">Client & Contact</th>
                <th className="py-3 px-4">Project Title</th>
                <th className="py-3 px-4 text-right">Agreed Value</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Collection Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[13px]">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <p className="text-[13px] font-medium">No accounts found.</p>
                    <p className="text-[12px] mt-1">Try adjusting your search query or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const percentPaid =
                    p.totalAmount > 0
                      ? Math.min(100, Math.round((p.receivedAmount / p.totalAmount) * 100))
                      : 0;
                  const isFullyPaid = p.totalAmount > 0 && p.receivedAmount >= p.totalAmount;
                  const isPartial = p.receivedAmount > 0 && p.receivedAmount < p.totalAmount;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-ink">{p.client}</span>
                          {p.clientEmail && (
                            <span className="text-[11px] text-gray-400 font-normal">
                              {p.clientEmail}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Project Name */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/accounts/${p.id}`}
                          className="font-medium text-ink hover:text-accent transition-colors"
                        >
                          {p.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                          <span>{p.category}</span>
                          <span>·</span>
                          <Link
                            href={`/projects/${p.id}`}
                            className="hover:underline text-gray-500"
                          >
                            Workspace
                          </Link>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-medium text-ink tabular-nums">
                        {formatCurrency(p.totalAmount)}
                      </td>

                      {/* Received Amount */}
                      <td className="py-3.5 px-4 text-right font-medium text-signal-green tabular-nums">
                        {formatCurrency(p.receivedAmount)}
                      </td>

                      {/* Remaining Balance */}
                      <td className="py-3.5 px-4 text-right font-medium tabular-nums">
                        <span
                          className={
                            p.balance > 0
                              ? "text-signal-amber"
                              : "text-gray-400 font-normal"
                          }
                        >
                          {formatCurrency(p.balance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              isFullyPaid
                                ? "bg-emerald-50 text-signal-green border-emerald-200"
                                : isPartial
                                ? "bg-amber-50 text-signal-amber border-amber-200"
                                : "bg-rose-50 text-signal-red border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isFullyPaid
                                  ? "bg-signal-green"
                                  : isPartial
                                  ? "bg-signal-amber"
                                  : "bg-signal-red"
                              }`}
                            />
                            {isFullyPaid
                              ? "Paid in Full"
                              : isPartial
                              ? `Partial (${percentPaid}%)`
                              : "Unpaid"}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/accounts/${p.id}`}
                            className="px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-blue-50 border border-border rounded-md transition-colors"
                          >
                            History
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(p)}
                            className="px-2.5 py-1 text-[12px] font-medium text-signal-green hover:bg-emerald-50 border border-border rounded-md transition-colors cursor-pointer"
                          >
                            + Pay
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white max-w-md w-full p-6 rounded-lg border border-border shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Record Payment
                </h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {selectedProject.name} · {selectedProject.client}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="text-gray-400 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-signal-red text-[12px] font-medium rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="bg-surface p-3.5 rounded-md border border-border space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">Contract value:</span>
                <span className="font-semibold text-ink tabular-nums">
                  {formatCurrency(selectedProject.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">Previously received:</span>
                <span className="font-semibold text-signal-green tabular-nums">
                  {formatCurrency(selectedProject.receivedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-border">
                <span className="text-gray-500">Remaining balance:</span>
                <span className="font-semibold text-signal-amber tabular-nums">
                  {formatCurrency(selectedProject.balance)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Payment Amount (₹) <span className="text-signal-red">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 25000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-semibold text-ink tabular-nums"
                />
                {selectedProject.balance > 0 && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedProject.balance.toString())}
                      className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                    >
                      Fill remaining balance ({formatCurrency(selectedProject.balance)})
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-normal text-ink cursor-pointer"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Note / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milestone 1 settlement, UTR: 938210"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-normal text-ink"
                />
              </div>

              <div className="pt-1">
                <Link
                  href={`/accounts/${selectedProject.id}`}
                  className="text-[12px] font-medium text-accent hover:underline inline-flex items-center gap-1"
                >
                  View full payment history & invoices →
                </Link>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isPending ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
