"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { updateIssueStatusAction, reassignIssueAction, deleteIssueAction } from "@/lib/actions";
import ReportBugModal from "./ReportBugModal";
import EditIssueModal from "./EditIssueModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";

export interface IssueMonitoringItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string | null;
  path?: string | null;
  module?: string | null;
  priority: string;
  status: string;
  resolution?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  raisedBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
}

interface TeamMemberOption {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client?: string | null;
}

interface AdminBugsMonitorProps {
  initialIssues: IssueMonitoringItem[];
  teamMembers: TeamMemberOption[];
  projects: ProjectOption[];
}

export default function AdminBugsMonitor({
  initialIssues,
  teamMembers,
  projects,
}: AdminBugsMonitorProps) {
  const [issues, setIssues] = useState<IssueMonitoringItem[]>(initialIssues);
  const [isPending, startTransition] = useTransition();

  // View Mode: Table (default) vs Cards
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Expanded rows in Table View
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [selectedReporterId, setSelectedReporterId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [isTableMaximized, setIsTableMaximized] = useState<boolean>(false);

  // Inline resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // Report bug modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledMemberId, setPrefilledMemberId] = useState<string>("");

  // Edit issue modal state
  const [editingIssue, setEditingIssue] = useState<IssueMonitoringItem | null>(null);

  const assignableMembers = useMemo(() => {
    return teamMembers.filter(
      (m) =>
        m.role !== "SUPER_ADMIN" &&
        !m.name.toLowerCase().includes("super admin") &&
        !m.email.toLowerCase().includes("admin@")
    );
  }, [teamMembers]);

  // Toggle expanded row
  const toggleRowExpansion = (id: string) => {
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // KPIs
  const stats = useMemo(() => {
    const total = issues.length;
    const open = issues.filter((i) => i.status === "Open").length;
    const inProgress = issues.filter((i) => i.status === "In Progress").length;
    const resolved = issues.filter((i) => i.status === "Resolved" || i.status === "Closed").length;
    const critical = issues.filter(
      (i) => i.priority === "Critical" && i.status !== "Resolved" && i.status !== "Closed"
    ).length;
    const high = issues.filter(
      (i) => i.priority === "High" && i.status !== "Resolved" && i.status !== "Closed"
    ).length;

    return { total, open, inProgress, resolved, critical, high };
  }, [issues]);

  // Worker bug counts
  const memberBugCounts = useMemo(() => {
    const map = new Map<string, { total: number; open: number; critical: number }>();
    let unassigned = 0;

    issues.forEach((i) => {
      const isClosed = i.status === "Resolved" || i.status === "Closed";
      if (!i.assignedTo) {
        if (!isClosed) unassigned++;
        return;
      }
      const existing = map.get(i.assignedTo.id) || { total: 0, open: 0, critical: 0 };
      existing.total++;
      if (!isClosed) {
        existing.open++;
        if (i.priority === "Critical") existing.critical++;
      }
      map.set(i.assignedTo.id, existing);
    });

    return { map, unassigned };
  }, [issues]);

  // Unique reporters list
  const uniqueReporters = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => {
      if (i.raisedBy?.id && i.raisedBy?.name) {
        map.set(i.raisedBy.id, i.raisedBy.name);
      }
    });
    teamMembers.forEach((m) => {
      if (!map.has(m.id)) {
        map.set(m.id, m.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [issues, teamMembers]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    let list = [...issues];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          i.projectName.toLowerCase().includes(q) ||
          (i.path && i.path.toLowerCase().includes(q)) ||
          (i.module && i.module.toLowerCase().includes(q)) ||
          (i.assignedTo && i.assignedTo.name.toLowerCase().includes(q)) ||
          i.raisedBy.name.toLowerCase().includes(q)
      );
    }

    // Assigned Worker Filter
    if (selectedMemberId === "unassigned") {
      list = list.filter((i) => !i.assignedTo);
    } else if (selectedMemberId !== "all") {
      list = list.filter((i) => i.assignedTo?.id === selectedMemberId);
    }

    // Reporter (Person who gave the bug) Filter
    if (selectedReporterId !== "all") {
      list = list.filter((i) => i.raisedBy?.id === selectedReporterId);
    }

    // Project Filter
    if (selectedProjectId !== "all") {
      list = list.filter((i) => i.projectId === selectedProjectId);
    }

    // Status Filter
    if (statusFilter !== "all") {
      if (statusFilter === "Resolved") {
        list = list.filter((i) => i.status === "Resolved" || i.status === "Closed");
      } else {
        list = list.filter((i) => i.status === statusFilter);
      }
    }

    // Priority Filter
    if (priorityFilter !== "all") {
      list = list.filter((i) => i.priority === priorityFilter);
    }

    // Date Filter
    if (dateFilter !== "all") {
      const now = new Date();
      list = list.filter((i) => {
        const created = new Date(i.createdAt);
        if (dateFilter === "today") {
          return created.toDateString() === now.toDateString();
        }
        if (dateFilter === "yesterday") {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          return created.toDateString() === yesterday.toDateString();
        }
        if (dateFilter === "this_week") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          return created >= sevenDaysAgo;
        }
        if (dateFilter === "this_month") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          return created >= thirtyDaysAgo;
        }
        if (dateFilter === "custom" && customDate) {
          const createdDateStr = new Date(i.createdAt).toISOString().slice(0, 10);
          return createdDateStr === customDate;
        }
        return true;
      });
    }

    return list;
  }, [
    issues,
    searchQuery,
    selectedMemberId,
    selectedReporterId,
    selectedProjectId,
    statusFilter,
    priorityFilter,
    dateFilter,
    customDate,
  ]);

  const handleUpdateStatus = (issueId: string, newStatus: string, resolution?: string) => {
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("status", newStatus);
    if (resolution !== undefined) {
      formData.append("resolution", resolution);
    }

    startTransition(async () => {
      try {
        await updateIssueStatusAction(formData);
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issueId
              ? {
                  ...i,
                  status: newStatus,
                  resolution: resolution !== undefined ? resolution : i.resolution,
                  resolvedAt:
                    newStatus === "Resolved" || newStatus === "Closed"
                      ? new Date().toISOString()
                      : null,
                }
              : i
          )
        );
        setResolvingId(null);
        setResolutionText("");
      } catch (err: any) {
        alert(err?.message || "Failed to update bug status.");
      }
    });
  };

  const handleReassign = (issueId: string, newMemberId: string) => {
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("assignedToId", newMemberId);

    startTransition(async () => {
      try {
        await reassignIssueAction(formData);
        const newMember = teamMembers.find((m) => m.id === newMemberId) || null;
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issueId
              ? {
                  ...i,
                  assignedTo: newMember
                    ? { id: newMember.id, name: newMember.name, email: newMember.email, role: newMember.role }
                    : null,
                }
              : i
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to reassign bug.");
      }
    });
  };

  const handleDelete = (issueId: string) => {
    if (!confirm("Are you sure you want to delete this bug record?")) return;

    startTransition(async () => {
      try {
        await deleteIssueAction(issueId);
        setIssues((prev) => prev.filter((i) => i.id !== issueId));
      } catch (err: any) {
        alert(err?.message || "Failed to delete bug.");
      }
    });
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case "Critical":
        return "bg-red-50 text-signal-red border-red-200";
      case "High":
        return "bg-amber-50 text-signal-amber border-amber-200";
      case "Medium":
        return "bg-blue-50 text-accent border-blue-200";
      default:
        return "bg-surface text-slate-700 border-border";
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case "Open":
        return "bg-red-50 text-signal-red border-red-200";
      case "In Progress":
        return "bg-blue-50 text-accent border-blue-200";
      case "Resolved":
      case "Closed":
        return "bg-emerald-50 text-signal-green border-emerald-200";
      default:
        return "bg-surface text-slate-700 border-border";
    }
  };

  const getModuleBadgeClass = (module?: string | null) => {
    switch (module) {
      case "Admin Side":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60";
      case "Client Portal":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60";
      case "API / Backend":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60";
      case "Public / Landing":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60";
      case "User Side":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink tracking-tight">
              Assigned Bugs & Quality Monitor
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface text-slate-600 border border-border tabular-nums">
              {stats.total} total
            </span>
            {stats.critical > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-signal-red border border-red-200 tabular-nums">
                {stats.critical} Critical
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track all quality defects reported across projects, monitor which member is assigned to fix them, and ensure prompt resolution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex p-0.5 bg-surface border border-border rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-white text-ink font-semibold shadow-xs border border-border/80"
                  : "text-slate-500 hover:text-ink"
              }`}
            >
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === "cards"
                  ? "bg-white text-ink font-semibold shadow-xs border border-border/80"
                  : "text-slate-500 hover:text-ink"
              }`}
            >
              <span>Cards</span>
            </button>
          </div>

          <Link
            href="/issues"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-ink bg-white hover:bg-surface rounded-lg border border-border transition-colors"
          >
            Issues Hub
          </Link>
          <button
            type="button"
            onClick={() => {
              setPrefilledMemberId("");
              setIsReportModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            + Report Bug
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setPriorityFilter("all");
          }}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer shadow-xs ${
            statusFilter === "all" && priorityFilter === "all"
              ? "bg-white border-accent ring-1 ring-accent/20"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</div>
          <div className="text-xl font-bold text-ink mt-0.5 tabular-nums">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across projects</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setPriorityFilter(priorityFilter === "Critical" ? "all" : "Critical");
            setStatusFilter("Open");
          }}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer shadow-xs ${
            priorityFilter === "Critical"
              ? "bg-red-50/50 border-red-300 ring-1 ring-red-200"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-signal-red">Critical</div>
          <div className="text-xl font-bold text-signal-red mt-0.5 tabular-nums">{stats.critical}</div>
          <div className="text-[11px] text-signal-red font-medium mt-0.5">
            {stats.critical > 0 ? "Severe blockers" : "Zero blockers"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Open" ? "all" : "Open")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer shadow-xs ${
            statusFilter === "Open"
              ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-200"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-signal-amber">Open</div>
          <div className="text-xl font-bold text-signal-amber mt-0.5 tabular-nums">{stats.open}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting fix</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "In Progress" ? "all" : "In Progress")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer shadow-xs ${
            statusFilter === "In Progress"
              ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-200"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">In progress</div>
          <div className="text-xl font-bold text-accent mt-0.5 tabular-nums">{stats.inProgress}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Being fixed</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Resolved" ? "all" : "Resolved")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer shadow-xs ${
            statusFilter === "Resolved"
              ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-200"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-signal-green">Resolved</div>
          <div className="text-xl font-bold text-signal-green mt-0.5 tabular-nums">{stats.resolved}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Verified fixes</div>
        </button>
      </div>

      {/* 2. Worker Defect Chips */}
      <div className="bg-white p-4 rounded-lg border border-border shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-xs font-semibold text-ink">
            Filter by Assigned Member
          </h3>
          {selectedMemberId !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedMemberId("all")}
              className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              Reset to all
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId("all")}
            className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedMemberId === "all"
                ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white font-semibold shadow-xs"
                : "bg-surface dark:bg-[#0a0a0a] text-slate-700 dark:text-slate-300 border-border dark:border-[#262626] hover:bg-neutral-100 dark:hover:bg-neutral-900"
            }`}
          >
            <span>All Members</span>
            <span className="text-[10px] tabular-nums">({issues.length})</span>
          </button>

          {assignableMembers.map((member) => {
            const isSelected = selectedMemberId === member.id;
            const count = memberBugCounts.map.get(member.id) || { total: 0, open: 0, critical: 0 };

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={`px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-50 border-accent text-accent font-semibold"
                    : "bg-white border-border text-slate-700 hover:bg-surface"
                }`}
              >
                <span>{member.name.split(" ")[0]}</span>
                <span className="text-[10px] tabular-nums text-slate-400 font-medium">({count.open})</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedMemberId("unassigned")}
            className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedMemberId === "unassigned"
                ? "bg-amber-50 border-amber-300 text-signal-amber font-semibold"
                : "bg-surface text-slate-600 border-border hover:bg-slate-100"
            }`}
          >
            <span>Unassigned</span>
            <span className="text-[10px] tabular-nums">({memberBugCounts.unassigned})</span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0a0a0a] p-3 rounded-lg border border-border dark:border-[#262626]">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <button
            type="button"
            onClick={() => {
              setPrefilledMemberId("");
              setIsReportModalOpen(true);
            }}
            className="px-3 py-1.5 bg-accent hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>+</span>
            <span>Report Defect</span>
          </button>

          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bugs, projects, assignees, path..."
              className="w-full px-3 py-1.5 pl-8 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-slate-400 text-ink dark:text-white"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink dark:hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent max-w-[150px] truncate"
          >
            <option value="all">📁 All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Reporter Filter ("person who gives the bug") */}
          <select
            value={selectedReporterId}
            onChange={(e) => setSelectedReporterId(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent max-w-[160px] truncate"
          >
            <option value="all">👤 All Reporters (Who gave bug)</option>
            {uniqueReporters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="all">📅 All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">Last 7 Days</option>
            <option value="this_month">Last 30 Days</option>
            <option value="custom">Specific Date...</option>
          </select>

          {dateFilter === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2 py-1 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface dark:bg-[#141414] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery ||
            selectedMemberId !== "all" ||
            selectedReporterId !== "all" ||
            selectedProjectId !== "all" ||
            statusFilter !== "all" ||
            priorityFilter !== "all" ||
            dateFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedMemberId("all");
                setSelectedReporterId("all");
                setSelectedProjectId("all");
                setStatusFilter("all");
                setPriorityFilter("all");
                setDateFilter("all");
                setCustomDate("");
              }}
              className="px-2.5 py-1 text-xs font-medium text-accent hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}

          {/* Maximize Table Toggle */}
          <button
            type="button"
            onClick={() => setIsTableMaximized((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              isTableMaximized
                ? "bg-accent text-white border-accent shadow-xs"
                : "bg-surface dark:bg-[#141414] border-border dark:border-[#262626] text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white"
            }`}
            title={isTableMaximized ? "Restore table size" : "Expand table full screen"}
          >
            <span>{isTableMaximized ? "🗗" : "⛶"}</span>
            <span>{isTableMaximized ? "Compact" : "Maximize"}</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN BUGS MONITORING: TABLE VIEW (PRIMARY) VS CARDS VIEW */}
      {filteredIssues.length === 0 ? (
        <div className="p-8 bg-white dark:bg-[#0a0a0a] rounded-lg border border-dashed border-border dark:border-[#262626] text-center space-y-2 shadow-xs">
          <h4 className="text-sm font-semibold text-ink dark:text-white">No bugs match your current filters</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try clearing filters or selecting another member.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedMemberId("all");
              setStatusFilter("all");
              setPriorityFilter("all");
              setSelectedProjectId("all");
            }}
            className="px-3 py-1 bg-surface hover:bg-slate-100 dark:hover:bg-neutral-800 text-ink dark:text-white text-xs font-medium rounded-lg border border-border dark:border-[#262626] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE FORMAT (FREE FLOW - GENEROUS HEIGHT & NO HORIZONTAL SCROLL) */
        <div className={`flex flex-col ${isTableMaximized ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 bg-white dark:bg-[#0a0a0a] p-4 sm:p-6 rounded-2xl shadow-2xl border border-border dark:border-[#262626] overflow-hidden" : ""}`}>
          <div className={`overflow-y-auto overflow-x-hidden ${isTableMaximized ? "flex-1 min-h-0" : "min-h-[520px] max-h-[76vh]"}`}>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-surface/95 dark:bg-[#111111]/95 backdrop-blur border-b border-border dark:border-[#262626]">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-2 w-7 text-center">#</th>
                  <th className="py-2.5 px-2 w-28">Module</th>
                  <th className="py-2.5 px-2">Defect / Bug Title</th>
                  <th className="py-2.5 px-2 w-36">Route / Path</th>
                  <th className="py-2.5 px-2 w-28">Project</th>
                  <th className="py-2.5 px-1.5 w-20">Priority</th>
                  <th className="py-2.5 px-1.5 w-20">Status</th>
                  <th className="py-2.5 px-2 w-28">Assigned Worker</th>
                  <th className="py-2.5 px-2 w-24">Reported Date</th>
                  <th className="py-2.5 px-2 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 dark:divide-[#262626]/60">
                {filteredIssues.map((issue) => {
                  const isOpen = issue.status === "Open";
                  const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                  const isExpanded = expandedIssueIds.has(issue.id);

                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        onDoubleClick={() => setEditingIssue(issue)}
                        className={`hover:bg-surface/70 dark:hover:bg-neutral-900/60 transition-colors group cursor-default ${
                          issue.priority === "Critical" && !isResolved ? "bg-red-50/20 dark:bg-red-950/20" : ""
                        } ${isExpanded ? "bg-surface/50 dark:bg-neutral-900/50" : ""}`}
                        title="Double-click row or click Edit to modify defect"
                      >
                        {/* Index / Expand toggle */}
                        <td className="py-2.5 px-2 text-center text-slate-400 font-medium tabular-nums">
                          <button
                            type="button"
                            onClick={() => toggleRowExpansion(issue.id)}
                            className="hover:text-ink dark:hover:text-white cursor-pointer p-0.5"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        </td>

                        {/* Module / Side */}
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${getModuleBadgeClass(
                              issue.module
                            )}`}
                          >
                            <span>
                              {issue.module === "Admin Side"
                                ? "🛡️"
                                : issue.module === "Client Portal"
                                ? "🏢"
                                : issue.module === "API / Backend"
                                ? "⚡"
                                : issue.module === "Public / Landing"
                                ? "🌐"
                                : "👤"}
                            </span>
                            <span>{issue.module || "User Side"}</span>
                          </span>
                        </td>

                        {/* Defect Title & snippet */}
                        <td className="py-2.5 px-2">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => setEditingIssue(issue)}
                              className="font-semibold text-ink dark:text-white hover:text-accent dark:hover:text-blue-400 transition-colors text-left block cursor-pointer group-hover:underline"
                              title="Click to edit defect"
                            >
                              {issue.title}
                            </button>
                            {issue.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">
                                {issue.description}
                              </p>
                            )}
                            {(issue.attachmentUrl || issue.attachmentName) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-900/50">
                                <span>📎 Evidence</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Route / Screen / File Path */}
                        <td className="py-2.5 px-2">
                          {issue.path ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-[#141414] px-2 py-0.5 rounded border border-slate-200 dark:border-[#262626] max-w-[130px] sm:max-w-[160px] truncate select-all"
                              title={`Route / File Path: ${issue.path}`}
                            >
                              <span className="shrink-0 text-slate-400">📍</span>
                              <span className="truncate">{issue.path}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Project */}
                        <td className="py-2.5 px-2">
                          <Link
                            href={`/projects/${issue.projectId}`}
                            className="font-medium text-slate-700 dark:text-slate-200 hover:text-accent dark:hover:text-blue-400 transition-colors truncate block max-w-[100px] sm:max-w-[120px]"
                          >
                            {issue.projectName}
                          </Link>
                        </td>

                        {/* Priority */}
                        <td className="py-2.5 px-1.5">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                              issue.priority
                            )}`}
                          >
                            {issue.priority}
                          </span>
                        </td>

                        {/* Status (Direct Inline Edit Dropdown) */}
                        <td className="py-2.5 px-1.5">
                          <select
                            value={issue.status}
                            disabled={isPending}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              if (newStatus === "Resolved") {
                                toggleRowExpansion(issue.id);
                                setResolvingId(issue.id);
                                setResolutionText("");
                              } else {
                                handleUpdateStatus(issue.id, newStatus);
                              }
                            }}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 ${getStatusBadgeClass(
                              issue.status
                            )}`}
                            title="Change bug status directly from table"
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>

                        {/* Assigned Worker (with 1-click reassignment) */}
                        <td className="py-2.5 px-2">
                          <select
                            value={issue.assignedTo?.id || "none"}
                            onChange={(e) => handleReassign(issue.id, e.target.value)}
                            disabled={isPending}
                            className="px-2 py-0.5 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded font-medium text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer max-w-[120px]"
                          >
                            <option value="none">Unassigned</option>
                            {assignableMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Reported Date & Reporter */}
                        <td className="py-2.5 px-2">
                          <span className="font-medium text-slate-700 dark:text-slate-200 block truncate max-w-[90px] sm:max-w-[100px]">
                            {issue.raisedBy.name}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {new Date(issue.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingIssue(issue)}
                              title="Edit issue details"
                              className="px-2.5 py-1 bg-accent/10 hover:bg-accent text-accent hover:text-white dark:bg-blue-950/50 dark:hover:bg-blue-600 dark:text-blue-300 dark:hover:text-white font-semibold rounded-lg text-[11px] transition-all cursor-pointer inline-flex items-center gap-1 border border-accent/20 dark:border-blue-800 shadow-2xs"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>

                            {isOpen && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                className="px-2 py-0.5 bg-surface dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-neutral-800 text-accent dark:text-blue-400 border border-border dark:border-[#262626] font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Start
                              </button>
                            )}

                            {!isResolved && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  toggleRowExpansion(issue.id);
                                  setResolvingId(issue.id);
                                  setResolutionText("");
                                }}
                                className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-signal-green dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}

                            {isResolved && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "Open")}
                                className="px-2 py-0.5 text-slate-600 dark:text-slate-300 hover:text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-neutral-800 border border-border dark:border-[#262626] rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(issue.id)}
                              disabled={isPending}
                              title="Delete bug record"
                              className="text-slate-400 hover:text-signal-red p-1 transition-colors cursor-pointer text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-surface/70 dark:bg-[#111111]/70 border-b border-border dark:border-[#262626]">
                          <td colSpan={10} className="p-4 sm:p-5">
                            <div className="space-y-4 max-w-4xl mx-auto bg-white dark:bg-[#0a0a0a] p-4 rounded-lg border border-border dark:border-[#262626]">
                              {/* Module & Path summary */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-border dark:border-[#262626]">
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Module / Side
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border ${getModuleBadgeClass(
                                      issue.module
                                    )}`}
                                  >
                                    <span>
                                      {issue.module === "Admin Side"
                                        ? "🛡️ Admin Side"
                                        : issue.module === "Client Portal"
                                        ? "🏢 Client Portal"
                                        : issue.module === "API / Backend"
                                        ? "⚡ API / Backend"
                                        : issue.module === "Public / Landing"
                                        ? "🌐 Public / Landing"
                                        : "👤 User Side"}
                                    </span>
                                  </span>
                                </div>

                                {issue.path && (
                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                      📍 Route / Screen / File Path
                                    </span>
                                    <div className="text-xs font-mono bg-surface dark:bg-[#141414] p-2 rounded-md border border-border dark:border-[#262626] text-slate-800 dark:text-slate-200 font-semibold select-all">
                                      {issue.path}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Full description */}
                              {issue.description ? (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Description & Steps to Reproduce
                                  </span>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-surface dark:bg-[#141414] p-3 rounded-md border border-border dark:border-[#262626]">
                                    {issue.description}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No description provided.</p>
                              )}

                              {/* Evidence / Attachments */}
                              {(issue.attachmentUrl || issue.attachmentName) && (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Attached Screenshot / Screen Recording
                                  </span>
                                  <IssueAttachmentViewer
                                    attachmentUrl={issue.attachmentUrl}
                                    attachmentName={issue.attachmentName}
                                    attachmentType={issue.attachmentType}
                                  />
                                </div>
                              )}

                              {/* Resolution Note if resolved */}
                              {issue.resolution && (
                                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60 text-xs text-signal-green dark:text-emerald-300 space-y-0.5">
                                  <span className="font-semibold">Resolution:</span>
                                  <p className="whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-100">{issue.resolution}</p>
                                </div>
                              )}

                              {/* Inline Resolve Box */}
                              {resolvingId === issue.id && (
                                <div className="bg-surface dark:bg-[#141414] p-3.5 rounded-lg border border-border dark:border-[#262626] space-y-2">
                                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    Explain How This Bug Was Resolved:
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    placeholder="e.g. Fixed CSS flex wrap issue on mobile viewport, tested on iOS Safari."
                                    className="w-full p-2.5 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingId(null);
                                        setResolutionText("");
                                      }}
                                      className="px-3 py-1 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#050505] hover:bg-surface dark:hover:bg-[#111111] border border-border dark:border-[#262626] rounded-lg cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isPending || !resolutionText.trim()}
                                      onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                                      className="px-3.5 py-1 bg-signal-green hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                                    >
                                      Confirm Resolution
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS FORMAT (ALTERNATIVE) */
        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const isOpen = issue.status === "Open";
            const isResolved = issue.status === "Resolved" || issue.status === "Closed";

            return (
              <div
                key={issue.id}
                className="p-4 sm:p-5 bg-white dark:bg-[#0a0a0a] rounded-lg border border-border dark:border-[#262626] shadow-xs space-y-3"
              >
                {/* Bug Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Module Badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getModuleBadgeClass(
                        issue.module
                      )}`}
                    >
                      <span>
                        {issue.module === "Admin Side"
                          ? "🛡️"
                          : issue.module === "Client Portal"
                          ? "🏢"
                          : issue.module === "API / Backend"
                          ? "⚡"
                          : issue.module === "Public / Landing"
                          ? "🌐"
                          : "👤"}
                      </span>
                      <span>{issue.module || "User Side"}</span>
                    </span>

                    <span
                      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                        issue.priority
                      )}`}
                    >
                      {issue.priority}
                    </span>
                    <span
                      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                        issue.status
                      )}`}
                    >
                      {issue.status}
                    </span>
                    <Link
                      href={`/projects/${issue.projectId}`}
                      className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-accent dark:hover:text-white bg-surface dark:bg-[#141414] px-2 py-0.5 rounded border border-border dark:border-[#262626] transition-colors truncate max-w-[200px]"
                    >
                      {issue.projectName}
                    </Link>
                    <span className="text-sm font-semibold text-ink dark:text-white">{issue.title}</span>
                    {issue.path && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-200 dark:border-neutral-700 select-all"
                        title={`Route / File Path: ${issue.path}`}
                      >
                        <span>📍</span>
                        <span>{issue.path}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    <span className="tabular-nums">
                      {new Date(issue.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(issue.id)}
                      disabled={isPending}
                      title="Delete this bug record"
                      className="text-slate-400 hover:text-signal-red transition-colors cursor-pointer text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Bug Description */}
                {issue.description && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-surface dark:bg-[#141414] p-3 rounded-lg border border-border dark:border-[#262626]">
                    {issue.description}
                  </p>
                )}

                {/* Attachment */}
                {(issue.attachmentUrl || issue.attachmentName) && (
                  <IssueAttachmentViewer
                    attachmentUrl={issue.attachmentUrl}
                    attachmentName={issue.attachmentName}
                    attachmentType={issue.attachmentType}
                  />
                )}

                {/* Resolution note */}
                {issue.resolution && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60 text-xs text-signal-green dark:text-emerald-300 space-y-0.5">
                    <span className="font-semibold">Resolution:</span>
                    <p className="whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-100">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingId === issue.id && (
                  <div className="bg-surface dark:bg-[#141414] p-3 rounded-lg border border-border dark:border-[#262626] space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Explain How This Bug Was Resolved:
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g. Fixed CSS flex wrap issue on mobile viewport, tested on iOS Safari."
                      className="w-full p-2 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setResolutionText("");
                        }}
                        className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-surface dark:hover:bg-[#111111] border border-border dark:border-[#262626] rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !resolutionText.trim()}
                        onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                        className="px-3 py-1 bg-signal-green hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        Confirm Resolution
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Footer Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border dark:border-[#262626] text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span>Reporter:</span>
                      <strong className="text-ink dark:text-white font-semibold">{issue.raisedBy.name}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Assigned to:</span>
                      <select
                        value={issue.assignedTo?.id || "none"}
                        onChange={(e) => handleReassign(issue.id, e.target.value)}
                        disabled={isPending}
                        className="px-2 py-0.5 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-md font-medium text-ink dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      >
                        <option value="none">Unassigned</option>
                        {assignableMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setEditingIssue(issue)}
                      className="px-2.5 py-1 bg-blue-50 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-neutral-700 text-accent dark:text-white border border-blue-200 dark:border-neutral-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>✏️ Edit</span>
                    </button>

                    {isOpen && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                        className="px-2.5 py-1 bg-surface dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-neutral-800 text-accent dark:text-blue-400 border border-border dark:border-[#262626] font-medium rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Start Fix
                      </button>
                    )}
                    {!isResolved && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setResolvingId(issue.id);
                          setResolutionText("");
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-signal-green dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                    {isResolved && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(issue.id, "Open")}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-ink dark:hover:text-white bg-surface dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-neutral-800 border border-border dark:border-[#262626] rounded-lg transition-colors cursor-pointer"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Bug Modal */}
      {isReportModalOpen && (
        <ReportBugModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setPrefilledMemberId("");
          }}
          projects={projects}
          teamMembers={assignableMembers}
          defaultAssignedToId={prefilledMemberId}
          onSuccess={(created) => {
            if (created) {
              const assignedMember = teamMembers.find((m) => m.id === created.assignedToId) || null;
              const project = projects.find((p) => p.id === created.projectId);
              setIssues((prev) => [
                {
                  id: created.id,
                  projectId: created.projectId,
                  projectName: project?.name || "Project",
                  title: created.title,
                  description: created.description,
                  path: created.path || null,
                  module: created.module || "User Side",
                  priority: created.priority,
                  status: created.status,
                  resolution: created.resolution,
                  createdAt: new Date(created.createdAt).toISOString(),
                  updatedAt: new Date(created.updatedAt).toISOString(),
                  resolvedAt: created.resolvedAt ? new Date(created.resolvedAt).toISOString() : null,
                  raisedBy: {
                    id: created.raisedBy?.id || "",
                    name: created.raisedBy?.name || "Admin",
                    email: created.raisedBy?.email || "",
                  },
                  assignedTo: assignedMember
                    ? { id: assignedMember.id, name: assignedMember.name, email: assignedMember.email, role: assignedMember.role }
                    : null,
                },
                ...prev,
              ]);
            }
          }}
        />
      )}

      {/* Edit Issue Modal */}
      <EditIssueModal
        isOpen={Boolean(editingIssue)}
        onClose={() => setEditingIssue(null)}
        issue={editingIssue}
        projects={projects}
        teamMembers={teamMembers}
        isSuperAdmin={true}
        onSuccess={(updated) => {
          setIssues((prev) =>
            prev.map((i) =>
              i.id === updated.id
                ? {
                    ...i,
                    title: updated.title,
                    description: updated.description,
                    path: updated.path !== undefined ? updated.path : i.path,
                    module: updated.module !== undefined ? updated.module : i.module,
                    priority: updated.priority,
                    status: updated.status,
                    resolution: updated.resolution,
                    projectId: updated.projectId,
                    projectName: updated.project?.name || i.projectName,
                    assignedTo: updated.assignedTo
                      ? {
                          id: updated.assignedTo.id,
                          name: updated.assignedTo.name,
                          email: updated.assignedTo.email,
                        }
                      : null,
                    resolvedAt: updated.resolvedAt
                      ? new Date(updated.resolvedAt).toISOString()
                      : null,
                  }
                : i
            )
          );
        }}
        onDelete={(deletedId) => {
          setIssues((prev) => prev.filter((i) => i.id !== deletedId));
        }}
      />
    </div>
  );
}
