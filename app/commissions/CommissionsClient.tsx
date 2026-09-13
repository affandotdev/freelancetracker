"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import {
  createCommissionAction,
  updateCommissionStatusAction,
  deleteCommissionAction,
} from "@/lib/actions";

export interface CommissionItem {
  id: string;
  beneficiary: string;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  projectAmount: number | null;
  amount: number;
  percentage: number | null;
  status: "Pending" | "Paid" | string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client: string | null;
  totalAmount: number;
}

interface CommissionsClientProps {
  initialCommissions: CommissionItem[];
  projects: ProjectOption[];
}

export default function CommissionsClient({
  initialCommissions,
  projects,
}: CommissionsClientProps) {
  const [commissions, setCommissions] = useState<CommissionItem[]>(initialCommissions);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Paid">("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [percentageInput, setPercentageInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // KPIs
  const totalCommission = useMemo(() => {
    return commissions.reduce((acc, c) => acc + (c.amount || 0), 0);
  }, [commissions]);

  const totalPaid = useMemo(() => {
    return commissions
      .filter((c) => c.status === "Paid")
      .reduce((acc, c) => acc + (c.amount || 0), 0);
  }, [commissions]);

  const totalPending = useMemo(() => {
    return commissions
      .filter((c) => c.status !== "Paid")
      .reduce((acc, c) => acc + (c.amount || 0), 0);
  }, [commissions]);

  const uniqueBeneficiaries = useMemo(() => {
    return new Set(commissions.map((c) => c.beneficiary.trim().toLowerCase())).size;
  }, [commissions]);

  // Filtering
  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.beneficiary.toLowerCase().includes(q) ||
        (c.projectName && c.projectName.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === "Pending") return c.status !== "Paid";
      if (statusFilter === "Paid") return c.status === "Paid";

      return true;
    });
  }, [commissions, searchQuery, statusFilter]);

  // Handle Project selection to auto-calculate amount if percentage is set
  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    if (projId !== "none" && percentageInput) {
      const proj = projects.find((p) => p.id === projId);
      if (proj && proj.totalAmount > 0) {
        const pct = parseFloat(percentageInput);
        if (!isNaN(pct)) {
          setAmountInput(Math.round((proj.totalAmount * pct) / 100).toString());
        }
      }
    }
  };

  const handlePercentageChange = (pctStr: string) => {
    setPercentageInput(pctStr);
    const pct = parseFloat(pctStr);
    if (!isNaN(pct) && selectedProjectId !== "none") {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj && proj.totalAmount > 0) {
        setAmountInput(Math.round((proj.totalAmount * pct) / 100).toString());
      }
    }
  };

  const handleCreateCommission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const created = await createCommissionAction(formData);
        const linkedProj = projects.find((p) => p.id === created.projectId);

        setCommissions((prev) => [
          {
            id: created.id,
            beneficiary: created.beneficiary,
            projectId: created.projectId,
            projectName: linkedProj?.name || null,
            clientName: linkedProj?.client || null,
            projectAmount: linkedProj?.totalAmount || null,
            amount: created.amount,
            percentage: created.percentage,
            status: created.status,
            notes: created.notes,
            paidAt: created.paidAt ? created.paidAt.toISOString() : null,
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
          },
          ...prev,
        ]);
        setIsModalOpen(false);
        setPercentageInput("");
        setAmountInput("");
        setSelectedProjectId("none");
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to create commission record.");
      }
    });
  };

  const handleToggleStatus = async (item: CommissionItem) => {
    const nextStatus = item.status === "Paid" ? "Pending" : "Paid";

    startTransition(async () => {
      try {
        await updateCommissionStatusAction(item.id, nextStatus as any);
        setCommissions((prev) =>
          prev.map((c) =>
            c.id === item.id
              ? {
                  ...c,
                  status: nextStatus,
                  paidAt: nextStatus === "Paid" ? new Date().toISOString() : null,
                }
              : c
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to update status.");
      }
    });
  };

  const handleDeleteCommission = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the commission record for "${name}"?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteCommissionAction(id);
        setCommissions((prev) => prev.filter((c) => c.id !== id));
      } catch (err: any) {
        alert(err?.message || "Failed to delete commission.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <BackButton fallbackHref="/" label="Back to Dashboard" />
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer"
        >
          <span>+ Add Commission</span>
        </button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span>Commission & Referral Management</span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Super Admin
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Record referral payouts, lead finding percentages, and deal commissions owed to partners or team members.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Commission
            </span>
            <span className="text-sm">🤝</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(totalCommission)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {commissions.length} recorded deal{commissions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Paid Out
            </span>
            <span className="text-sm">✅</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
            Disbursed settlements
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pending Payout
            </span>
            <span className="text-sm">⏳</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Owed to beneficiaries
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Beneficiaries
            </span>
            <span className="text-sm">👥</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 tracking-tight">
            {uniqueBeneficiaries}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Referrers & partners
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <span className="text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by person, project, notes..."
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
          {(["All", "Pending", "Paid"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {tab === "All" && `All Commissions (${commissions.length})`}
              {tab === "Pending" && "Pending Payout"}
              {tab === "Paid" && "Paid Out"}
            </button>
          ))}
        </div>
      </div>

      {/* Commissions Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Beneficiary / Person</th>
                <th className="py-3.5 px-5">Linked Project</th>
                <th className="py-3.5 px-4 text-right">Commission Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Notes / Agreement</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No commission records found.</p>
                    <p className="text-xs mt-1">
                      Click &quot;+ Add Commission&quot; to log a referral or sales commission.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((c) => {
                  const isPaid = c.status === "Paid";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Beneficiary */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-100 to-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-300/60">
                            {c.beneficiary.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {c.beneficiary}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Added {new Date(c.createdAt).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Linked Project */}
                      <td className="py-4 px-5">
                        {c.projectId && c.projectName ? (
                          <Link
                            href={`/projects/${c.projectId}`}
                            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                          >
                            <span>{c.projectName}</span>
                            <span className="text-slate-300 font-black">↗</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic">General / Unlinked</span>
                        )}
                        {c.clientName && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Client: {c.clientName}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-black text-sm text-slate-900">
                          {formatCurrency(c.amount)}
                        </div>
                        {c.percentage && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100 inline-block mt-0.5">
                            {c.percentage}% cut
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                        {isPaid && c.paidAt && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {new Date(c.paidAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-4 max-w-xs truncate text-slate-600">
                        {c.notes || <span className="text-slate-300 italic">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleStatus(c)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              isPaid
                                ? "text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                                : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                            }`}
                          >
                            {isPaid ? "Mark Pending" : "Mark Paid ✓"}
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteCommission(c.id, c.beneficiary)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete"
                          >
                            🗑️
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

      {/* Add Commission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Add New Commission
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record who brought the work and their fee agreement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleCreateCommission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Beneficiary Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="beneficiary"
                  required
                  placeholder="e.g. John Doe, Rahul, Partner Agency"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Linked Project (Optional)
                </label>
                <select
                  name="projectId"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="none">-- General / No Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    name="percentage"
                    value={percentageInput}
                    onChange={(e) => handlePercentageChange(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Commission Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    name="amount"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Status
                </label>
                <select
                  name="status"
                  defaultValue="Pending"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="Pending">Pending (Not Paid Yet)</option>
                  <option value="Paid">Paid in Full</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Notes / Reference
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Client lead from LinkedIn; 10% on first milestone"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isPending ? "Creating..." : "Save Commission"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
