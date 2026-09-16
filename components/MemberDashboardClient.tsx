"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import TaskCard, { TaskCardData } from "./TaskCard";
import ReportBugModal from "./ReportBugModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";
import { updateIssueStatusAction } from "@/lib/actions";

export interface MemberIssueData {
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
  } | null;
}

interface MemberDashboardClientProps {
  memberName: string;
  currentUserId: string;
  tasks: TaskCardData[];
  issues?: MemberIssueData[];
  projects?: { id: string; name: string; client?: string | null }[];
  teamMembers?: { id: string; name: string; email: string; role?: string }[];
}

export default function MemberDashboardClient({
  memberName,
  currentUserId,
  tasks,
  issues: initialIssues = [],
  projects = [],
  teamMembers = [],
}: MemberDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "issues">("tasks");
  const [taskFilter, setTaskFilter] = useState<string>("All");
  const [issueFilter, setIssueFilter] = useState<string>("All");

  // Only non-admin workers can be reported on for bugs (Admin cannot be assigned bugs)
  const assignableMembers = useMemo(() => {
    return teamMembers.filter(
      (m) =>
        m.role !== "SUPER_ADMIN" &&
        !m.name.toLowerCase().includes("super admin") &&
        !m.email.toLowerCase().includes("admin@")
    );
  }, [teamMembers]);

  const [issues, setIssues] = useState<MemberIssueData[]>(initialIssues);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [modalDefaults, setModalDefaults] = useState<{
    projectId: string;
    assignedToId: string;
    title: string;
  }>({
    projectId: projects[0]?.id || "",
    assignedToId: "",
    title: "",
  });

  const [isPending, startTransition] = useTransition();

  // Inline resolution state
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // Task Stats
  const todoTasks = tasks.filter((t) => t.status === "To Do");
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress");
  const inReviewTasks = tasks.filter((t) => t.status === "In Review");
  const doneTasks = tasks.filter((t) => t.status === "Done");
  const blockedTasks = tasks.filter((t) => t.status === "Blocked");

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "All" || taskFilter === "all") return true;
    return t.status === taskFilter;
  });

  const totalTasks = tasks.length;
  const completedTasks = doneTasks.length;
  const totalBlockers = tasks.reduce(
    (acc, t) => acc + (t.openObjectionsCount || 0),
    0
  );

  // Issue Stats
  const myAssignedIssues = issues.filter((i) => i.assignedTo?.id === currentUserId);
  const openIssues = issues.filter((i) => i.status === "Open");
  const inProgressIssues = issues.filter((i) => i.status === "In Progress");
  const resolvedIssues = issues.filter(
    (i) => i.status === "Resolved" || i.status === "Closed"
  );

  const filteredIssues = issues.filter((issue) => {
    if (issueFilter === "all" || issueFilter === "All") return true;
    if (issueFilter === "Assigned to Me") return issue.assignedTo?.id === currentUserId;
    if (issueFilter === "Reported by Me") return issue.raisedBy.id === currentUserId;
    return issue.status === issueFilter;
  });

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
        alert(err?.message || "Failed to update bug status.");
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
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white p-6 sm:p-8 rounded-3xl shadow-md shadow-blue-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 px-2 py-0.5 rounded-full bg-white/10">
              Worker Workspace
            </span>
            <span className="text-xs text-blue-100 font-semibold">• Live Deliverables & Issues</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {memberName}!
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl leading-relaxed">
            Track your assigned deliverables, post work logs, and report or resolve project bugs directly against teammates.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenReportModal()}
            className="px-4 py-2.5 bg-white text-rose-700 hover:bg-rose-50 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🐛</span>
            <span>+ Report Bug Against Member</span>
          </button>

          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-center min-w-[120px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
              Tasks Done
            </span>
            <span className="text-xl font-black">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </span>
            <span className="text-[10px] text-blue-100 block">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        </div>
      </div>

      {/* QUICK BUG REPORT: CLICK ANY TEAM MEMBER */}
      {assignableMembers.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                Quick Bug Report Against Teammates
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Click any member to log a bug against their deliverables:
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {assignableMembers.map((m) => {
              const isMe = m.id === currentUserId;
              const initials = m.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleOpenReportModal(m.id)}
                  className={`px-3 py-2 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                    isMe
                      ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      : "bg-rose-50/60 hover:bg-rose-100/80 border-rose-200 text-rose-900 shadow-2xs hover:border-rose-300"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                      isMe ? "bg-slate-200 text-slate-700" : "bg-rose-600 text-white"
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-bold truncate">
                      {m.name} {isMe ? "(You)" : ""}
                    </p>
                    <p className="text-[9px] text-rose-600/80 font-semibold">
                      {isMe ? "Self-assign" : "Report bug →"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Workspace Navigation Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "tasks"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <span>📋 Deliverables & Tasks</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === "tasks" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {tasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("issues")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "issues"
                ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <span>🐛 Bugs & Issues</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === "issues" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
              }`}
            >
              {issues.length}
            </span>
          </button>
        </div>

        <Link
          href="/issues"
          className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
        >
          <span>Open Full Bug Tracker</span>
          <span>→</span>
        </Link>
      </div>

      {/* TAB 1: DELIVERABLES & TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Tasks
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalTasks}</div>
              <span className="text-[11px] text-slate-500">Total assigned to you</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                In Progress
              </span>
              <div className="text-2xl font-black text-blue-600 mt-1">{inProgressTasks.length}</div>
              <span className="text-[11px] text-slate-500">Actively underway</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Roadblocks
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1">{blockedTasks.length}</div>
              <span className="text-[11px] text-slate-500">
                {totalBlockers} open objection{totalBlockers !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Completed
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{completedTasks}</div>
              <span className="text-[11px] text-slate-500">Successfully shipped</span>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl max-w-xl text-xs font-bold flex-wrap">
            {[
              { key: "All", label: `All (${totalTasks})` },
              { key: "To Do", label: `To Do (${todoTasks.length})` },
              { key: "In Progress", label: `In Progress (${inProgressTasks.length})` },
              { key: "In Review", label: `In Review (${inReviewTasks.length})` },
              { key: "Done", label: `Done (${doneTasks.length})` },
              { key: "Blocked", label: `Blocked (${blockedTasks.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTaskFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  taskFilter === tab.key
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tasks Grid */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white p-12 border border-slate-200/80 rounded-3xl text-center space-y-2 shadow-2xs">
              <span className="text-3xl">☕</span>
              <h3 className="text-sm font-bold text-slate-800">
                {taskFilter === "All"
                  ? "You have no assigned tasks yet."
                  : `No tasks found with status "${taskFilter}".`}
              </h3>
              <p className="text-xs text-slate-400">
                Your team lead will assign deliverables to you as project milestones are defined.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showProject={true}
                  onReportBug={(t) => {
                    handleOpenReportModal(
                      t.assignedTo?.id || "",
                      t.projectId || "",
                      `Defect on task: ${t.title}`
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUGS & ISSUES */}
      {activeTab === "issues" && (
        <div className="space-y-6">
          {/* Issue KPI Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Issues
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">{issues.length}</div>
              <span className="text-[11px] text-slate-500">Related to your work</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/60 bg-rose-50/20 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
                Assigned to You
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1">{myAssignedIssues.length}</div>
              <span className="text-[11px] text-rose-600/80">Need your resolution</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                In Progress
              </span>
              <div className="text-2xl font-black text-blue-600 mt-1">{inProgressIssues.length}</div>
              <span className="text-[11px] text-blue-600/80">Active fixes</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
                Resolved
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{resolvedIssues.length}</div>
              <span className="text-[11px] text-emerald-600/80">Verified & closed</span>
            </div>
          </div>

          {/* Issue Filters */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl max-w-xl text-xs font-bold flex-wrap">
            {[
              { key: "All", label: `All (${issues.length})` },
              { key: "Assigned to Me", label: `Assigned to Me (${myAssignedIssues.length})` },
              { key: "Open", label: `Open (${openIssues.length})` },
              { key: "In Progress", label: `In Progress (${inProgressIssues.length})` },
              { key: "Resolved", label: `Resolved (${resolvedIssues.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setIssueFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  issueFilter === tab.key
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Issues List */}
          {filteredIssues.length === 0 ? (
            <div className="bg-white p-12 border border-slate-200/80 rounded-3xl text-center space-y-3 shadow-2xs">
              <span className="text-3xl">🎉</span>
              <h3 className="text-sm font-bold text-slate-800">No issues found</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No bugs are currently blocking your deliverables under this filter.
              </p>
              <button
                type="button"
                onClick={() => handleOpenReportModal()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                + Report a Defect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue) => {
                const isOpen = issue.status === "Open";
                const isInProgress = issue.status === "In Progress";
                const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                const isMyIssue = issue.assignedTo?.id === currentUserId;

                return (
                  <div
                    key={issue.id}
                    className={`bg-white p-5 rounded-3xl border transition-all shadow-2xs space-y-3.5 ${
                      isMyIssue && isOpen
                        ? "border-rose-300 ring-2 ring-rose-500/10"
                        : "border-slate-200/80"
                    }`}
                  >
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
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          📁 {issue.projectName}
                        </span>
                      </div>

                      <span className="text-slate-400 text-[11px]">
                        {new Date(issue.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {issue.title}
                      </h3>
                      {issue.description && (
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {issue.description}
                        </p>
                      )}

                      {/* Bug Evidence / Attachment */}
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
                      <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                        <span className="font-bold block">✓ Resolution Note:</span>
                        <p className="whitespace-pre-wrap">{issue.resolution}</p>
                      </div>
                    )}

                    {/* Inline Resolution Box */}
                    {resolvingIssueId === issue.id && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          How did you resolve this bug?
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="e.g. Corrected CSS overflow issue and updated mobile breakpoint."
                          className="w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingIssueId(null);
                              setResolutionText("");
                            }}
                            className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/60 rounded-xl"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isPending || !resolutionText.trim()}
                            onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                            className="px-4 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            {isPending ? "Saving..." : "Confirm Fix & Resolve"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* People & Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-3 text-slate-500">
                        <span>
                          Reported by: <strong className="text-slate-700">{issue.raisedBy.name}</strong>
                        </span>
                        <span>
                          Assigned to:{" "}
                          <strong className="text-slate-700">
                            {issue.assignedTo ? issue.assignedTo.name : "Unassigned"}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOpen && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 transition-colors cursor-pointer"
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
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                          >
                            ✓ Mark as Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Unified Intuitive Report Bug Modal */}
      <ReportBugModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        projects={projects}
        teamMembers={assignableMembers}
        defaultProjectId={modalDefaults.projectId}
        defaultAssignedToId={modalDefaults.assignedToId}
        defaultTitle={modalDefaults.title}
        onSuccess={(created) => {
          const formatted: MemberIssueData = {
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
