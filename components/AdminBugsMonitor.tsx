"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { updateIssueStatusAction, reassignIssueAction, deleteIssueAction } from "@/lib/actions";
import ReportBugModal from "./ReportBugModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";

export interface IssueMonitoringItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string | null;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Inline resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // Report bug modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledMemberId, setPrefilledMemberId] = useState<string>("");

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
          (i.assignedTo && i.assignedTo.name.toLowerCase().includes(q)) ||
          i.raisedBy.name.toLowerCase().includes(q)
      );
    }

    if (selectedMemberId === "unassigned") {
      list = list.filter((i) => !i.assignedTo);
    } else if (selectedMemberId !== "all") {
      list = list.filter((i) => i.assignedTo?.id === selectedMemberId);
    }

    if (selectedProjectId !== "all") {
      list = list.filter((i) => i.projectId === selectedProjectId);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "Resolved") {
        list = list.filter((i) => i.status === "Resolved" || i.status === "Closed");
      } else {
        list = list.filter((i) => i.status === statusFilter);
      }
    }

    if (priorityFilter !== "all") {
      list = list.filter((i) => i.priority === priorityFilter);
    }

    return list;
  }, [issues, searchQuery, selectedMemberId, selectedProjectId, statusFilter, priorityFilter]);

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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bugs, projects, assignees..."
            className="w-full px-3 py-1.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-slate-400 text-ink"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 text-xs bg-white border border-border rounded-lg font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1 text-xs bg-white border border-border rounded-lg font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-slate-400 tabular-nums font-medium">
            {filteredIssues.length} of {issues.length}
          </span>
        </div>
      </div>

      {/* 4. MAIN BUGS MONITORING: TABLE VIEW (PRIMARY) VS CARDS VIEW */}
      {filteredIssues.length === 0 ? (
        <div className="p-8 bg-white rounded-lg border border-dashed border-border text-center space-y-2 shadow-xs">
          <h4 className="text-sm font-semibold text-ink">No bugs match your current filters</h4>
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
            className="px-3 py-1 bg-surface hover:bg-slate-100 text-ink text-xs font-medium rounded-lg border border-border transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE FORMAT (PRIMARY) */
        <div className="bg-white border border-border rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface border-b border-border text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4 min-w-[240px]">Defect / Bug Title</th>
                  <th className="py-3 px-4 min-w-[140px]">Project</th>
                  <th className="py-3 px-4 w-28">Priority</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 min-w-[150px]">Assigned Worker</th>
                  <th className="py-3 px-4 min-w-[130px]">Reported Date</th>
                  <th className="py-3 px-4 min-w-[140px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredIssues.map((issue) => {
                  const isOpen = issue.status === "Open";
                  const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                  const isExpanded = expandedIssueIds.has(issue.id);

                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        className={`hover:bg-surface/70 transition-colors group ${
                          issue.priority === "Critical" && !isResolved ? "bg-red-50/20" : ""
                        } ${isExpanded ? "bg-surface/50" : ""}`}
                      >
                        {/* Index / Expand toggle */}
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium tabular-nums">
                          <button
                            type="button"
                            onClick={() => toggleRowExpansion(issue.id)}
                            className="hover:text-ink cursor-pointer p-0.5"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        </td>

                        {/* Defect Title & snippet */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(issue.id)}
                              className="font-semibold text-ink hover:text-accent transition-colors text-left block"
                            >
                              {issue.title}
                            </button>
                            {issue.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 max-w-md">
                                {issue.description}
                              </p>
                            )}
                            {(issue.attachmentUrl || issue.attachmentName) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                <span>Evidence attached</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Project */}
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/projects/${issue.projectId}`}
                            className="font-medium text-slate-700 hover:text-accent transition-colors truncate block max-w-[150px]"
                          >
                            {issue.projectName}
                          </Link>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                              issue.priority
                            )}`}
                          >
                            {issue.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                              issue.status
                            )}`}
                          >
                            {issue.status}
                          </span>
                        </td>

                        {/* Assigned Worker (with 1-click reassignment) */}
                        <td className="py-3.5 px-4">
                          <select
                            value={issue.assignedTo?.id || "none"}
                            onChange={(e) => handleReassign(issue.id, e.target.value)}
                            disabled={isPending}
                            className="px-2 py-1 text-xs bg-white border border-border rounded-md font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer max-w-[140px]"
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
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-700 block truncate">
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
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOpen && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                className="px-2 py-1 bg-surface hover:bg-slate-100 text-accent border border-border font-medium rounded text-[11px] transition-colors cursor-pointer"
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
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-signal-green border border-emerald-200 font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}

                            {isResolved && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "Open")}
                                className="px-2 py-1 text-slate-600 hover:text-ink hover:bg-surface border border-border rounded text-[11px] transition-colors cursor-pointer"
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
                        <tr className="bg-surface/70 border-b border-border">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="space-y-4 max-w-4xl mx-auto bg-white p-4 rounded-lg border border-border">
                              {/* Full description */}
                              {issue.description ? (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Description & Steps to Reproduce
                                  </span>
                                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-surface p-3 rounded-md border border-border">
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
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-signal-green space-y-0.5">
                                  <span className="font-semibold flex items-center gap-1.5">
                                    <span>Resolution Note:</span>
                                    {issue.resolvedAt && (
                                      <span className="font-normal text-slate-500 text-[11px] tabular-nums">
                                        ({new Date(issue.resolvedAt).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })})
                                      </span>
                                    )}
                                  </span>
                                  <p className="whitespace-pre-wrap leading-relaxed text-emerald-950">
                                    {issue.resolution}
                                  </p>
                                </div>
                              )}

                              {/* Inline Resolve Box */}
                              {resolvingId === issue.id && (
                                <div className="bg-surface p-3.5 rounded-lg border border-border space-y-2">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    Explain How This Bug Was Resolved:
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    placeholder="e.g. Fixed CSS flex wrap issue on mobile viewport, tested on iOS Safari."
                                    className="w-full p-2.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingId(null);
                                        setResolutionText("");
                                      }}
                                      className="px-3 py-1 text-xs text-slate-600 bg-white hover:bg-surface border border-border rounded-lg cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isPending || !resolutionText.trim()}
                                      onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                                      className="px-3.5 py-1 bg-signal-green hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                                    >
                                      {isPending ? "Saving..." : "Confirm Resolution"}
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
                className="p-4 sm:p-5 bg-white rounded-lg border border-border shadow-xs space-y-3"
              >
                {/* Bug Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
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
                      className="text-[11px] font-medium text-slate-600 hover:text-accent bg-surface px-2 py-0.5 rounded border border-border transition-colors truncate max-w-[200px]"
                    >
                      {issue.projectName}
                    </Link>
                    <span className="text-sm font-semibold text-ink">{issue.title}</span>
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
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-surface p-3 rounded-lg border border-border">
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
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-signal-green space-y-0.5">
                    <span className="font-semibold">Resolution:</span>
                    <p className="whitespace-pre-wrap leading-relaxed text-emerald-950">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingId === issue.id && (
                  <div className="bg-surface p-3 rounded-lg border border-border space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Explain How This Bug Was Resolved:
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g. Fixed CSS flex wrap issue on mobile viewport, tested on iOS Safari."
                      className="w-full p-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setResolutionText("");
                        }}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-surface border border-border rounded-lg"
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span>Reporter:</span>
                      <strong className="text-ink font-semibold">{issue.raisedBy.name}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Assigned to:</span>
                      <select
                        value={issue.assignedTo?.id || "none"}
                        onChange={(e) => handleReassign(issue.id, e.target.value)}
                        disabled={isPending}
                        className="px-2 py-0.5 text-xs bg-white border border-border rounded-md font-medium text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
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
                    {isOpen && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                        className="px-2.5 py-1 text-xs font-medium text-accent bg-surface hover:bg-slate-100 border border-border rounded-lg transition-colors cursor-pointer"
                      >
                        Start Work
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
                        className="px-2.5 py-1 text-xs font-medium text-signal-green bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                    {isResolved && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(issue.id, "Open")}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-ink bg-surface hover:bg-slate-100 border border-border rounded-lg transition-colors cursor-pointer"
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
    </div>
  );
}
