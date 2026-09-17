"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ReportBugModal from "@/components/ReportBugModal";
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
  const [isPending, startTransition] = useTransition();

  // View Mode: Table (default) vs Cards
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Expanded Rows in Table View
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Inline Resolution Form State
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const [modalDefaults, setModalDefaults] = useState<{
    projectId: string;
    assignedToId: string;
    title: string;
  }>({
    projectId: projects[0]?.id || "",
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
        if (!matchTitle && !matchDesc && !matchProject && !matchReporter && !matchAssignee) {
          return false;
        }
      }

      if (statusFilter !== "All" && issue.status !== statusFilter) {
        return false;
      }

      if (projectFilter !== "All" && issue.projectId !== projectFilter) {
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
  }, [issues, searchQuery, statusFilter, projectFilter, assigneeFilter, priorityFilter, currentUser.id]);

  const totalCount = issues.length;
  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved" || i.status === "Closed").length;

  const handleOpenReportModal = (memberId = "", projectId = "", title = "") => {
    setModalDefaults({
      projectId: projectId || projects[0]?.id || "",
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

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/" label="Back to Dashboard" />

        <div className="flex items-center gap-2">
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
              placeholder="Search issues by title, project, member, or notes..."
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
                    ? "bg-ink text-white font-semibold"
                    : "text-slate-600 hover:bg-surface border border-transparent"
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
            assigneeFilter !== "All" ||
            priorityFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("All");
                setProjectFilter("All");
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
        /* TABLE FORMAT (PRIMARY) */
        <div className="bg-white border border-border rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface border-b border-border text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4 min-w-[240px]">Issue / Defect</th>
                  <th className="py-3 px-4 min-w-[140px]">Project</th>
                  <th className="py-3 px-4 w-28">Priority</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 min-w-[150px]">Assigned To</th>
                  <th className="py-3 px-4 min-w-[130px]">Reported By</th>
                  <th className="py-3 px-4 min-w-[140px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredIssues.map((issue, idx) => {
                  const isOpen = issue.status === "Open";
                  const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                  const canEdit =
                    isSuperAdmin ||
                    issue.assignedTo?.id === currentUser.id ||
                    issue.raisedBy.id === currentUser.id;
                  const canDelete = isSuperAdmin || issue.raisedBy.id === currentUser.id;
                  const isExpanded = expandedIssueIds.has(issue.id);
                  const isMyIssue = issue.assignedTo?.id === currentUser.id;

                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        className={`hover:bg-surface/70 transition-colors group ${
                          isMyIssue && isOpen ? "bg-red-50/20" : ""
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

                        {/* Title & snippet */}
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
                            href={isSuperAdmin ? `/projects/${issue.projectId}` : "#"}
                            className="font-medium text-slate-700 hover:text-accent transition-colors truncate block max-w-[150px]"
                          >
                            {issue.projectName}
                          </Link>
                          {issue.clientName && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              {issue.clientName}
                            </span>
                          )}
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

                        {/* Assignee */}
                        <td className="py-3.5 px-4">
                          {canEdit ? (
                            <select
                              value={issue.assignedTo?.id || ""}
                              disabled={isPending}
                              onChange={(e) => handleReassign(issue.id, e.target.value)}
                              className="px-2 py-1 text-xs bg-white border border-border rounded font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer max-w-[140px]"
                            >
                              <option value="">Unassigned</option>
                              {assignableMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          ) : issue.assignedTo ? (
                            <span className="font-medium text-slate-800">
                              {issue.assignedTo.name}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">Unassigned</span>
                          )}
                        </td>

                        {/* Reporter & Date */}
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
                            {isOpen && canEdit && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                className="px-2 py-1 bg-surface hover:bg-slate-100 text-accent border border-border font-medium rounded text-[11px] transition-colors cursor-pointer"
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
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-signal-green border border-emerald-200 font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}

                            {isResolved && canEdit && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "Open")}
                                className="px-2 py-1 text-slate-600 hover:text-ink hover:bg-surface border border-border rounded text-[11px] transition-colors cursor-pointer"
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
                              {resolvingIssueId === issue.id && (
                                <div className="bg-surface p-3.5 rounded-lg border border-border space-y-2">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    How did you resolve this bug?
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    placeholder="e.g. Fixed input validation in checkout handler, tested on Safari & Chrome."
                                    className="w-full p-2.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingIssueId(null);
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
            const canEdit =
              isSuperAdmin ||
              issue.assignedTo?.id === currentUser.id ||
              issue.raisedBy.id === currentUser.id;
            const canDelete = isSuperAdmin || issue.raisedBy.id === currentUser.id;

            return (
              <div
                key={issue.id}
                className="bg-white p-5 rounded-lg border border-border shadow-xs space-y-3"
              >
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
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
                      className="text-[11px] font-medium text-slate-600 hover:text-accent bg-surface px-2 py-0.5 rounded border border-border transition-colors"
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
                  <h2 className="text-sm font-semibold text-ink">
                    {issue.title}
                  </h2>
                  {issue.description && (
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-surface p-3 rounded-lg border border-border">
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
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-signal-green space-y-0.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span>Resolution:</span>
                      {issue.resolvedAt && (
                        <span className="font-normal text-slate-500 text-[11px] tabular-nums">
                          ({new Date(issue.resolvedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })})
                        </span>
                      )}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed text-emerald-950">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingIssueId === issue.id && (
                  <div className="bg-surface p-3 rounded-lg border border-border space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Resolution explanation:
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g. Fixed input validation in checkout handler, tested on Safari & Chrome."
                      className="w-full p-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingIssueId(null);
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
                        {isPending ? "Saving..." : "Confirm Resolution"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Meta & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border text-xs">
                  {/* People involved */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span>Reported by:</span>
                      <span className="font-semibold text-ink">
                        {issue.raisedBy.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span>Assigned to:</span>
                      {canEdit ? (
                        <select
                          value={issue.assignedTo?.id || ""}
                          disabled={isPending}
                          onChange={(e) => handleReassign(issue.id, e.target.value)}
                          className="px-2 py-0.5 bg-white border border-border rounded-md font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {assignableMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : issue.assignedTo ? (
                        <span className="font-semibold text-ink">
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
                      {isOpen && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                          className="px-2.5 py-1 bg-surface hover:bg-slate-100 text-accent border border-border font-medium rounded-lg transition-colors cursor-pointer text-xs"
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
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-signal-green border border-emerald-200 font-medium rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          Resolve
                        </button>
                      )}

                      {isResolved && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdateStatus(issue.id, "Open")}
                          className="px-2.5 py-1 text-slate-500 hover:text-ink hover:bg-surface border border-border rounded-lg transition-colors cursor-pointer text-xs"
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
    </div>
  );
}
