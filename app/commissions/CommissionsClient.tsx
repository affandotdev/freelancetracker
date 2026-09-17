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
          className="inline-flex items-center px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors cursor-pointer"
        >
          + Add Commission
        </button>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Commission & Referral Management
          </h1>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-border">
            Admin
          </span>
        </div>
        <p className="text-[13px] text-gray-500 mt-1">
          Record referral payouts, lead finding percentages, and deal commissions owed to partners or team members.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Total commission
          </p>
          <p className="text-2xl font-semibold text-ink tracking-tight tabular-nums">
            {formatCurrency(totalCommission)}
          </p>
          <p className="text-[12px] text-gray-400 mt-1 tabular-nums">
            {commissions.length} recorded deal{commissions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Paid out
          </p>
          <p className="text-2xl font-semibold text-signal-green tracking-tight tabular-nums">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-[12px] text-signal-green font-medium mt-1">
            Disbursed settlements
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Pending payout
          </p>
          <p className="text-2xl font-semibold text-signal-amber tracking-tight tabular-nums">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-[12px] text-gray-400 mt-1">
            Owed to beneficiaries
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Beneficiaries
          </p>
          <p className="text-2xl font-semibold text-ink tracking-tight tabular-nums">
            {uniqueBeneficiaries}
          </p>
          <p className="text-[12px] text-gray-400 mt-1">
            Referrers & partners
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-3 rounded-lg border border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-80 px-2">
          <input
            type="text"
            placeholder="Search by person, project, notes..."
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
          {(["All", "Pending", "Paid"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? "bg-ink text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab === "All" && `All (${commissions.length})`}
              {tab === "Pending" && "Pending"}
              {tab === "Paid" && "Paid Out"}
            </button>
          ))}
        </div>
      </div>

      {/* Commissions Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-zebra">
            <thead>
              <tr className="bg-surface border-b border-border text-[11px] font-medium text-gray-500">
                <th className="py-3 px-4">Beneficiary</th>
                <th className="py-3 px-4">Linked Project</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[13px]">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <p className="text-[13px] font-medium">No commission records found.</p>
                    <p className="text-[12px] mt-1">
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
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Beneficiary */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-ink block">
                          {c.beneficiary}
                        </span>
                        <span className="text-[11px] text-gray-400 block mt-0.5 tabular-nums">
                          Added {new Date(c.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </td>

                      {/* Linked Project */}
                      <td className="py-3.5 px-4">
                        {c.projectId && c.projectName ? (
                          <Link
                            href={`/projects/${c.projectId}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {c.projectName}
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">General / Unlinked</span>
                        )}
                        {c.clientName && (
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            Client: {c.clientName}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-medium tabular-nums">
                        <div className="text-ink">
                          {formatCurrency(c.amount)}
                        </div>
                        {c.percentage && (
                          <span className="text-[11px] text-gray-500 block">
                            {c.percentage}% cut
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                            isPaid
                              ? "bg-emerald-50 text-signal-green border-emerald-200"
                              : "bg-amber-50 text-signal-amber border-amber-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPaid ? "bg-signal-green" : "bg-signal-amber"
                            }`}
                          />
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                        {isPaid && c.paidAt && (
                          <span className="text-[11px] text-gray-400 block mt-0.5 tabular-nums">
                            {new Date(c.paidAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-gray-600">
                        {c.notes || <span className="text-gray-300 italic">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleStatus(c)}
                            className={`px-2.5 py-1 text-[12px] font-medium rounded-md border transition-colors cursor-pointer ${
                              isPaid
                                ? "text-signal-amber bg-amber-50 hover:bg-amber-100 border-amber-200"
                                : "text-signal-green bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                            }`}
                          >
                            {isPaid ? "Mark Pending" : "Mark Paid"}
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteCommission(c.id, c.beneficiary)}
                            className="text-[12px] font-medium text-gray-400 hover:text-signal-red transition-colors"
                          >
                            Delete
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white max-w-md w-full p-6 rounded-lg border border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Add New Commission
                </h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Record who brought the work and their fee agreement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleCreateCommission} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Beneficiary Name <span className="text-signal-red">*</span>
                </label>
                <input
                  type="text"
                  name="beneficiary"
                  required
                  placeholder="e.g. John Doe, Rahul, Partner Agency"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-normal text-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Linked Project (Optional)
                </label>
                <select
                  name="projectId"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink cursor-pointer"
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
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-normal text-ink tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Commission Amount (₹) <span className="text-signal-red">*</span>
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
                    className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md font-semibold text-ink tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Payment Status
                </label>
                <select
                  name="status"
                  defaultValue="Pending"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink cursor-pointer"
                >
                  <option value="Pending">Pending (Not Paid Yet)</option>
                  <option value="Paid">Paid in Full</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Notes / Reference
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Client lead from LinkedIn; 10% on first milestone"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors cursor-pointer"
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
