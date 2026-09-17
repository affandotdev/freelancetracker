"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import TaskCard, { TaskCardData } from "./TaskCard";
import ReportBugModal from "./ReportBugModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";
import ScheduleMeetingModal from "./ScheduleMeetingModal";
import LogMeetingFollowUpModal from "./LogMeetingFollowUpModal";
import LogDirectMeetingModal from "./LogDirectMeetingModal";
import { updateIssueStatusAction, updateMeetingStatusAction } from "@/lib/actions";

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

export interface MemberMeetingData {
  id: string;
  projectId: string | null;
  projectName: string | null;
  projectClient: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  title: string;
  type: string;
  platform: string;
  meetingLink: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  agenda: string | null;
  notes: string | null;
  actionItems: string | null;
  outcome: string | null;
  nextFollowUpDate: string | null;
  completedAt: string | null;
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
  meetings?: MemberMeetingData[];
  projects?: { id: string; name: string; client?: string | null }[];
  teamMembers?: { id: string; name: string; email: string; role?: string }[];
}

export default function MemberDashboardClient({
  memberName,
  currentUserId,
  tasks,
  issues: initialIssues = [],
  meetings: initialMeetings = [],
  projects = [],
  teamMembers = [],
}: MemberDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "issues" | "meetings">("tasks");
  const [taskFilter, setTaskFilter] = useState<string>("All");
  const [issueFilter, setIssueFilter] = useState<string>("All");
  const [meetingFilter, setMeetingFilter] = useState<string>("All");
  const [issueViewMode, setIssueViewMode] = useState<"table" | "cards">("table");
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Set<string>>(new Set());

  const [meetings, setMeetings] = useState<MemberMeetingData[]>(initialMeetings);
  const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false);
  const [isDirectMeetingModalOpen, setIsDirectMeetingModalOpen] = useState(false);
  const [directMeetingDefaults, setDirectMeetingDefaults] = useState<{
    projectId: string;
    title: string;
  }>({
    projectId: "",
    title: "Ad-hoc Client Meeting",
  });
  const [activeFollowUpMeeting, setActiveFollowUpMeeting] = useState<MemberMeetingData | null>(null);

  const handleOpenDirectMeetingModal = (projectId = "", title = "Ad-hoc Client Meeting") => {
    setDirectMeetingDefaults({
      projectId: projectId || projects[0]?.id || "",
      title: title || "Ad-hoc Client Meeting",
    });
    setIsDirectMeetingModalOpen(true);
  };

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
      {/* Welcome Banner */}
      <div className="bg-white border border-border p-6 sm:p-7 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded bg-surface border border-border">
              Worker Workspace
            </span>
            <span className="text-xs text-slate-400 font-medium">• Live Deliverables & Issues</span>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Welcome back, {memberName}
          </h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Track your assigned deliverables, post work logs, and report or resolve project bugs directly against teammates.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenReportModal()}
            className="px-4 py-2 bg-accent hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            + Report Defect
          </button>

          <div className="bg-surface p-3 rounded-lg border border-border text-center min-w-[110px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              Tasks Done
            </span>
            <span className="text-xl font-bold text-ink tabular-nums block">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </span>
            <span className="text-[11px] text-slate-500 block tabular-nums">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        </div>
      </div>

      {/* UPCOMING CALLS & PENDING NOTES ALERT BANNER */}
      {meetings.filter((m) => {
        const isUpcoming = m.status === "Scheduled" && new Date(m.scheduledAt).getTime() - Date.now() < 86400000;
        const needsNotes = m.status === "Scheduled" && new Date(m.scheduledAt).getTime() < Date.now();
        return isUpcoming || needsNotes;
      }).length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-4 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                  Client Meeting Alert
                </span>
                <span className="text-[10px] bg-purple-200/60 text-purple-800 px-1.5 py-0.2 rounded font-semibold">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-purple-950 mt-0.5 font-medium">
                You have active client calls scheduled or awaiting discussion notes & outcome updates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDirectMeetingModalOpen(true)}
              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              + Log Call Notes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("meetings")}
              className="px-3 py-1.5 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              View Calls →
            </button>
          </div>
        </div>
      )}

      {/* QUICK BUG REPORT: CLICK ANY TEAM MEMBER */}
      {assignableMembers.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-lg border border-border shadow-xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Quick Defect Assignment Against Teammates
            </h3>
            <span className="text-[11px] text-slate-400">
              Click a member to log a defect against their deliverable:
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
                  className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
                    isMe
                      ? "bg-surface hover:bg-slate-100 border-border text-slate-700"
                      : "bg-white hover:bg-surface border-border text-slate-800"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] ${
                      isMe ? "bg-slate-200 text-slate-700" : "bg-slate-800 text-white"
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-semibold truncate">
                      {m.name} {isMe ? "(You)" : ""}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {isMe ? "Self-assign" : "Report defect →"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Workspace Navigation Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "tasks"
                ? "bg-ink text-white font-semibold"
                : "bg-white text-slate-600 hover:text-ink border border-border"
            }`}
          >
            <span>Deliverables & Tasks</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                activeTab === "tasks" ? "bg-white/20 text-white" : "bg-surface text-slate-600 border border-border"
              }`}
            >
              {tasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("issues")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "issues"
                ? "bg-ink text-white font-semibold"
                : "bg-white text-slate-600 hover:text-ink border border-border"
            }`}
          >
            <span>Bugs & Issues</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                activeTab === "issues" ? "bg-white/20 text-white" : "bg-surface text-slate-600 border border-border"
              }`}
            >
              {issues.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("meetings")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "meetings"
                ? "bg-ink text-white font-semibold"
                : "bg-white text-slate-600 hover:text-ink border border-border"
            }`}
          >
            <span>Meetings & Follow-ups</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                activeTab === "meetings" ? "bg-white/20 text-white" : "bg-surface text-slate-600 border border-border"
              }`}
            >
              {meetings.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "meetings" ? (
            <Link
              href="/meetings"
              className="text-xs font-medium text-slate-500 hover:text-ink transition-colors flex items-center gap-1"
            >
              <span>Open Meetings Hub</span>
              <span>→</span>
            </Link>
          ) : (
            <Link
              href="/issues"
              className="text-xs font-medium text-slate-500 hover:text-ink transition-colors flex items-center gap-1"
            >
              <span>Open Full Bug Tracker</span>
              <span>→</span>
            </Link>
          )}
        </div>
      </div>

      {/* TAB 1: DELIVERABLES & TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Assigned Tasks
              </span>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{totalTasks}</div>
              <span className="text-[11px] text-slate-500">Total assigned to you</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                In Progress
              </span>
              <div className="text-2xl font-bold text-accent mt-1 tabular-nums">{inProgressTasks.length}</div>
              <span className="text-[11px] text-slate-500">Actively underway</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Roadblocks
              </span>
              <div className="text-2xl font-bold text-signal-red mt-1 tabular-nums">{blockedTasks.length}</div>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {totalBlockers} open objection{totalBlockers !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Completed
              </span>
              <div className="text-2xl font-bold text-signal-green mt-1 tabular-nums">{completedTasks}</div>
              <span className="text-[11px] text-slate-500">Successfully shipped</span>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface rounded-lg border border-border max-w-xl text-xs font-medium flex-wrap">
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
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer tabular-nums ${
                  taskFilter === tab.key
                    ? "bg-white text-ink font-semibold shadow-xs border border-border/80"
                    : "text-slate-600 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tasks Grid */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white p-12 border border-border rounded-lg text-center space-y-1 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-800">
                {taskFilter === "All"
                  ? "You have no assigned tasks yet."
                  : `No tasks found with status "${taskFilter}".`}
              </h3>
              <p className="text-xs text-slate-400">
                Your team lead will assign deliverables to you as project milestones are defined.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showProject={true}
                  onLogMeeting={(t) => {
                    handleOpenDirectMeetingModal(
                      t.projectId || "",
                      `Meeting update: ${t.title}`
                    );
                  }}
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

      {/* TAB 2: BUGS & ISSUES (TABLE VIEW PRIMARY) */}
      {activeTab === "issues" && (
        <div className="space-y-6">
          {/* Issue KPI Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Issues
              </span>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{issues.length}</div>
              <span className="text-[11px] text-slate-500">Related to your work</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-red-200/60 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-red block">
                Assigned to You
              </span>
              <div className="text-2xl font-bold text-signal-red mt-1 tabular-nums">{myAssignedIssues.length}</div>
              <span className="text-[11px] text-slate-500">Need your resolution</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-blue-200/60 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent block">
                In Progress
              </span>
              <div className="text-2xl font-bold text-accent mt-1 tabular-nums">{inProgressIssues.length}</div>
              <span className="text-[11px] text-slate-500">Active fixes</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-emerald-200/60 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-green block">
                Resolved
              </span>
              <div className="text-2xl font-bold text-signal-green mt-1 tabular-nums">{resolvedIssues.length}</div>
              <span className="text-[11px] text-slate-500">Verified & closed</span>
            </div>
          </div>

          {/* Issue Filters & View Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-surface rounded-lg border border-border max-w-xl text-xs font-medium flex-wrap">
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
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer tabular-nums ${
                    issueFilter === tab.key
                      ? "bg-white text-ink font-semibold shadow-xs border border-border/80"
                      : "text-slate-600 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex p-0.5 bg-surface border border-border rounded-lg text-xs font-medium shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIssueViewMode("table")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  issueViewMode === "table"
                    ? "bg-white text-ink font-semibold shadow-xs border border-border/80"
                    : "text-slate-500 hover:text-ink"
                }`}
              >
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setIssueViewMode("cards")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  issueViewMode === "cards"
                    ? "bg-white text-ink font-semibold shadow-xs border border-border/80"
                    : "text-slate-500 hover:text-ink"
                }`}
              >
                <span>Cards</span>
              </button>
            </div>
          </div>

          {/* Issues Presentation: Table View (Primary) vs Cards View */}
          {filteredIssues.length === 0 ? (
            <div className="bg-white p-12 border border-border rounded-lg text-center space-y-3 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-800">No issues found</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No bugs are currently blocking your deliverables under this filter.
              </p>
              <button
                type="button"
                onClick={() => handleOpenReportModal()}
                className="px-4 py-2 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                + Report a Defect
              </button>
            </div>
          ) : issueViewMode === "table" ? (
            /* TABLE FORMAT (PRIMARY) */
            <div className="bg-white border border-border rounded-lg shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface border-b border-border text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-10 text-center">#</th>
                      <th className="py-3 px-4 min-w-[240px]">Defect / Issue Title</th>
                      <th className="py-3 px-4 min-w-[140px]">Project</th>
                      <th className="py-3 px-4 w-28">Priority</th>
                      <th className="py-3 px-4 w-28">Status</th>
                      <th className="py-3 px-4 min-w-[140px]">Assigned To</th>
                      <th className="py-3 px-4 min-w-[130px]">Reported By</th>
                      <th className="py-3 px-4 min-w-[150px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredIssues.map((issue) => {
                      const isOpen = issue.status === "Open";
                      const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                      const isMyIssue = issue.assignedTo?.id === currentUserId;
                      const isExpanded = expandedIssueIds.has(issue.id);

                      return (
                        <React.Fragment key={issue.id}>
                          <tr
                            className={`hover:bg-surface/70 transition-colors group ${
                              isMyIssue && isOpen ? "bg-red-50/20" : ""
                            } ${isExpanded ? "bg-surface/50" : ""}`}
                          >
                            {/* Expand icon */}
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
                              <span className="font-medium text-slate-700 block truncate max-w-[150px]">
                                {issue.projectName}
                              </span>
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

                            {/* Assigned To */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-medium ${
                                  isMyIssue ? "text-accent font-semibold" : "text-slate-800"
                                }`}
                              >
                                {issue.assignedTo ? (
                                  <>
                                    {issue.assignedTo.name} {isMyIssue ? "(You)" : ""}
                                  </>
                                ) : (
                                  <span className="italic text-slate-400">Unassigned</span>
                                )}
                              </span>
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
                                {isOpen && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                    className="px-2.5 py-1 bg-surface hover:bg-slate-100 text-accent border border-border font-medium rounded text-[11px] transition-colors cursor-pointer"
                                  >
                                    Start Work
                                  </button>
                                )}

                                {!isResolved && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => {
                                      toggleRowExpansion(issue.id);
                                      setResolvingIssueId(issue.id);
                                      setResolutionText("");
                                    }}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-signal-green border border-emerald-200 font-medium rounded text-[11px] transition-colors cursor-pointer"
                                  >
                                    Resolve
                                  </button>
                                )}

                                {isResolved && (
                                  <span className="text-[11px] font-medium text-signal-green">
                                    Resolved
                                  </span>
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
                                        Attached Bug Evidence
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
                                      <span className="font-semibold block">Resolution Note:</span>
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
                                        placeholder="e.g. Corrected CSS overflow issue and updated mobile breakpoint."
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
                                          {isPending ? "Saving..." : "Confirm Fix & Resolve"}
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
                const isMyIssue = issue.assignedTo?.id === currentUserId;

                return (
                  <div
                    key={issue.id}
                    className={`bg-white p-5 rounded-lg border transition-colors shadow-xs space-y-3.5 ${
                      isMyIssue && isOpen
                        ? "border-red-300 ring-1 ring-red-200"
                        : "border-border"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                            issue.priority
                          )}`}
                        >
                          {issue.priority} Priority
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${getStatusBadgeClass(
                            issue.status
                          )}`}
                        >
                          {issue.status}
                        </span>
                        <span className="text-[11px] font-medium text-slate-600 bg-surface border border-border px-2 py-0.5 rounded">
                          {issue.projectName}
                        </span>
                      </div>

                      <span className="text-slate-400 text-[11px] tabular-nums">
                        {new Date(issue.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-ink">
                        {issue.title}
                      </h3>
                      {issue.description && (
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-surface p-3 rounded-lg border border-border">
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
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-signal-green space-y-0.5">
                        <span className="font-semibold block">Resolution Note:</span>
                        <p className="whitespace-pre-wrap">{issue.resolution}</p>
                      </div>
                    )}

                    {/* Inline Resolution Box */}
                    {resolvingIssueId === issue.id && (
                      <div className="bg-surface p-3 rounded-lg border border-border space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          How did you resolve this bug?
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="e.g. Corrected CSS overflow issue and updated mobile breakpoint."
                          className="w-full p-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingIssueId(null);
                              setResolutionText("");
                            }}
                            className="px-3 py-1 text-xs text-slate-600 bg-white hover:bg-surface border border-border rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isPending || !resolutionText.trim()}
                            onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                            className="px-3.5 py-1 bg-signal-green hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isPending ? "Saving..." : "Confirm Fix & Resolve"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* People & Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
                      <div className="flex items-center gap-3 text-slate-500">
                        <span>
                          Reported by: <strong className="text-slate-700 font-semibold">{issue.raisedBy.name}</strong>
                        </span>
                        <span>
                          Assigned to:{" "}
                          <strong className="text-slate-700 font-semibold">
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
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-accent font-semibold rounded-lg border border-blue-200 transition-colors cursor-pointer"
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
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-signal-green font-semibold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                          >
                            Mark as Resolved
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

      {/* TAB 3: CLIENT MEETINGS & FOLLOW-UPS */}
      {activeTab === "meetings" && (
        <div className="space-y-6">
          {/* Header Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-border">
            <div>
              <h2 className="text-base font-semibold text-ink">Client Calls & Follow-up Logs</h2>
              <p className="text-xs text-gray-500">
                View scheduled syncs, launch video links, or record offline phone calls & client feedback immediately.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsDirectMeetingModalOpen(true)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Log Direct / Offline Call</span>
              </button>
              <button
                type="button"
                onClick={() => setIsScheduleMeetingOpen(true)}
                className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Schedule Call</span>
              </button>
              <Link
                href="/meetings"
                className="px-3.5 py-1.5 bg-surface hover:bg-gray-100 text-gray-700 border border-border font-medium text-xs rounded-lg transition-colors"
              >
                Full Hub ↗
              </Link>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Calls
              </span>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{meetings.length}</div>
              <span className="text-[11px] text-slate-500">Assigned / scheduled</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Scheduled
              </span>
              <div className="text-2xl font-bold text-accent mt-1 tabular-nums">
                {meetings.filter((m) => m.status === "Scheduled").length}
              </div>
              <span className="text-[11px] text-slate-500">Upcoming calls</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Completed
              </span>
              <div className="text-2xl font-bold text-signal-green mt-1 tabular-nums">
                {meetings.filter((m) => m.status === "Completed").length}
              </div>
              <span className="text-[11px] text-slate-500">Past discussions</span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Action Items
              </span>
              <div className="text-2xl font-bold text-signal-amber mt-1 tabular-nums">
                {meetings.filter((m) => m.nextFollowUpDate || m.outcome === "Follow-up Required").length}
              </div>
              <span className="text-[11px] text-slate-500">Pending follow-ups</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-border">
            <span className="text-xs text-gray-500 font-medium">Filter:</span>
            {["All", "Scheduled", "Completed", "Follow-up Required"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setMeetingFilter(filter)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  meetingFilter === filter
                    ? "bg-ink text-white font-semibold"
                    : "bg-surface text-gray-600 hover:text-ink border border-border"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Meetings Table */}
          <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            {meetings.filter((m) => {
              if (meetingFilter === "Scheduled") return m.status === "Scheduled";
              if (meetingFilter === "Completed") return m.status === "Completed";
              if (meetingFilter === "Follow-up Required")
                return m.outcome === "Follow-up Required" || (m.nextFollowUpDate && new Date(m.nextFollowUpDate) >= new Date());
              return true;
            }).length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-gray-500">No meetings found for the selected filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface/75 border-b border-border text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Timing & Status</th>
                      <th className="py-3 px-4">Client & Title</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Platform & Link</th>
                      <th className="py-3 px-4">Outcome & Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {meetings
                      .filter((m) => {
                        if (meetingFilter === "Scheduled") return m.status === "Scheduled";
                        if (meetingFilter === "Completed") return m.status === "Completed";
                        if (meetingFilter === "Follow-up Required")
                          return (
                            m.outcome === "Follow-up Required" ||
                            (m.nextFollowUpDate && new Date(m.nextFollowUpDate) >= new Date())
                          );
                        return true;
                      })
                      .map((m) => {
                        const isExpanded = expandedMeetingIds.has(m.id);
                        return (
                          <React.Fragment key={m.id}>
                            <tr className="hover:bg-surface/50 transition-colors">
                              <td className="py-3 px-4 align-top whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                      m.status === "Completed"
                                        ? "bg-signal-green/10 text-signal-green border border-signal-green/20"
                                        : m.status === "Cancelled"
                                        ? "bg-gray-100 text-gray-500"
                                        : "bg-blue-50 text-accent border border-blue-200"
                                    }`}
                                  >
                                    {m.status}
                                  </span>
                                  <span className="font-semibold text-ink tabular-nums">
                                    {new Date(m.scheduledAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                  <span className="text-[11px] text-gray-500 tabular-nums">
                                    {new Date(m.scheduledAt).toLocaleTimeString(undefined, {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    ({m.durationMinutes}m)
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4 align-top">
                                <div className="font-semibold text-ink">{m.title}</div>
                                <div className="text-gray-600 text-[11px] mt-0.5">
                                  <span className="font-medium">{m.clientName}</span>
                                  {m.clientPhone && (
                                    <span className="text-gray-400 ml-1.5">· {m.clientPhone}</span>
                                  )}
                                </div>
                                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-surface text-gray-600 border border-border font-medium">
                                  {m.type}
                                </span>
                              </td>

                              <td className="py-3 px-4 align-top">
                                {m.projectId ? (
                                  <Link
                                    href={`/projects/${m.projectId}`}
                                    className="font-medium text-accent hover:underline"
                                  >
                                    {m.projectName}
                                  </Link>
                                ) : (
                                  <span className="text-gray-400 italic">General</span>
                                )}
                              </td>

                              <td className="py-3 px-4 align-top">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-700">{m.platform}</span>
                                  {m.meetingLink ? (
                                    <a
                                      href={m.meetingLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                                    >
                                      Join Call ↗
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-gray-400">No link</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 align-top">
                                <div className="flex flex-col gap-1">
                                  {m.outcome && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-accent border border-blue-200">
                                      {m.outcome}
                                    </span>
                                  )}
                                  {m.notes ? (
                                    <p className="text-[11px] text-gray-500 line-clamp-1">{m.notes}</p>
                                  ) : (
                                    <span className="text-[11px] text-gray-400 italic">No notes logged</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setActiveFollowUpMeeting(m)}
                                    className="px-2.5 py-1 text-[11px] font-medium text-accent bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                                  >
                                    Log Follow-up
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedMeetingIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(m.id)) next.delete(m.id);
                                        else next.add(m.id);
                                        return next;
                                      });
                                    }}
                                    className="p-1 text-gray-400 hover:text-ink text-xs rounded hover:bg-gray-100"
                                  >
                                    {isExpanded ? "▲" : "▼"}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-surface/40 border-b border-border">
                                <td colSpan={6} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                    <div className="p-3 bg-white border border-border rounded-md">
                                      <h5 className="font-semibold text-gray-700 mb-1">Agenda</h5>
                                      <p className="text-gray-600 whitespace-pre-line">
                                        {m.agenda || "No agenda set."}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white border border-border rounded-md">
                                      <h5 className="font-semibold text-gray-700 mb-1">Discussion Notes</h5>
                                      <p className="text-gray-600 whitespace-pre-line">
                                        {m.notes || "No notes logged."}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white border border-border rounded-md">
                                      <h5 className="font-semibold text-gray-700 mb-1">Action Items</h5>
                                      <p className="text-gray-600 whitespace-pre-line">
                                        {m.actionItems || "No action items recorded."}
                                      </p>
                                    </div>
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
            )}
          </div>
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

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleMeetingOpen}
        onClose={() => setIsScheduleMeetingOpen(false)}
        teamMembers={teamMembers as any}
        projects={projects}
        isSuperAdmin={false}
        currentUserId={currentUserId}
        onMeetingCreated={(created) => {
          const formatted: MemberMeetingData = {
            id: created.id,
            projectId: created.projectId,
            projectName: created.project?.name || null,
            projectClient: created.project?.client || null,
            clientName: created.clientName,
            clientEmail: created.clientEmail || null,
            clientPhone: created.clientPhone || null,
            title: created.title,
            type: created.type,
            platform: created.platform,
            meetingLink: created.meetingLink || null,
            scheduledAt: new Date(created.scheduledAt).toISOString(),
            durationMinutes: created.durationMinutes,
            status: created.status,
            agenda: created.agenda || null,
            notes: created.notes || null,
            actionItems: created.actionItems || null,
            outcome: created.outcome || null,
            nextFollowUpDate: created.nextFollowUpDate
              ? new Date(created.nextFollowUpDate).toISOString()
              : null,
            completedAt: created.completedAt ? new Date(created.completedAt).toISOString() : null,
            assignedTo: created.assignedTo
              ? {
                  id: created.assignedTo.id,
                  name: created.assignedTo.name,
                  email: created.assignedTo.email,
                }
              : null,
          };
          setMeetings((prev) => [formatted, ...prev]);
        }}
      />

      {/* Log Follow-up Modal */}
      <LogMeetingFollowUpModal
        isOpen={!!activeFollowUpMeeting}
        onClose={() => setActiveFollowUpMeeting(null)}
        meeting={activeFollowUpMeeting as any}
        onSaved={(updated) => {
          setMeetings((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    notes: updated.notes,
                    outcome: updated.outcome,
                    actionItems: updated.actionItems,
                    nextFollowUpDate: updated.nextFollowUpDate
                      ? new Date(updated.nextFollowUpDate).toISOString()
                      : null,
                    status: updated.status,
                    completedAt: updated.completedAt
                      ? new Date(updated.completedAt).toISOString()
                      : null,
                  }
                : m
            )
          );
        }}
      />

      {/* Log Direct / Unscheduled Meeting Modal */}
      <LogDirectMeetingModal
        isOpen={isDirectMeetingModalOpen}
        onClose={() => setIsDirectMeetingModalOpen(false)}
        projects={projects}
        defaultProjectId={directMeetingDefaults.projectId}
        defaultTitle={directMeetingDefaults.title}
        onMeetingLogged={(logged) => {
          const formatted: MemberMeetingData = {
            id: logged.id,
            projectId: logged.projectId,
            projectName: logged.project?.name || null,
            projectClient: logged.project?.client || null,
            clientName: logged.clientName,
            clientEmail: logged.clientEmail || null,
            clientPhone: logged.clientPhone || null,
            title: logged.title,
            type: logged.type,
            platform: logged.platform,
            meetingLink: logged.meetingLink || null,
            scheduledAt: new Date(logged.scheduledAt).toISOString(),
            durationMinutes: logged.durationMinutes,
            status: logged.status,
            agenda: logged.agenda || null,
            notes: logged.notes || null,
            actionItems: logged.actionItems || null,
            outcome: logged.outcome || null,
            nextFollowUpDate: logged.nextFollowUpDate
              ? new Date(logged.nextFollowUpDate).toISOString()
              : null,
            completedAt: logged.completedAt ? new Date(logged.completedAt).toISOString() : null,
            assignedTo: logged.assignedTo
              ? {
                  id: logged.assignedTo.id,
                  name: logged.assignedTo.name,
                  email: logged.assignedTo.email,
                }
              : null,
          };
          setMeetings((prev) => [formatted, ...prev]);
        }}
      />
    </div>
  );
}
