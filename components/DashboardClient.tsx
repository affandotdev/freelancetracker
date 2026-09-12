"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { deleteProjectAction } from "@/lib/actions";
import {
  getProjectDuration,
  formatDeadlineDate,
  DurationInfo,
} from "@/lib/dateUtils";

interface Project {
  id: string;
  name: string;
  client: string | null;
  clientEmail: string | null;
  category: string | null;
  priority: string;
  status: string;
  progress: number;
  totalAmount: number;
  receivedAmount: number;
  deadline: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardClientProps {
  initialProjects: Project[];
}

export default function DashboardClient({
  initialProjects,
}: DashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updated-desc");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Delete modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Financial calculations
  const totalRevenue = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [projects]);

  const totalReceived = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.receivedAmount || 0), 0);
  }, [projects]);

  const totalPending = useMemo(() => {
    return Math.max(0, totalRevenue - totalReceived);
  }, [totalRevenue, totalReceived]);

  const activeCount = useMemo(() => {
    return projects.filter((p) => p.status === "In Progress").length;
  }, [projects]);

  const upcomingCount = useMemo(() => {
    return projects.filter((p) => p.status === "Planning" || p.status === "Upcoming").length;
  }, [projects]);

  const upcomingFixedAmount = useMemo(() => {
    return projects
      .filter((p) => p.status === "Planning" || p.status === "Upcoming")
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [projects]);

  const enquiryCount = useMemo(() => {
    return projects.filter((p) => p.status === "Enquiry" || p.status === "Enquired").length;
  }, [projects]);

  const enquiryPotential = useMemo(() => {
    return projects
      .filter((p) => p.status === "Enquiry" || p.status === "Enquired")
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [projects]);

  const overdueCount = useMemo(() => {
    if (!mounted) return 0;
    return projects.filter((p) => {
      if (!p.deadline || p.status === "Completed") return false;
      const duration = getProjectDuration(p.deadline, p.status, mounted);
      return duration.statusType === "overdue";
    }).length;
  }, [projects, mounted]);

  const dueSoonCount = useMemo(() => {
    if (!mounted) return 0;
    return projects.filter((p) => {
      if (!p.deadline || p.status === "Completed") return false;
      const duration = getProjectDuration(p.deadline, p.status, mounted);
      return duration.statusType === "urgent" || duration.statusType === "today";
    }).length;
  }, [projects, mounted]);

  // Filtering & Sorting
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.client && p.client.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      if (statusFilter === "Enquiry") {
        list = list.filter((p) => p.status === "Enquiry" || p.status === "Enquired");
      } else if (statusFilter === "Planning" || statusFilter === "Upcoming") {
        list = list.filter((p) => p.status === "Planning" || p.status === "Upcoming");
      } else {
        list = list.filter((p) => p.status === statusFilter);
      }
    }

    // Payment filter
    if (paymentFilter !== "All") {
      list = list.filter((p) => {
        const total = p.totalAmount || 0;
        const rec = p.receivedAmount || 0;
        if (paymentFilter === "Paid") return total > 0 && rec >= total;
        if (paymentFilter === "Partially Paid") return rec > 0 && rec < total;
        if (paymentFilter === "Unpaid") return total > 0 && rec === 0;
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case "amount-desc":
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case "progress-desc":
          return b.progress - a.progress;
        case "deadline-asc": {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return list;
  }, [projects, searchQuery, statusFilter, paymentFilter, sortBy]);

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);

    try {
      await deleteProjectAction(projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            Urgent
          </span>
        );
      case "High":
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            High
          </span>
        );
      case "Low":
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            Low
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            Medium
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Enquiry":
      case "Enquired":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
            <span>💡</span> Enquiry (Lead)
          </span>
        );
      case "Planning":
      case "Upcoming":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
            <span>🗓️</span> Upcoming (Fixed)
          </span>
        );
      case "Completed":
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        );
      case "In Progress":
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            In Progress
          </span>
        );
      case "On Hold":
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            On Hold
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Not Started
          </span>
        );
    }
  };

  const getPaymentBadge = (total: number, rec: number) => {
    if (total === 0) return null;
    if (rec >= total) {
      return (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          Paid in Full
        </span>
      );
    }
    if (rec > 0) {
      return (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
          Partially Paid
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
        Unpaid
      </span>
    );
  };

  const getDurationBadge = (duration: DurationInfo, status: string) => {
    if (status === "Completed") {
      return (
        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✓ Completed
        </span>
      );
    }

    if (duration.statusType === "none") {
      return (
        <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-400 border border-slate-200">
          ⏳ No deadline
        </span>
      );
    }

    switch (duration.statusType) {
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
            ⚠️ {duration.label}
          </span>
        );
      case "today":
        return (
          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            🔥 {duration.label}
          </span>
        );
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
            ⏳ {duration.label}
          </span>
        );
      case "planning":
        return (
          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-200">
            🚀 {duration.label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
            ⏱️ {duration.label}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header with Add CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Projects & Finances
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track client deliverables, contracted amounts, and collected revenue
          </p>
        </div>

        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
        >
          <span>+ Add New Project</span>
        </Link>
      </div>

      {/* 2. Financial & Project KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Total Pipeline
          </p>
          <p
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold text-slate-900"
          >
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {projects.length} project{projects.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* Total Received */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            Received Cash
          </p>
          <p
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold text-emerald-700"
          >
            {formatCurrency(totalReceived)}
          </p>
          <p className="text-[11px] text-emerald-600/80 mt-1">
            {totalRevenue > 0
              ? `${Math.round((totalReceived / totalRevenue) * 100)}% collected`
              : "0% collected"}
          </p>
        </div>

        {/* Total Pending */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-2xs bg-gradient-to-br from-white to-amber-50/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
            Pending Amount
          </p>
          <p
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold text-amber-700"
          >
            {formatCurrency(totalPending)}
          </p>
          <p className="text-[11px] text-amber-600/80 mt-1">
            Outstanding balance
          </p>
        </div>

        {/* Active Projects & Deadlines */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-2xs bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between gap-1 mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Active Deliverables
            </p>
            {mounted && overdueCount > 0 && (
              <span
                suppressHydrationWarning
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {overdueCount} overdue
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-700">
            {activeCount}
          </p>
          <p className="text-[11px] text-blue-600/80 mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Currently In Progress</span>
            {mounted && dueSoonCount > 0 && (
              <span
                suppressHydrationWarning
                className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded"
              >
                • {dueSoonCount} due soon
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Enquiry Leads Notification Banner */}
      {enquiryCount > 0 && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
              💡
            </div>
            <div>
              <p className="text-xs font-bold text-purple-900">
                You have {enquiryCount} prospective project enquir{enquiryCount === 1 ? "y" : "ies"}
              </p>
              <p className="text-[11px] text-purple-700">
                {enquiryPotential > 0 ? `${formatCurrency(enquiryPotential)} estimated value • ` : ""}
                Leads not yet onboarded to active work
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "Enquiry" ? "All" : "Enquiry")}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            {statusFilter === "Enquiry" ? "Show All Work" : "View Enquiries"}
          </button>
        </div>
      )}

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by project name, client, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="updated-desc">Recently Updated</option>
            <option value="amount-desc">Amount: High to Low</option>
            <option value="progress-desc">Progress: High to Low</option>
            <option value="deadline-asc">Deadline: Earliest First</option>
          </select>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Status:</span>
          {["All", "In Progress", "Planning", "Enquiry", "Not Started", "On Hold", "Completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === s
                  ? s === "Enquiry"
                    ? "bg-purple-600 text-white"
                    : s === "Planning"
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-900 text-white"
                  : s === "Enquiry"
                  ? "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                  : s === "Planning"
                  ? "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "Enquiry" && <span>💡</span>}
              {s === "Planning" && <span>🗓️</span>}
              <span>{s === "Enquiry" ? "Enquiries" : s === "Planning" ? "Upcoming" : s}</span>
              {s === "Enquiry" && enquiryCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === "Enquiry"
                      ? "bg-white text-purple-700"
                      : "bg-purple-200 text-purple-800"
                  }`}
                >
                  {enquiryCount}
                </span>
              )}
              {s === "Planning" && upcomingCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === "Planning"
                      ? "bg-white text-cyan-700"
                      : "bg-cyan-200 text-cyan-800"
                  }`}
                >
                  {upcomingCount}
                </span>
              )}
            </button>
          ))}

          <span className="text-slate-400 font-semibold ml-auto mr-1">Payment:</span>
          {["All", "Paid", "Partially Paid", "Unpaid"].map((p) => (
            <button
              key={p}
              onClick={() => setPaymentFilter(p)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                paymentFilter === p
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Projects Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            📁
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {projects.length === 0 ? "No Projects Added Yet" : "No Matches Found"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {projects.length === 0
              ? "Create your first freelance project to start tracking deadlines, milestones, and cashflow."
              : "Try clearing your search query or filter parameters to see all projects."}
          </p>
          {projects.length === 0 ? (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              + Create Your First Project
            </Link>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("All");
                setPaymentFilter("All");
              }}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProjects.map((p) => {
            const isEnquiry = p.status === "Enquiry" || p.status === "Enquired";
            const isUpcoming = p.status === "Planning" || p.status === "Upcoming";
            const pending = Math.max(0, (p.totalAmount || 0) - (p.receivedAmount || 0));
            const paymentPct =
              p.totalAmount > 0
                ? Math.min(100, Math.round(((p.receivedAmount || 0) / p.totalAmount) * 100))
                : 0;

            const duration = getProjectDuration(p.deadline, p.status, mounted);
            const isOverdue = duration.statusType === "overdue";

            return (
              <div
                key={p.id}
                className={`group relative bg-white rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between border ${
                  isOverdue
                    ? "border-rose-300 hover:border-rose-400 bg-gradient-to-b from-rose-50/20 to-white"
                    : isEnquiry
                    ? "border-purple-200 hover:border-purple-400 bg-gradient-to-b from-purple-50/25 to-white"
                    : isUpcoming
                    ? "border-cyan-200 hover:border-cyan-400 bg-gradient-to-b from-cyan-50/25 to-white"
                    : "border-slate-200 hover:border-blue-400/80"
                }`}
              >
                {/* Top Row: Category + Priority + Direct Delete */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {p.category || "General"}
                      </span>
                      {getPriorityBadge(p.priority)}
                      {getStatusBadge(p.status)}
                      {isOverdue && (
                        <span
                          suppressHydrationWarning
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Quick Card Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(p);
                      }}
                      title="Delete project"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Title & Client */}
                  <Link href={`/projects/${p.id}`} className="block group-hover:underline">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">
                      {p.name}
                    </h2>
                  </Link>

                  {p.client && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Client: <span className="font-semibold text-slate-700">{p.client}</span>
                    </p>
                  )}

                  {p.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Bottom Section: Progress & Financials */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                  {/* Work Progress Bar or Enquiry Lead / Upcoming Status */}
                  {isEnquiry ? (
                    <div className="p-3 bg-purple-50/80 border border-purple-100 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">
                          💡 Uncommitted Enquiry
                        </span>
                        <span className="text-[10px] text-purple-700 block">
                          Awaiting client confirmation & onboarding
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-200/80 text-purple-800 shrink-0">
                        Lead
                      </span>
                    </div>
                  ) : isUpcoming ? (
                    <div className="p-3 bg-cyan-50/80 border border-cyan-100 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-cyan-900 block">
                          🗓️ Upcoming / Planning Phase
                        </span>
                        <span className="text-[10px] text-cyan-700 block">
                          Fixed contract agreed • Ready for kickoff
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-200/80 text-cyan-800 shrink-0">
                        Upcoming
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 mb-1">
                        <span>Work Progress</span>
                        <span className="text-slate-800 font-bold">{p.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            p.status === "Completed"
                              ? "bg-emerald-500"
                              : p.progress > 60
                              ? "bg-blue-600"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Financial Breakdown */}
                  {p.totalAmount > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          {isEnquiry
                            ? "Quoted Budget"
                            : isUpcoming
                            ? "Fixed Agreed Amount"
                            : "Contract Value"}
                        </div>
                        <div
                          suppressHydrationWarning
                          className="text-xs font-extrabold text-slate-900"
                        >
                          {formatCurrency(p.totalAmount)}
                          {!isEnquiry && p.receivedAmount > 0 && (
                            <span className="text-emerald-600 font-semibold">
                              {" "}• {formatCurrency(p.receivedAmount)} {isUpcoming ? "advance" : "received"}
                            </span>
                          )}
                        </div>
                        {!isEnquiry && !isUpcoming && pending > 0 && (
                          <div
                            suppressHydrationWarning
                            className="text-[10px] text-slate-400"
                          >
                            {formatCurrency(pending)} pending
                          </div>
                        )}
                        {isUpcoming && (
                          <div className="text-[10px] text-cyan-700">
                            {p.receivedAmount > 0
                              ? `${formatCurrency(p.receivedAmount)} advance paid`
                              : "Awaiting kickoff deposit"}
                          </div>
                        )}
                        {isEnquiry && (
                          <div className="text-[10px] text-purple-600">
                            Estimated quote • Not billed
                          </div>
                        )}
                      </div>
                      <div>
                        {isEnquiry ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                            Estimate
                          </span>
                        ) : isUpcoming ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-700">
                            Fixed
                          </span>
                        ) : (
                          getPaymentBadge(p.totalAmount, p.receivedAmount || 0)
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deadline & Duration Left + Details Link */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.deadline ? (
                        <>
                          <span
                            suppressHydrationWarning
                            className="text-slate-500 font-medium flex items-center gap-1"
                          >
                            <span>{isUpcoming ? "🗓️ Kickoff:" : "📅"}</span>
                            <span>{formatDeadlineDate(p.deadline)}</span>
                          </span>
                          <span suppressHydrationWarning>
                            {getDurationBadge(duration, p.status)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <span>⏳</span>
                          <span>No deadline set</span>
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/projects/${p.id}`}
                      className={`font-bold hover:underline shrink-0 ${
                        isEnquiry
                          ? "text-purple-600 hover:text-purple-700"
                          : isUpcoming
                          ? "text-cyan-600 hover:text-cyan-700"
                          : "text-blue-600 hover:text-blue-700"
                      }`}
                    >
                      {isEnquiry
                        ? "Review & Onboard →"
                        : isUpcoming
                        ? "Plan & Kickoff →"
                        : "View Details →"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Direct Card Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900">Delete Project?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900">&quot;{projectToDelete.name}&quot;</strong>?
              This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
