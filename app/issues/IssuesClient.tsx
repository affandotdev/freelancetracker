"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ReportBugModal from "@/components/ReportBugModal";
import EditIssueModal from "@/components/EditIssueModal";
import IssueAttachmentViewer from "@/components/IssueAttachmentViewer";
import {
  updateIssueStatusAction,
  reassignIssueAction,
  deleteIssueAction,
} from "@/lib/actions";

export interface IssueItem {
  id: string;
  projectId: string;
  projectName: string;
  clientName?: string | null;
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
  } | null;
}

interface IssuesClientProps {
  issues: IssueItem[];
  projects: { id: string; name: string; client?: string | null }[];
  teamMembers: { id: string; name: string; email: string; role?: string }[];
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
  };
}

export default function IssuesClient({
  issues: initialIssues,
  projects,
  teamMembers,
  currentUser,
}: IssuesClientProps) {
  const [issues, setIssues] = useState<IssueItem[]>(initialIssues);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // View Mode: Table (default) vs Cards
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Expanded Rows in Table View
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [isTableMaximized, setIsTableMaximized] = useState(false);

  // Inline Resolution Form State
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const [modalDefaults, setModalDefaults] = useState<{
    projectId: string;
    assignedToId: string;
    title: string;
  }>({
    projectId: "",
    assignedToId: "",
    title: "",
  });

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  // Only non-admin workers can be assigned bugs
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

  // Filter calculation
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchDesc = issue.description?.toLowerCase().includes(q) || false;
        const matchProject = issue.projectName.toLowerCase().includes(q);
        const matchReporter = issue.raisedBy.name.toLowerCase().includes(q);
        const matchAssignee = issue.assignedTo?.name.toLowerCase().includes(q) || false;
        const matchPath = issue.path?.toLowerCase().includes(q) || false;
        const matchModule = issue.module?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchProject && !matchReporter && !matchAssignee && !matchPath && !matchModule) {
          return false;
        }
      }

      if (statusFilter !== "All" && issue.status !== statusFilter) {
        return false;
      }

      if (projectFilter !== "All" && issue.projectId !== projectFilter) {
        return false;
      }

      if (moduleFilter !== "All" && (issue.module || "User Side") !== moduleFilter) {
        return false;
      }

      if (assigneeFilter === "assigned_to_me") {
        if (issue.assignedTo?.id !== currentUser.id) return false;
      } else if (assigneeFilter === "reported_by_me") {
        if (issue.raisedBy.id !== currentUser.id) return false;
      } else if (assigneeFilter === "unassigned") {
        if (issue.assignedTo) return false;
      } else if (assigneeFilter !== "All") {
        if (issue.assignedTo?.id !== assigneeFilter) return false;
      }

      if (priorityFilter !== "All" && issue.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [issues, searchQuery, statusFilter, projectFilter, moduleFilter, assigneeFilter, priorityFilter, currentUser.id]);

  const totalCount = issues.length;
  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved" || i.status === "Closed").length;

  const handleOpenReportModal = (memberId = "", projectId = "", title = "") => {
    setModalDefaults({
      projectId: projectId || "",
      assignedToId: memberId,
      title: title || "",
    });
    setIsReportModalOpen(true);
  };

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
        setResolvingIssueId(null);
        setResolutionText("");
      } catch (err: any) {
        alert(err?.message || "Failed to update issue status.");
      }
    });
  };

  const handleReassign = (issueId: string, newAssigneeId: string) => {
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("assignedToId", newAssigneeId || "none");

    startTransition(async () => {
      try {
        await reassignIssueAction(formData);
        const assignedMember = teamMembers.find((m) => m.id === newAssigneeId) || null;
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issueId
              ? {
                  ...i,
                  assignedTo: assignedMember
                    ? { id: assignedMember.id, name: assignedMember.name, email: assignedMember.email }
                    : null,
                }
              : i
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to reassign issue.");
      }
    });
  };

  const handleDeleteIssue = (issueId: string) => {
    if (!confirm("Are you sure you want to delete this issue?")) return;

    startTransition(async () => {
      try {
        await deleteIssueAction(issueId);
        setIssues((prev) => prev.filter((i) => i.id !== issueId));
      } catch (err: any) {
        alert(err?.message || "Failed to delete issue.");
      }
    });
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-red-50 text-signal-red border-red-200";
      case "In Progress":
        return "bg-blue-50 text-accent border-blue-200";
      case "Resolved":
        return "bg-emerald-50 text-signal-green border-emerald-200";
      case "Closed":
        return "bg-surface text-slate-700 border-border";
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
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/" label="Back to Dashboard" />

        <div className="flex items-center gap-2">
          {/* Maximize Table Toggle */}
          <button
            type="button"
            onClick={() => setIsTableMaximized((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              isTableMaximized
                ? "bg-accent text-white border-accent shadow-xs"
                : "bg-surface border-border text-slate-700 hover:text-ink"
            }`}
            title={isTableMaximized ? "Restore table size" : "Expand table full screen"}
          >
            <span>{isTableMaximized ? "🗗" : "⛶"}</span>
            <span>{isTableMaximized ? "Compact" : "Maximize"}</span>
          </button>

          {/* View Switcher: Table vs Cards */}
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

          <button
            type="button"
            onClick={() => handleOpenReportModal()}
            className="inline-flex items-center px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            + Report Issue
          </button>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink tracking-tight">
            Issues & Bug Tracker
          </h1>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface text-slate-700 border border-border">
            Quality Control
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Report bugs against projects, assign deliverables to team members, track resolution progress, and verify fixes.
        </p>
      </div>

      {/* Quick Report Bar */}
      {assignableMembers.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-border shadow-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="text-xs font-semibold text-ink">
              Quick Report Against Team Member
            </h3>
            <span className="text-[11px] text-slate-400">
              Click a member to immediately file an issue:
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {assignableMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleOpenReportModal(m.id)}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-slate-100 text-ink text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                {m.name} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Total issues
          </p>
          <div className="text-2xl font-bold text-ink tracking-tight tabular-nums">{totalCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across all projects</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Open
          </p>
          <div className="text-2xl font-bold text-signal-red tracking-tight tabular-nums">{openCount}</div>
          <p className="text-[11px] text-signal-red font-medium mt-1">Pending investigation</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            In progress
          </p>
          <div className="text-2xl font-bold text-accent tracking-tight tabular-nums">{inProgressCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Being resolved</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Resolved
          </p>
          <div className="text-2xl font-bold text-signal-green tracking-tight tabular-nums">{resolvedCount}</div>
          <p className="text-[11px] text-signal-green font-medium mt-1">Fix shipped</p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues by title, path, module, project, member, or notes..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-slate-400 text-ink"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {[
              { key: "All", label: `All (${totalCount})` },
              { key: "Open", label: `Open (${openCount})` },
              { key: "In Progress", label: `In Progress (${inProgressCount})` },
              { key: "Resolved", label: `Resolved (${resolvedCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                  statusFilter === tab.key
                    ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
          <span className="text-slate-400 font-medium">Filters:</span>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-border rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
          >
            <option value="All">All Modules</option>
            <option value="Admin Side">🛡️ Admin Side</option>
            <option value="User Side">👤 User Side</option>
            <option value="Client Portal">🏢 Client Portal</option>
            <option value="API / Backend">⚡ API / Backend</option>
            <option value="Public / Landing">🌐 Public / Landing</option>
          </select>

          {/* Project Dropdown */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-border rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
          >
            <option value="All">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          {isSuperAdmin ? (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-2.5 py-1 bg-white border border-border rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
            >
              <option value="All">All Assignees</option>
              <option value="assigned_to_me">Assigned to Me</option>
              <option value="reported_by_me">Reported by Me</option>
              <option value="unassigned">Unassigned</option>
              {assignableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  Member: {m.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-2.5 py-1 bg-white border border-border rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
            >
              <option value="All">All (Assigned & Reported)</option>
              <option value="assigned_to_me">Assigned to Me</option>
              <option value="reported_by_me">Reported by Me</option>
            </select>
          )}

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-border rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {(searchQuery ||
            statusFilter !== "All" ||
            projectFilter !== "All" ||
            moduleFilter !== "All" ||
            assigneeFilter !== "All" ||
            priorityFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("All");
                setProjectFilter("All");
                setModuleFilter("All");
                setAssigneeFilter("All");
                setPriorityFilter("All");
              }}
              className="text-xs font-medium text-accent hover:underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Issues Display: Table View (Primary) vs Card View */}
      {filteredIssues.length === 0 ? (
        <div className="bg-white p-8 border border-dashed border-border rounded-lg text-center space-y-2 shadow-xs">
          <h3 className="text-sm font-semibold text-ink">
            {issues.length === 0 ? "No issues reported yet" : "No issues match the active filters"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {issues.length === 0
              ? "All assigned projects are running smoothly. Report an issue whenever a defect is discovered."
              : "Try adjusting your filters or search query."}
          </p>
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer inline-block"
          >
            + Report Issue
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
                  <th className="py-2.5 px-2">Issue / Defect</th>
                  <th className="py-2.5 px-2 w-36">Route / Path</th>
                  <th className="py-2.5 px-2 w-28">Project</th>
                  <th className="py-2.5 px-1.5 w-20">Priority</th>
                  <th className="py-2.5 px-1.5 w-20">Status</th>
                  <th className="py-2.5 px-2 w-28">Assigned To</th>
                  <th className="py-2.5 px-2 w-24">Reported By</th>
                  <th className="py-2.5 px-2 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 dark:divide-[#262626]/60">
                {filteredIssues.map((issue, idx) => {
                  const isOpen = issue.status === "Open";
                  const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                  const canEdit =
                    isSuperAdmin ||
                    issue.assignedTo?.id === currentUser.id ||
                    issue.raisedBy.id === currentUser.id;
                  const canDelete =
                    isSuperAdmin ||
                    issue.raisedBy.id === currentUser.id ||
                    issue.assignedTo?.id === currentUser.id;
                  const isExpanded = expandedIssueIds.has(issue.id);
                  const isMyIssue = issue.assignedTo?.id === currentUser.id;

                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        className={`hover:bg-surface/70 dark:hover:bg-neutral-900/60 transition-colors group ${
                          isMyIssue && isOpen ? "bg-red-50/20 dark:bg-red-950/20" : ""
                        } ${isExpanded ? "bg-surface/50 dark:bg-neutral-900/50" : ""}`}
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

                        {/* Title & snippet */}
                        <td className="py-2.5 px-2">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(issue.id)}
                              className="font-semibold text-ink dark:text-white hover:text-accent dark:hover:text-blue-400 transition-colors text-left block"
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
                            href={isSuperAdmin ? `/projects/${issue.projectId}` : "#"}
                            className="font-medium text-slate-700 dark:text-slate-200 hover:text-accent dark:hover:text-blue-400 transition-colors truncate block max-w-[100px] sm:max-w-[120px]"
                          >
                            {issue.projectName}
                          </Link>
                          {issue.clientName && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[100px]">
                              {issue.clientName}
                            </span>
                          )}
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

                        {/* Status */}
                        <td className="py-2.5 px-1.5">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                              issue.status
                            )}`}
                          >
                            {issue.status}
                          </span>
                        </td>

                        {/* Assignee */}
                        <td className="py-2.5 px-2">
                          {canEdit ? (
                            <select
                              value={issue.assignedTo?.id || ""}
                              disabled={isPending}
                              onChange={(e) => handleReassign(issue.id, e.target.value)}
                              className="px-2 py-0.5 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded font-medium text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer max-w-[120px]"
                            >
                              <option value="">Unassigned</option>
                              {assignableMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          ) : issue.assignedTo ? (
                            <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[100px]">
                              {issue.assignedTo.name}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">Unassigned</span>
                          )}
                        </td>

                        {/* Reporter & Date */}
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingIssue(issue)}
                              title="Edit issue details"
                              className="px-2 py-0.5 bg-blue-50 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-neutral-700 text-accent dark:text-white border border-blue-200 dark:border-neutral-700 font-semibold rounded text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>

                            {isOpen && canEdit && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                className="px-2 py-0.5 bg-surface dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-neutral-800 text-accent dark:text-blue-400 border border-border dark:border-[#262626] font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Start
                              </button>
                            )}

                            {!isResolved && canEdit && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  toggleRowExpansion(issue.id);
                                  setResolvingIssueId(issue.id);
                                  setResolutionText("");
                                }}
                                className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-signal-green dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}

                            {isResolved && canEdit && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "Open")}
                                className="px-2 py-0.5 text-slate-600 dark:text-slate-300 hover:text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-neutral-800 border border-border dark:border-[#262626] rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteIssue(issue.id)}
                                disabled={isPending}
                                title="Delete issue"
                                className="text-slate-400 hover:text-signal-red p-1 transition-colors cursor-pointer text-xs"
                              >
                                ✕
                              </button>
                            )}
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
                                <p className="text-xs text-slate-400 italic">No extra description provided.</p>
                              )}

                              {/* Evidence / Attachments */}
                              {(issue.attachmentUrl || issue.attachmentName) && (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Attached Bug Screenshot / Screen Recording
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
                                  <span className="font-semibold flex items-center gap-1.5">
                                    <span>Resolution Note:</span>
                                    {issue.resolvedAt && (
                                      <span className="font-normal text-slate-500 dark:text-slate-400 text-[11px] tabular-nums">
                                        ({new Date(issue.resolvedAt).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })})
                                      </span>
                                    )}
                                  </span>
                                  <p className="whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-100">
                                    {issue.resolution}
                                  </p>
                                </div>
                              )}

                              {/* Inline Resolve Box */}
                              {resolvingIssueId === issue.id && (
                                <div className="bg-surface dark:bg-[#141414] p-3.5 rounded-lg border border-border dark:border-[#262626] space-y-2">
                                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    How did you resolve this bug?
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    placeholder="e.g. Fixed input validation in checkout handler, tested on Safari & Chrome."
                                    className="w-full p-2.5 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingIssueId(null);
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
            const canEdit =
              isSuperAdmin ||
              issue.assignedTo?.id === currentUser.id ||
              issue.raisedBy.id === currentUser.id;
            const canDelete = isSuperAdmin || issue.raisedBy.id === currentUser.id;

            return (
              <div
                key={issue.id}
                className="bg-white dark:bg-[#0a0a0a] p-5 rounded-lg border border-border dark:border-[#262626] shadow-xs space-y-3"
              >
                {/* Header line */}
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

                    {/* Priority Badge */}
                    <span
                      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                        issue.priority
                      )}`}
                    >
                      {issue.priority}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                        issue.status
                      )}`}
                    >
                      {issue.status}
                    </span>

                    {/* Project Pill */}
                    <Link
                      href={isSuperAdmin ? `/projects/${issue.projectId}` : "#"}
                      className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-accent dark:hover:text-white bg-surface dark:bg-[#141414] px-2 py-0.5 rounded border border-border dark:border-[#262626] transition-colors"
                    >
                      {issue.projectName}
                    </Link>
                  </div>

                  {/* Timestamp & Delete */}
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] shrink-0">
                    <span className="tabular-nums">
                      {new Date(issue.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteIssue(issue.id)}
                        disabled={isPending}
                        title="Delete issue"
                        className="text-slate-400 hover:text-signal-red transition-colors cursor-pointer text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-ink dark:text-white">
                      {issue.title}
                    </h2>
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
                  {issue.description && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-surface dark:bg-[#141414] p-3 rounded-lg border border-border dark:border-[#262626]">
                      {issue.description}
                    </p>
                  )}

                  {/* Bug Evidence / Attachments */}
                  {(issue.attachmentUrl || issue.attachmentName) && (
                    <IssueAttachmentViewer
                      attachmentUrl={issue.attachmentUrl}
                      attachmentName={issue.attachmentName}
                      attachmentType={issue.attachmentType}
                    />
                  )}
                </div>

                {/* Resolution Note */}
                {issue.resolution && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60 text-xs text-signal-green dark:text-emerald-300 space-y-0.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span>Resolution:</span>
                      {issue.resolvedAt && (
                        <span className="font-normal text-slate-500 dark:text-slate-400 text-[11px] tabular-nums">
                          ({new Date(issue.resolvedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })})
                        </span>
                      )}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-100">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingIssueId === issue.id && (
                  <div className="bg-surface dark:bg-[#141414] p-3 rounded-lg border border-border dark:border-[#262626] space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Resolution explanation:
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g. Fixed input validation in checkout handler, tested on Safari & Chrome."
                      className="w-full p-2 text-xs bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingIssueId(null);
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
                        {isPending ? "Saving..." : "Confirm Resolution"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Meta & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border dark:border-[#262626] text-xs">
                  {/* People involved */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <span>Reported by:</span>
                      <span className="font-semibold text-ink dark:text-white">
                        {issue.raisedBy.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <span>Assigned to:</span>
                      {canEdit ? (
                        <select
                          value={issue.assignedTo?.id || ""}
                          disabled={isPending}
                          onChange={(e) => handleReassign(issue.id, e.target.value)}
                          className="px-2 py-0.5 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-md font-medium text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {assignableMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : issue.assignedTo ? (
                        <span className="font-semibold text-ink dark:text-white">
                          {issue.assignedTo.name}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Unassigned</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for authorized users */}
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingIssue(issue)}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-neutral-700 text-accent dark:text-white border border-blue-200 dark:border-neutral-700 font-semibold rounded-lg transition-colors cursor-pointer text-xs inline-flex items-center gap-1"
                      >
                        <span>✏️ Edit</span>
                      </button>

                      {isOpen && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                          className="px-2.5 py-1 bg-surface dark:bg-[#111111] hover:bg-slate-100 dark:hover:bg-neutral-800 text-accent dark:text-blue-400 border border-border dark:border-[#262626] font-medium rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          Start Working
                        </button>
                      )}

                      {!isResolved && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setResolvingIssueId(issue.id);
                            setResolutionText("");
                          }}
                          className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-signal-green dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          Resolve
                        </button>
                      )}

                      {isResolved && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdateStatus(issue.id, "Open")}
                          className="px-2.5 py-1 text-slate-500 hover:text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-neutral-800 border border-border dark:border-[#262626] rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Bug / Issue Modal */}
      <ReportBugModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        projects={projects}
        teamMembers={assignableMembers}
        defaultProjectId={modalDefaults.projectId}
        defaultAssignedToId={modalDefaults.assignedToId}
        defaultTitle={modalDefaults.title}
        onSuccess={(created) => {
          const formatted: IssueItem = {
            id: created.id,
            projectId: created.projectId,
            projectName: created.project?.name || "Project",
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
              id: created.raisedBy.id,
              name: created.raisedBy.name,
              email: created.raisedBy.email,
            },
            assignedTo: created.assignedTo
              ? {
                  id: created.assignedTo.id,
                  name: created.assignedTo.name,
                  email: created.assignedTo.email,
                }
              : null,
          };
          setIssues((prev) => [formatted, ...prev]);
        }}
      />

      {/* Edit Issue Modal */}
      <EditIssueModal
        isOpen={Boolean(editingIssue)}
        onClose={() => setEditingIssue(null)}
        issue={editingIssue}
        projects={projects}
        teamMembers={teamMembers}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUser.id}
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
