"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import {
  createIssueAction,
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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Inline Resolution Form State
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // New Issue Form State
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState(projects[0]?.id || "");
  const [newAssignedToId, setNewAssignedToId] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newDescription, setNewDescription] = useState("");

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  // Filter calculation
  const filteredIssues = issues.filter((issue) => {
    // Search
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

    // Status filter
    if (statusFilter !== "All" && issue.status !== statusFilter) {
      return false;
    }

    // Project filter
    if (projectFilter !== "All" && issue.projectId !== projectFilter) {
      return false;
    }

    // Assignee filter
    if (assigneeFilter === "assigned_to_me") {
      if (issue.assignedTo?.id !== currentUser.id) return false;
    } else if (assigneeFilter === "reported_by_me") {
      if (issue.raisedBy.id !== currentUser.id) return false;
    } else if (assigneeFilter === "unassigned") {
      if (issue.assignedTo) return false;
    } else if (assigneeFilter !== "All") {
      if (issue.assignedTo?.id !== assigneeFilter) return false;
    }

    // Priority filter
    if (priorityFilter !== "All" && issue.priority !== priorityFilter) {
      return false;
    }

    return true;
  });

  // KPI calculations
  const totalCount = issues.length;
  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved" || i.status === "Closed").length;

  // Handlers
  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newProjectId) return;

    const formData = new FormData();
    formData.append("projectId", newProjectId);
    formData.append("title", newTitle);
    formData.append("description", newDescription);
    formData.append("priority", newPriority);
    formData.append("assignedToId", newAssignedToId || "none");

    startTransition(async () => {
      try {
        const created = await createIssueAction(formData);
        if (created) {
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
        }
        setIsReportModalOpen(false);
        setNewTitle("");
        setNewDescription("");
        setNewAssignedToId("");
        setNewPriority("Medium");
      } catch (err: any) {
        alert(err?.message || "Failed to create issue.");
      }
    });
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
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Medium":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "In Progress":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Closed":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/" label="Back to Dashboard" />

        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer"
        >
          <span>🐛</span>
          <span>+ Report Bug / Issue</span>
        </button>
      </div>

      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-md border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Live Issue Tracking
            </span>
            <span className="text-xs text-slate-400">Project Quality & Bug Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Issues & Bug Tracker
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl">
            Report bugs against projects, assign deliverables to team members, track resolution progress, and verify fixes in real-time.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center shrink-0 min-w-[150px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
            Resolution Rate
          </span>
          <span className="text-2xl font-black text-white">
            {totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100}%
          </span>
          <span className="text-[10px] text-slate-400 block">
            {resolvedCount} of {totalCount} closed
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Issues
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          <span className="text-[11px] text-slate-500">Across all projects</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/60 bg-rose-50/20 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
            Open Bugs
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">{openCount}</div>
          <span className="text-[11px] text-rose-600/80">Pending investigation</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
            In Progress
          </span>
          <div className="text-2xl font-black text-blue-600 mt-1">{inProgressCount}</div>
          <span className="text-[11px] text-blue-600/80">Being resolved</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
            Resolved & Closed
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</div>
          <span className="text-[11px] text-emerald-600/80">Fix shipped</span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues by title, project, member, or notes..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold overflow-x-auto">
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
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.key
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-semibold">Filters:</span>

          {/* Project Dropdown */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
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
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
          >
            <option value="All">All Assignees</option>
            <option value="assigned_to_me">Assigned to Me</option>
            <option value="reported_by_me">Reported by Me</option>
            <option value="unassigned">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                Member: {m.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
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
              className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Issues Feed / List */}
      {filteredIssues.length === 0 ? (
        <div className="bg-white p-12 border border-slate-200/80 rounded-3xl text-center space-y-3 shadow-2xs">
          <span className="text-4xl">🎉</span>
          <h3 className="text-base font-bold text-slate-800">
            {issues.length === 0 ? "No issues reported yet!" : "No issues match the active filters."}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {issues.length === 0
              ? "All assigned projects are running smoothly. Report a bug whenever an unexpected behavior or defect is discovered."
              : "Try adjusting your filters or search query to see other issue reports."}
          </p>
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer"
          >
            + Report a Bug
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => {
            const isOpen = issue.status === "Open";
            const isInProgress = issue.status === "In Progress";
            const isResolved = issue.status === "Resolved" || issue.status === "Closed";
            const canEdit =
              isSuperAdmin ||
              issue.assignedTo?.id === currentUser.id ||
              issue.raisedBy.id === currentUser.id;
            const canDelete = isSuperAdmin || issue.raisedBy.id === currentUser.id;

            return (
              <div
                key={issue.id}
                className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all shadow-2xs space-y-4 ${
                  isOpen
                    ? "border-rose-200/80 hover:border-rose-300"
                    : isInProgress
                    ? "border-blue-200/80 hover:border-blue-300"
                    : "border-slate-200/80 opacity-90"
                }`}
              >
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Priority Badge */}
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getPriorityBadgeClass(
                        issue.priority
                      )}`}
                    >
                      {issue.priority} Priority
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(
                        issue.status
                      )}`}
                    >
                      {issue.status}
                    </span>

                    {/* Project Pill */}
                    <Link
                      href={isSuperAdmin ? `/projects/${issue.projectId}` : "#"}
                      className="text-[11px] font-bold text-slate-600 hover:text-blue-600 bg-slate-100 px-2.5 py-0.5 rounded-full transition-colors"
                    >
                      📁 {issue.projectName}
                    </Link>
                  </div>

                  {/* Timestamp & Delete */}
                  <div className="flex items-center gap-2 text-slate-400 text-xs shrink-0">
                    <span>
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
                        className="p-1 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {issue.title}
                  </h2>
                  {issue.description && (
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                      {issue.description}
                    </p>
                  )}
                </div>

                {/* Resolution Note if resolved */}
                {issue.resolution && (
                  <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>✓ Resolution:</span>
                      {issue.resolvedAt && (
                        <span className="font-normal text-emerald-700 text-[10px]">
                          ({new Date(issue.resolvedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })})
                        </span>
                      )}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingIssueId === issue.id && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Resolution Explanation (How was this fixed?)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="e.g. Fixed input validation in checkout handler, tested on Safari & Chrome."
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingIssueId(null);
                          setResolutionText("");
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !resolutionText.trim()}
                        onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        {isPending ? "Resolving..." : "Confirm Fix & Resolve"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Meta & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  {/* People involved */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Reporter */}
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span>Reported by:</span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        {issue.raisedBy.name}
                      </span>
                    </div>

                    {/* Assigned Member */}
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span>Assigned to:</span>
                      {canEdit ? (
                        <select
                          value={issue.assignedTo?.id || ""}
                          disabled={isPending}
                          onChange={(e) => handleReassign(issue.id, e.target.value)}
                          className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : issue.assignedTo ? (
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
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
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          Start Working →
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
                          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          ✓ Resolve Bug
                        </button>
                      )}

                      {isResolved && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdateStatus(issue.id, "Open")}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Reopen Bug
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
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐛</span>
                <h3 className="text-lg font-bold text-slate-900">Report a Bug / Issue</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Document the defect against the project and assign the responsible member who should resolve it.
            </p>

            <form onSubmit={handleCreateIssue} className="space-y-4">
              {/* Issue Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Issue Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Navigation dropdown closes prematurely on mobile"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              {/* Project Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.client ? `(${p.client})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign to Team Member */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Assign To Member
                  </label>
                  <select
                    value={newAssignedToId}
                    onChange={(e) => setNewAssignedToId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Priority / Severity
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold cursor-pointer"
                  >
                    <option value="Low">Low (Trivial / cosmetic)</option>
                    <option value="Medium">Medium (Normal defect)</option>
                    <option value="High">High (Major feature broken)</option>
                    <option value="Critical">Critical (Blocker / crash)</option>
                  </select>
                </div>
              </div>

              {/* Description / Steps */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Steps to Reproduce & Defect Details
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="1. Open user profile&#10;2. Click on change avatar button&#10;3. Observe 500 server error in console"
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium leading-relaxed resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newTitle.trim() || !newProjectId}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Bug Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
