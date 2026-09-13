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
      // Search
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.clientEmail && p.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Status filter
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
      {/* Top Bar with Back Button & Export */}
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-xs transition-all"
          >
            <span>+ Add Project</span>
          </Link>
        </div>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span>Accounts & Financial Ledger</span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            Super Admin
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Complete breakdown of client billings, collected cash, pending receivables, and payment adjustments.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Contracted
            </span>
            <span className="text-sm">💼</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(totalContractValue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Across {projects.length} client contract{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Cash Collected
            </span>
            <span className="text-sm">💰</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
            {formatCurrency(totalReceivedValue)}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
            {collectionRate}% collection rate
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pending Receivables
            </span>
            <span className="text-sm">⏳</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
            {formatCurrency(totalPendingValue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Awaiting client settlement
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Settlement Ratio
            </span>
            <span className="text-sm">📊</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {collectionRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <span className="text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by client or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs sm:text-sm bg-transparent border-none focus:outline-none placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(["All", "Paid", "Partial", "Unpaid"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                filterTab === tab
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {tab === "All" && `All Accounts (${projects.length})`}
              {tab === "Paid" && "Paid in Full"}
              {tab === "Partial" && "Partially Paid"}
              {tab === "Unpaid" && "Unpaid"}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Ledger Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Client & Contact</th>
                <th className="py-3.5 px-5">Project Title</th>
                <th className="py-3.5 px-4 text-right">Agreed Value</th>
                <th className="py-3.5 px-4 text-right">Received</th>
                <th className="py-3.5 px-4 text-right">Balance</th>
                <th className="py-3.5 px-5 text-center">Collection Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No accounts found.</p>
                    <p className="text-xs mt-1">Try adjusting your search query or filters.</p>
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
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Client */}
                      <td className="py-4 px-5 font-semibold text-slate-900">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{p.client}</span>
                          {p.clientEmail && (
                            <span className="text-[11px] text-slate-400 font-normal mt-0.5">
                              {p.clientEmail}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Project Name */}
                      <td className="py-4 px-5">
                        <Link
                          href={`/accounts/${p.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5 group/link"
                        >
                          <span>{p.name}</span>
                          <span className="text-slate-300 group-hover/link:text-blue-500 font-black">
                            ↗
                          </span>
                        </Link>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                          <span>{p.category}</span>
                          <span>•</span>
                          <Link
                            href={`/projects/${p.id}`}
                            className="hover:underline text-slate-500"
                          >
                            Project Workspace
                          </Link>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 text-right font-black text-slate-900">
                        {formatCurrency(p.totalAmount)}
                      </td>

                      {/* Received Amount */}
                      <td className="py-4 px-4 text-right font-black text-emerald-600">
                        {formatCurrency(p.receivedAmount)}
                      </td>

                      {/* Remaining Balance */}
                      <td className="py-4 px-4 text-right font-black">
                        <span
                          className={
                            p.balance > 0
                              ? "text-amber-600"
                              : "text-slate-400 font-normal"
                          }
                        >
                          {formatCurrency(p.balance)}
                        </span>
                      </td>

                      {/* Progress & Badge */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                              isFullyPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isPartial
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {isFullyPaid
                              ? "Paid in Full"
                              : isPartial
                              ? `Partial (${percentPaid}%)`
                              : "Unpaid"}
                          </span>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                isFullyPaid
                                  ? "bg-emerald-500"
                                  : isPartial
                                  ? "bg-amber-500"
                                  : "bg-rose-400"
                              }`}
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/accounts/${p.id}`}
                            className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-200 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>History & Invoices</span>
                            <span>→</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(p)}
                            className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-xl transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Record / Update Payment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedProject.name} • {selectedProject.client}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Contract Value:</span>
                <span className="font-extrabold text-slate-900">
                  {formatCurrency(selectedProject.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Previously Received:</span>
                <span className="font-extrabold text-emerald-600">
                  {formatCurrency(selectedProject.receivedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Current Balance:</span>
                <span className="font-extrabold text-amber-600">
                  {formatCurrency(selectedProject.balance)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Amount to Record (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 25000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-900"
                />
                {selectedProject.balance > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedProject.balance.toString())}
                      className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 cursor-pointer"
                    >
                      Fill Remaining Balance ({formatCurrency(selectedProject.balance)})
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Note / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milestone 1 settlement, UTR: 938210"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="pt-1 text-center">
                <Link
                  href={`/accounts/${selectedProject.id}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>View full payment history & invoices for this project</span>
                  <span>→</span>
                </Link>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
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
