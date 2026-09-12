"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { deleteProjectAction, updateProjectAction } from "@/lib/actions";
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

type ViewMode = "grid" | "kanban" | "table";

export default function DashboardClient({
  initialProjects,
}: DashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'In Progress' | 'Enquiry' | 'Planning' | 'Completed'
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updated-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Deletion modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // Load saved view mode preference
    const saved = localStorage.getItem("workplan_view_mode") as ViewMode | null;
    if (saved && (saved === "grid" || saved === "kanban" || saved === "table")) {
      setViewMode(saved);
    }
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("workplan_view_mode", mode);
    }
  };

  // Financial & Pipeline Calculations
  const totalRevenue = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [projects]);

  const totalReceived = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.receivedAmount || 0), 0);
  }, [projects]);

  const totalPending = useMemo(() => {
    return Math.max(0, totalRevenue - totalReceived);
  }, [totalRevenue, totalReceived]);

  const collectionRate = useMemo(() => {
    return totalRevenue > 0 ? Math.round((totalReceived / totalRevenue) * 100) : 0;
  }, [totalRevenue, totalReceived]);

  // Counts by status
  const activeCount = useMemo(() => {
    return projects.filter((p) => p.status === "In Progress").length;
  }, [projects]);

  const upcomingCount = useMemo(() => {
    return projects.filter((p) => p.status === "Planning" || p.status === "Upcoming").length;
  }, [projects]);

  const enquiryCount = useMemo(() => {
    return projects.filter((p) => p.status === "Enquiry" || p.status === "Enquired").length;
  }, [projects]);

  const completedCount = useMemo(() => {
    return projects.filter((p) => p.status === "Completed").length;
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

    // Active workflow tab
    if (activeTab !== "all") {
      if (activeTab === "Enquiry") {
        list = list.filter((p) => p.status === "Enquiry" || p.status === "Enquired");
      } else if (activeTab === "Planning") {
        list = list.filter((p) => p.status === "Planning" || p.status === "Upcoming");
      } else {
        list = list.filter((p) => p.status === activeTab);
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
  }, [projects, searchQuery, activeTab, paymentFilter, sortBy]);

  // Quick inline status advance
  const handleQuickStatusChange = async (projectId: string, newStatus: string) => {
    setUpdatingId(projectId);
    try {
      const nextProgress = newStatus === "Completed" ? 100 : undefined;
      await updateProjectAction(projectId, {
        status: newStatus,
        progress: nextProgress,
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                status: newStatus,
                progress: nextProgress !== undefined ? nextProgress : p.progress,
              }
            : p
        )
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

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

  const getInitials = (name: string | null) => {
    if (!name) return "CL";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (name: string | null) => {
    const colors = [
      "bg-blue-100 text-blue-700 border-blue-200",
      "bg-purple-100 text-purple-700 border-purple-200",
      "bg-emerald-100 text-emerald-700 border-emerald-200",
      "bg-amber-100 text-amber-700 border-amber-200",
      "bg-rose-100 text-rose-700 border-rose-200",
      "bg-cyan-100 text-cyan-700 border-cyan-200",
      "bg-indigo-100 text-indigo-700 border-indigo-200",
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
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
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            Medium
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        );
      case "Planning":
      case "Upcoming":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Upcoming / Plan
          </span>
        );
      case "Enquiry":
      case "Enquired":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Enquiry Lead
          </span>
        );
      case "In Progress":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
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

  const getPaymentBadge = (total: number, rec: number) => {
    if (total === 0) return null;
    if (rec >= total) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          Paid in Full
        </span>
      );
    }
    if (rec > 0) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
          Partially Paid
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
        Unpaid
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Projects & Cashflow</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Live overview of client deliverables, agreed fees, deadlines, and collected revenue
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg transition-all cursor-pointer"
          >
            <span>+ Add New Project</span>
          </Link>
        </div>
      </div>

      {/* 2. Interactive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            setPaymentFilter("All");
          }}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeTab === "all" && paymentFilter === "All"
              ? "bg-white border-blue-500 shadow-md ring-2 ring-blue-500/10"
              : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Pipeline
            </span>
            <span className="text-sm">💼</span>
          </div>
          <p
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
          >
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
            <span>Across {projects.length} project{projects.length === 1 ? "" : "s"}</span>
            <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
              View all →
            </span>
          </p>
        </button>

        {/* Total Received */}
        <button
          type="button"
          onClick={() => {
            setPaymentFilter(paymentFilter === "Paid" ? "All" : "Paid");
          }}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group bg-gradient-to-br from-white to-emerald-50/30 ${
            paymentFilter === "Paid"
              ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/10"
              : "border-emerald-100 hover:border-emerald-200 shadow-2xs hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Received Cash
            </span>
            <span className="text-sm">💰</span>
          </div>
          <p
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight"
          >
            {formatCurrency(totalReceived)}
          </p>
          <div className="mt-2 space-y-1">
            <div className="w-full bg-emerald-100/70 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <p className="text-[10px] text-emerald-700 font-medium flex justify-between">
              <span>{collectionRate}% Collected</span>
              <span className="font-semibold">Filter paid →</span>
            </p>
          </div>
        </button>

        {/* Pending Amount */}
        <button
          type="button"
          onClick={() => {
            setPaymentFilter(paymentFilter === "Unpaid" ? "All" : "Unpaid");
          }}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group bg-gradient-to-br from-white to-amber-50/30 ${
            paymentFilter === "Unpaid" || paymentFilter === "Partially Paid"
              ? "border-amber-500 shadow-md ring-2 ring-amber-500/10"
              : "border-amber-100 hover:border-amber-200 shadow-2xs hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Pending Balance
            </span>
            <span className="text-sm">⏳</span>
          </div>
          <p
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight"
          >
            {formatCurrency(totalPending)}
          </p>
          <p className="text-[11px] text-amber-700/80 mt-1.5 flex items-center justify-between">
            <span>Outstanding revenue</span>
            <span className="font-semibold group-hover:translate-x-0.5 transition-transform">
              Filter unpaid →
            </span>
          </p>
        </button>

        {/* Active Deliverables & Timelines */}
        <button
          type="button"
          onClick={() => {
            setActiveTab(activeTab === "In Progress" ? "all" : "In Progress");
          }}
          className={`text-left p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group bg-gradient-to-br from-white to-blue-50/30 ${
            activeTab === "In Progress"
              ? "border-blue-500 shadow-md ring-2 ring-blue-500/10"
              : "border-blue-100 hover:border-blue-200 shadow-2xs hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Active Deliverables
            </span>
            {mounted && overdueCount > 0 ? (
              <span
                suppressHydrationWarning
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {overdueCount} overdue
              </span>
            ) : (
              <span className="text-sm">⚡</span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-700 tracking-tight">
            {activeCount}
          </p>
          <p className="text-[11px] text-blue-700/80 mt-1.5 flex items-center justify-between">
            <span>Currently in progress</span>
            {mounted && dueSoonCount > 0 ? (
              <span className="font-bold text-amber-700">
                {dueSoonCount} due soon
              </span>
            ) : (
              <span className="font-semibold">Filter active →</span>
            )}
          </p>
        </button>
      </div>

      {/* 3. Notification Banners */}
      {enquiryCount > 0 && activeTab !== "Enquiry" && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
              💡
            </div>
            <div>
              <p className="text-xs font-bold text-purple-950">
                You have {enquiryCount} prospective project enquiry{enquiryCount === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Potential leads waiting for onboarding and contract commitment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("Enquiry")}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Review Enquiries ({enquiryCount}) →
          </button>
        </div>
      )}

      {/* 4. Controls Toolbar: Tabs, Search, Filters, View Modes */}
      <div className="space-y-4">
        {/* Workflow Segmented Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 scrollbar-none">
          {[
            { id: "all", label: "All Projects", count: projects.length },
            { id: "In Progress", label: "⚡ In Progress", count: activeCount },
            { id: "Enquiry", label: "💡 Leads & Enquiries", count: enquiryCount },
            { id: "Planning", label: "🗓️ Upcoming / Planning", count: upcomingCount },
            { id: "Completed", label: "✅ Completed", count: completedCount },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Filter Dropdowns, and View Switcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by project name, client, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right controls: Payment filter, Sort, and View Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs text-slate-700"
            >
              <option value="All">💳 All Payments</option>
              <option value="Paid">Paid in Full</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs text-slate-700"
            >
              <option value="updated-desc">🕒 Recently Updated</option>
              <option value="deadline-asc">📅 Deadline: Earliest First</option>
              <option value="amount-desc">💰 Highest Value</option>
              <option value="progress-desc">📈 Most Completed</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-200/80 rounded-xl gap-0.5 border border-slate-300/60">
              <button
                type="button"
                onClick={() => handleViewChange("grid")}
                title="Grid Cards View"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "grid"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🗂️</span>
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("kanban")}
                title="Kanban Pipeline Board"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "kanban"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>📋</span>
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("table")}
                title="Table View"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>📑</span>
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Projects Content: Empty State, Grid View, Kanban View, or Table View */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 font-bold text-2xl">
            📁
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {projects.length === 0 ? "No Projects Added Yet" : "No Matches Found"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
            {projects.length === 0
              ? "Create your first freelance project to start tracking deadlines, milestones, and cashflow in Indian Rupees."
              : "No projects match your current filters or search query. Try clearing your search or switching tabs."}
          </p>
          {projects.length === 0 ? (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <span>+ Create First Project</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
                setPaymentFilter("All");
              }}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ==================== VIEW 1: GRID CARDS ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                className={`group relative bg-white rounded-3xl p-5 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between border ${
                  isOverdue
                    ? "border-rose-300/90 hover:border-rose-400 bg-gradient-to-b from-rose-50/20 to-white ring-1 ring-rose-300/30"
                    : isEnquiry
                    ? "border-purple-200 hover:border-purple-400 bg-gradient-to-b from-purple-50/25 to-white"
                    : isUpcoming
                    ? "border-cyan-200 hover:border-cyan-400 bg-gradient-to-b from-cyan-50/25 to-white"
                    : "border-slate-200 hover:border-blue-400/80"
                }`}
              >
                {/* Top: Client Avatar & Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Client Avatar Pill */}
                      {p.client && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 text-[10px] font-bold">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${getAvatarColor(
                              p.client
                            )}`}
                          >
                            {getInitials(p.client)}
                          </span>
                          <span className="truncate max-w-[90px]">{p.client}</span>
                        </div>
                      )}

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

                    {/* Delete Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(p);
                      }}
                      title="Delete project"
                      className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Title & Link */}
                  <Link href={`/projects/${p.id}`} className="block group-hover:underline">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                      {p.name}
                    </h2>
                  </Link>

                  {p.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Middle & Bottom: Progress & Financials */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3.5">
                  {/* Progress Meter or Special State */}
                  {isEnquiry ? (
                    <div className="p-3 bg-purple-50/90 border border-purple-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">
                          💡 Prospective Enquiry
                        </span>
                        <span className="text-[10px] text-purple-700 block mt-0.5">
                          Awaiting client confirmation
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(p.id, "In Progress")}
                        disabled={updatingId === p.id}
                        className="text-[10px] font-bold px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                      >
                        {updatingId === p.id ? "..." : "Onboard →"}
                      </button>
                    </div>
                  ) : isUpcoming ? (
                    <div className="p-3 bg-cyan-50/90 border border-cyan-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-cyan-900 block">
                          🗓️ Upcoming Phase
                        </span>
                        <span className="text-[10px] text-cyan-700 block mt-0.5">
                          Fixed contract agreed • Ready for kickoff
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(p.id, "In Progress")}
                        disabled={updatingId === p.id}
                        className="text-[10px] font-bold px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                      >
                        {updatingId === p.id ? "..." : "Kickoff →"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 mb-1.5">
                        <span>Work Completion</span>
                        <span className="text-slate-800 font-bold">{p.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            p.status === "Completed"
                              ? "bg-emerald-500"
                              : p.progress > 60
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                              : "bg-blue-600"
                          }`}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Financial Breakdown Card */}
                  {p.totalAmount > 0 && (
                    <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {isEnquiry
                            ? "Quoted Budget"
                            : isUpcoming
                            ? "Agreed Fixed Amount"
                            : "Contract Value"}
                        </span>
                        <div>{getPaymentBadge(p.totalAmount, p.receivedAmount || 0)}</div>
                      </div>

                      <div className="flex items-baseline justify-between gap-1">
                        <div
                          suppressHydrationWarning
                          className="text-sm font-extrabold text-slate-900"
                        >
                          {formatCurrency(p.totalAmount)}
                        </div>
                        {!isEnquiry && (
                          <div
                            suppressHydrationWarning
                            className="text-[11px] text-slate-500 font-medium"
                          >
                            <span className="text-emerald-600 font-bold">
                              {formatCurrency(p.receivedAmount || 0)}
                            </span>
                            <span> / </span>
                            <span className="text-amber-600 font-semibold">
                              {formatCurrency(pending)} pending
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Mini Financial Bar */}
                      {!isEnquiry && p.totalAmount > 0 && (
                        <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${paymentPct}%` }}
                          />
                          <div
                            className="bg-amber-400/80 h-full transition-all duration-300"
                            style={{ width: `${100 - paymentPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Deadline & Duration Left + Action Link */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] gap-2 flex-wrap">
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
                        ? "Review →"
                        : isUpcoming
                        ? "Plan →"
                        : "Details →"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "kanban" ? (
        /* ==================== VIEW 2: KANBAN PIPELINE BOARD ==================== */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {[
            {
              id: "Enquiry",
              title: "💡 Enquiries",
              subtitle: "Leads",
              filterFn: (p: Project) => p.status === "Enquiry" || p.status === "Enquired",
              headerBg: "bg-purple-50 text-purple-900 border-purple-200",
              nextStatus: "Planning",
              nextLabel: "Plan",
            },
            {
              id: "Planning",
              title: "🗓️ Upcoming",
              subtitle: "Planning",
              filterFn: (p: Project) => p.status === "Planning" || p.status === "Upcoming",
              headerBg: "bg-cyan-50 text-cyan-900 border-cyan-200",
              nextStatus: "In Progress",
              nextLabel: "Kickoff",
            },
            {
              id: "In Progress",
              title: "⚡ In Progress",
              subtitle: "Active Work",
              filterFn: (p: Project) => p.status === "In Progress",
              headerBg: "bg-blue-50 text-blue-900 border-blue-200",
              nextStatus: "Completed",
              nextLabel: "Complete",
            },
            {
              id: "On Hold",
              title: "⏸️ On Hold",
              subtitle: "Paused",
              filterFn: (p: Project) => p.status === "On Hold",
              headerBg: "bg-amber-50 text-amber-900 border-amber-200",
              nextStatus: "In Progress",
              nextLabel: "Resume",
            },
            {
              id: "Completed",
              title: "✅ Completed",
              subtitle: "Archived",
              filterFn: (p: Project) => p.status === "Completed",
              headerBg: "bg-emerald-50 text-emerald-900 border-emerald-200",
              nextStatus: null,
              nextLabel: null,
            },
          ].map((col) => {
            const colProjects = filteredProjects.filter(col.filterFn);
            const colValue = colProjects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

            return (
              <div
                key={col.id}
                className="bg-slate-100/70 rounded-3xl p-3 border border-slate-200/80 flex flex-col gap-3 min-h-[400px]"
              >
                {/* Column Header */}
                <div
                  className={`p-3 rounded-2xl border flex items-center justify-between ${col.headerBg}`}
                >
                  <div>
                    <h3 className="text-xs font-extrabold tracking-tight">
                      {col.title}
                    </h3>
                    <span
                      suppressHydrationWarning
                      className="text-[10px] font-semibold opacity-75 block"
                    >
                      {formatCurrency(colValue)}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-white/80 shadow-2xs">
                    {colProjects.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1">
                  {colProjects.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-400 italic">
                      No projects
                    </div>
                  ) : (
                    colProjects.map((p) => {
                      const duration = getProjectDuration(p.deadline, p.status, mounted);

                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 group"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 truncate max-w-[100px]">
                              {p.client || p.category || "General"}
                            </span>
                            {getPriorityBadge(p.priority)}
                          </div>

                          <Link
                            href={`/projects/${p.id}`}
                            className="block text-xs font-bold text-slate-900 hover:text-blue-600 line-clamp-2 leading-snug"
                          >
                            {p.name}
                          </Link>

                          {p.totalAmount > 0 && (
                            <div
                              suppressHydrationWarning
                              className="text-xs font-extrabold text-slate-800 flex items-center justify-between"
                            >
                              <span>{formatCurrency(p.totalAmount)}</span>
                              {p.receivedAmount > 0 && (
                                <span className="text-[10px] text-emerald-600 font-bold">
                                  {Math.round((p.receivedAmount / p.totalAmount) * 100)}% paid
                                </span>
                              )}
                            </div>
                          )}

                          {/* Progress bar in active columns */}
                          {col.id === "In Progress" && (
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full rounded-full"
                                style={{ width: `${p.progress}%` }}
                              />
                            </div>
                          )}

                          {/* Days Left Chip */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                            <span suppressHydrationWarning>
                              {getDurationBadge(duration, p.status)}
                            </span>

                            {/* Quick Next Stage Button */}
                            {col.nextStatus && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(p.id, col.nextStatus!)}
                                disabled={updatingId === p.id}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {col.nextLabel} →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== VIEW 3: COMPACT TABLE VIEW ==================== */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Work Progress</th>
                  <th className="py-3.5 px-4">Contract (₹)</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Deadline & Duration</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p) => {
                  const duration = getProjectDuration(p.deadline, p.status, mounted);
                  const pending = Math.max(0, (p.totalAmount || 0) - (p.receivedAmount || 0));

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => (window.location.href = `/projects/${p.id}`)}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <Link
                          href={`/projects/${p.id}`}
                          className="hover:text-blue-600 hover:underline block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.name}
                        </Link>
                        <span className="text-[10px] text-slate-400 font-normal block">
                          {p.category || "General"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {p.client ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${getAvatarColor(
                                p.client
                              )}`}
                            >
                              {getInitials(p.client)}
                            </span>
                            <span>{p.client}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>
                      <td className="py-3.5 px-4">{getPriorityBadge(p.priority)}</td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-700">
                            {p.progress}%
                          </span>
                        </div>
                      </td>

                      <td
                        suppressHydrationWarning
                        className="py-3.5 px-4 font-extrabold text-slate-900"
                      >
                        {formatCurrency(p.totalAmount)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          {getPaymentBadge(p.totalAmount, p.receivedAmount || 0)}
                          {pending > 0 && (
                            <span
                              suppressHydrationWarning
                              className="text-[10px] text-slate-400 block mt-0.5"
                            >
                              {formatCurrency(pending)} pend.
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span
                            suppressHydrationWarning
                            className="text-slate-500 text-[11px] block"
                          >
                            {formatDeadlineDate(p.deadline)}
                          </span>
                          <span suppressHydrationWarning>
                            {getDurationBadge(duration, p.status)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/projects/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(p);
                            }}
                            className="text-slate-300 hover:text-rose-600 p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Quick Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900">Delete Project?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 font-bold">"{projectToDelete.name}"</strong>?
              All recorded financial milestones and logs will be permanently erased.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
