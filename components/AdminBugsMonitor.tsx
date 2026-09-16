"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { updateIssueStatusAction, reassignIssueAction, deleteIssueAction } from "@/lib/actions";
import ReportBugModal from "./ReportBugModal";

export interface IssueMonitoringItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  resolution?: string | null;
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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all"); // 'all' | 'unassigned' | memberId
  const [statusFilter, setStatusFilter] = useState<string>("all"); // 'all' | 'Open' | 'In Progress' | 'Resolved'
  const [priorityFilter, setPriorityFilter] = useState<string>("all"); // 'all' | 'Critical' | 'High' | 'Medium' | 'Low'
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Inline resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // Report bug modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledMemberId, setPrefilledMemberId] = useState<string>("");

  // Only non-admin workers can be assigned bugs (Admin cannot be assigned bugs)
  const assignableMembers = useMemo(() => {
    return teamMembers.filter(
      (m) =>
        m.role !== "SUPER_ADMIN" &&
        !m.name.toLowerCase().includes("super admin") &&
        !m.email.toLowerCase().includes("admin@")
    );
  }, [teamMembers]);

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

    // Search query
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

    // Member filter
    if (selectedMemberId === "unassigned") {
      list = list.filter((i) => !i.assignedTo);
    } else if (selectedMemberId !== "all") {
      list = list.filter((i) => i.assignedTo?.id === selectedMemberId);
    }

    // Project filter
    if (selectedProjectId !== "all") {
      list = list.filter((i) => i.projectId === selectedProjectId);
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "Resolved") {
        list = list.filter((i) => i.status === "Resolved" || i.status === "Closed");
      } else {
        list = list.filter((i) => i.status === statusFilter);
      }
    }

    // Priority filter
    if (priorityFilter !== "all") {
      list = list.filter((i) => i.priority === priorityFilter);
    }

    return list;
  }, [issues, searchQuery, selectedMemberId, selectedProjectId, statusFilter, priorityFilter]);

  // Update status handler
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

  // Reassign bug handler
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

  // Delete bug handler
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
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Medium":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case "Open":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "In Progress":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Resolved":
      case "Closed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🐛 Assigned Bugs & Quality Monitor</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {stats.total} total
            </span>
            {stats.critical > 0 && (
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                {stats.critical} Critical Blocker{stats.critical > 1 ? "s" : ""}
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track all quality defects reported across projects, monitor which member is assigned to fix them, and ensure prompt resolution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/issues"
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            Full Issues Hub ↗
          </Link>
          <button
            type="button"
            onClick={() => {
              setPrefilledMemberId("");
              setIsReportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer"
          >
            <span>+ Report New Bug</span>
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
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "all" && priorityFilter === "all"
              ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Bugs</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across all projects</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setPriorityFilter(priorityFilter === "Critical" ? "all" : "Critical");
            setStatusFilter("Open");
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            priorityFilter === "Critical"
              ? "bg-rose-50 border-rose-400 ring-2 ring-rose-500/20 shadow-2xs"
              : stats.critical > 0
              ? "bg-rose-50/50 border-rose-200/80 hover:bg-rose-50"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Critical Blockers</span>
            {stats.critical > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          </div>
          <div className={`text-xl font-black mt-0.5 ${stats.critical > 0 ? "text-rose-700" : "text-slate-900"}`}>
            {stats.critical}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
            {stats.critical > 0 ? "Severe production blockers" : "Zero blockers"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Open" ? "all" : "Open")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "Open"
              ? "bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Open Bugs</div>
          <div className="text-xl font-black text-amber-700 mt-0.5">{stats.open}</div>
          <div className="text-[10px] text-amber-600/80 mt-0.5">Awaiting fix / triage</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "In Progress" ? "all" : "In Progress")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "In Progress"
              ? "bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">In Progress</div>
          <div className="text-xl font-black text-blue-700 mt-0.5">{stats.inProgress}</div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">Workers fixing now</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Resolved" ? "all" : "Resolved")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "Resolved"
              ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Resolved & Closed</div>
          <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.resolved}</div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">Verified fixes</div>
        </button>
      </div>

      {/* 2. LIVE WORKER DEFECT MONITOR (Clickable Avatar Bar) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>👥 Filter Bugs by Assigned Member</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any teammate to see what bugs they are responsible for resolving.
            </p>
          </div>
          {selectedMemberId !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedMemberId("all")}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 self-start sm:self-auto cursor-pointer"
            >
              Reset to All Workers ✕
            </button>
          )}
        </div>

        {/* Worker Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* All Workers */}
          <button
            type="button"
            onClick={() => setSelectedMemberId("all")}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedMemberId === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>All Members</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedMemberId === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {issues.length}
            </span>
          </button>

          {/* Individual Members */}
          {assignableMembers.map((member) => {
            const isSelected = selectedMemberId === member.id;
            const count = memberBugCounts.map.get(member.id) || { total: 0, open: 0, critical: 0 };
            const initial = member.name.slice(0, 1).toUpperCase();

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={`px-3 py-1.5 rounded-2xl border text-xs transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "bg-rose-50 border-rose-400 text-rose-950 font-black ring-2 ring-rose-500/20 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-xl flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    isSelected ? "bg-rose-600 text-white" : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {initial}
                </div>
                <span className="font-bold truncate">{member.name.split(" ")[0]}</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      count.open > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count.open}
                  </span>
                  {count.critical > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"
                      title={`${count.critical} critical bug(s)`}
                    />
                  )}
                </div>
              </button>
            );
          })}

          {/* Unassigned */}
          <button
            type="button"
            onClick={() => setSelectedMemberId("unassigned")}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedMemberId === "unassigned"
                ? "bg-amber-100 border-amber-400 text-amber-950 ring-2 ring-amber-500/20 shadow-2xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>⚠️ Unassigned</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900 font-bold">
              {memberBugCounts.unassigned}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bugs, projects, reporters, assignees..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
          />
          <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">⚡ All Priorities</option>
            <option value="Critical">🔴 Critical</option>
            <option value="High">🟠 High</option>
            <option value="Medium">🔵 Medium</option>
            <option value="Low">⚪ Low</option>
          </select>

          {/* Project Dropdown */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">📁 All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 shrink-0 font-medium">
            Showing <strong>{filteredIssues.length}</strong> of {issues.length}
          </span>
        </div>
      </div>

      {/* 4. MAIN BUGS MONITORING LIST */}
      {filteredIssues.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <span className="text-3xl">✨</span>
          <h4 className="text-sm font-bold text-slate-800">No bugs match your current filters</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All systems look clean! Try clearing filters or selecting another member to inspect their bug queue.
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
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const isOpen = issue.status === "Open";
            const isResolved = issue.status === "Resolved" || issue.status === "Closed";

            return (
              <div
                key={issue.id}
                className={`p-4 sm:p-5 bg-white rounded-3xl border transition-all space-y-3 shadow-2xs hover:shadow-md ${
                  issue.priority === "Critical" && !isResolved
                    ? "border-rose-300 ring-2 ring-rose-500/10"
                    : "border-slate-200/90 hover:border-blue-300"
                }`}
              >
                {/* Bug Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(
                        issue.priority
                      )}`}
                    >
                      {issue.priority} Priority
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                        issue.status
                      )}`}
                    >
                      {issue.status}
                    </span>
                    <Link
                      href={`/projects/${issue.projectId}`}
                      className="text-xs font-bold text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-0.5 rounded-full transition-colors truncate max-w-[200px]"
                    >
                      📁 {issue.projectName}
                    </Link>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">{issue.title}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    <span>
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
                      className="p-1 hover:text-rose-600 rounded transition-colors cursor-pointer text-slate-400 hover:bg-rose-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Bug Description */}
                {issue.description && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                    {issue.description}
                  </p>
                )}

                {/* Bug Resolution note */}
                {issue.resolution && (
                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <span className="font-extrabold flex items-center gap-1 text-emerald-800">
                      <span>✓</span> Resolution Note:
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingId === issue.id && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 animate-fade-in">
                    <label className="block text-xs font-bold text-slate-700">
                      Explain How This Bug Was Resolved:
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g. Fixed CSS flex wrap issue on mobile viewport, tested on iOS Safari."
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setResolutionText("");
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !resolutionText.trim()}
                        onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        Confirm Resolution
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Footer Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  {/* People involved */}
                  <div className="flex flex-wrap items-center gap-4 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Reporter:</span>
                      <strong className="text-slate-800 font-semibold">{issue.raisedBy.name}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Assigned To:</span>
                      <select
                        value={issue.assignedTo?.id || "none"}
                        onChange={(e) => handleReassign(issue.id, e.target.value)}
                        disabled={isPending}
                        className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-500"
                      >
                        <option value="none">-- Unassigned --</option>
                        {assignableMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            👤 {m.name}
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
                        className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Start Work →
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
                        className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                      >
                        ✓ Mark Resolved
                      </button>
                    )}
                    {isResolved && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(issue.id, "Open")}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Re-open
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
