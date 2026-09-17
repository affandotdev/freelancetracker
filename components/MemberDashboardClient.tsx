"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import TaskCard, { TaskCardData } from "./TaskCard";
import ReportBugModal from "./ReportBugModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";
import ScheduleMeetingModal from "./ScheduleMeetingModal";
import LogMeetingFollowUpModal from "./LogMeetingFollowUpModal";
import LogDirectMeetingModal from "./LogDirectMeetingModal";
import EditTaskModal, { EditableTaskData } from "./EditTaskModal";
import EditIssueModal from "./EditIssueModal";
import { updateIssueStatusAction, updateMeetingStatusAction, deleteIssueAction } from "@/lib/actions";

export interface MemberIssueData {
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
  tasks: initialTasks = [],
  issues: initialIssues = [],
  meetings: initialMeetings = [],
  projects = [],
  teamMembers = [],
}: MemberDashboardClientProps) {
  const [tasks, setTasks] = useState<TaskCardData[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<"tasks" | "issues" | "meetings">("tasks");
  const [taskFilter, setTaskFilter] = useState<string>("All");
  const [issueFilter, setIssueFilter] = useState<string>("All");
  const [moduleFilter, setModuleFilter] = useState<string>("All");
  const [issueSearchQuery, setIssueSearchQuery] = useState<string>("");
  const [isTableMaximized, setIsTableMaximized] = useState<boolean>(false);
  const [meetingFilter, setMeetingFilter] = useState<string>("All");
  const [meetingSearchQuery, setMeetingSearchQuery] = useState<string>("");
  const [isMeetingTableMaximized, setIsMeetingTableMaximized] = useState<boolean>(false);
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
    projectId: "",
    assignedToId: "",
    title: "",
  });

  const [taskToEdit, setTaskToEdit] = useState<EditableTaskData | null>(null);
  const [editingIssue, setEditingIssue] = useState<MemberIssueData | null>(null);
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
    if (moduleFilter !== "All" && (issue.module || "User Side") !== moduleFilter) return false;
    if (issueFilter === "Assigned to Me") {
      if (issue.assignedTo?.id !== currentUserId) return false;
    } else if (issueFilter === "Reported by Me") {
      if (issue.raisedBy.id !== currentUserId) return false;
    } else if (issueFilter !== "all" && issueFilter !== "All") {
      if (issue.status !== issueFilter) return false;
    }

    if (issueSearchQuery.trim()) {
      const q = issueSearchQuery.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchPath = (issue.path || "").toLowerCase().includes(q);
      const matchProject = (issue.projectName || "").toLowerCase().includes(q);
      const matchReporter = (issue.raisedBy?.name || "").toLowerCase().includes(q);
      const matchAssignee = (issue.assignedTo?.name || "").toLowerCase().includes(q);
      const matchDesc = (issue.description || "").toLowerCase().includes(q);
      if (!matchTitle && !matchPath && !matchProject && !matchReporter && !matchAssignee && !matchDesc) {
        return false;
      }
    }
    return true;
  });

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (meetingFilter === "Scheduled" && m.status !== "Scheduled") return false;
      if (meetingFilter === "Completed" && m.status !== "Completed") return false;
      if (meetingFilter === "Follow-up Required") {
        const hasFollowUp =
          m.outcome === "Follow-up Required" ||
          (m.nextFollowUpDate && new Date(m.nextFollowUpDate) >= new Date());
        if (!hasFollowUp) return false;
      }

      if (meetingSearchQuery.trim()) {
        const q = meetingSearchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchClient = (m.clientName || "").toLowerCase().includes(q);
        const matchProject = (m.projectName || "").toLowerCase().includes(q);
        const matchPlatform = (m.platform || "").toLowerCase().includes(q);
        const matchNotes = (m.notes || "").toLowerCase().includes(q);
        const matchOutcome = (m.outcome || "").toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchClient &&
          !matchProject &&
          !matchPlatform &&
          !matchNotes &&
          !matchOutcome
        ) {
          return false;
        }
      }
      return true;
    });
  }, [meetings, meetingFilter, meetingSearchQuery]);

  const getModuleBadgeClass = (m?: string | null) => {
    switch (m) {
      case "Admin Side":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "User Side":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Client Portal":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "API / Backend":
        return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
      case "Public / Landing":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-slate-200 dark:border-neutral-700";
    }
  };

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
        alert(err?.message || "Failed to update bug status.");
      }
    });
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm("Are you sure you want to delete this issue? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteIssueAction(issueId);
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
    } catch (err: any) {
      alert(err?.message || "Failed to delete issue");
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-red-50 text-signal-red dark:bg-red-950/40 dark:text-rose-300 border-red-200 dark:border-red-800";
      case "High":
        return "bg-amber-50 text-signal-amber dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Medium":
        return "bg-blue-50 text-accent dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-surface text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-border dark:border-neutral-700";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-red-50 text-signal-red dark:bg-red-950/40 dark:text-rose-300 border-red-200 dark:border-red-800";
      case "In Progress":
        return "bg-blue-50 text-accent dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Resolved":
        return "bg-emerald-50 text-signal-green dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "Closed":
        return "bg-surface text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-border dark:border-neutral-700";
      default:
        return "bg-surface text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-border dark:border-neutral-700";
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
                ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "bg-white dark:bg-[#0a0a0a] text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white border border-border dark:border-[#262626]"
            }`}
          >
            <span>Deliverables & Tasks</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                activeTab === "tasks"
                  ? "bg-white/20 text-white dark:bg-black/15 dark:text-black"
                  : "bg-surface dark:bg-[#141414] text-slate-600 dark:text-slate-300 border border-border dark:border-[#262626]"
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
                ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "bg-white dark:bg-[#0a0a0a] text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white border border-border dark:border-[#262626]"
            }`}
          >
            <span>Bugs & Issues</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                activeTab === "issues"
                  ? "bg-white/20 text-white dark:bg-black/15 dark:text-black"
                  : "bg-surface dark:bg-[#141414] text-slate-600 dark:text-slate-300 border border-border dark:border-[#262626]"
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
                ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                : "bg-white dark:bg-[#0a0a0a] text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white border border-border dark:border-[#262626]"
            }`}
          >
            <span>Meetings & Follow-ups</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                activeTab === "meetings"
                  ? "bg-white/20 text-white dark:bg-black/15 dark:text-black"
                  : "bg-surface dark:bg-[#141414] text-slate-600 dark:text-slate-300 border border-border dark:border-[#262626]"
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
                  onEditTask={(t) => {
                    setTaskToEdit({
                      id: t.id,
                      title: t.title,
                      description: t.description,
                      status: t.status,
                      progress: t.progress,
                      deadline: t.deadline,
                      projectId: t.projectId,
                      projectName: t.projectName,
                      assignedTo: t.assignedTo,
                      assignedToId: t.assignedTo?.id,
                    });
                  }}
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
        <div className={`space-y-4 ${isTableMaximized ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-2xl shadow-2xl border border-border dark:border-[#262626] overflow-hidden flex flex-col" : ""}`}>
          {/* Issue KPI Stats - Compact & Interactive */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setIssueFilter("All")}
              className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                issueFilter === "All"
                  ? "bg-slate-50 dark:bg-neutral-800/80 border-slate-400 dark:border-neutral-500 ring-2 ring-slate-400/20"
                  : "bg-white dark:bg-[#111111] border-border dark:border-[#262626] hover:border-slate-300 dark:hover:border-neutral-700"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                Total Issues
              </span>
              <div className="text-2xl font-bold text-ink dark:text-white mt-0.5 tabular-nums">
                {issues.length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Related to your work</span>
            </button>

            <button
              type="button"
              onClick={() => setIssueFilter("Assigned to Me")}
              className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                issueFilter === "Assigned to Me"
                  ? "bg-red-50/70 dark:bg-red-950/40 border-red-400 dark:border-red-700 ring-2 ring-red-400/20"
                  : "bg-white dark:bg-[#111111] border-red-200/70 dark:border-red-950/50 hover:border-red-300"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-red block">
                Assigned to You
              </span>
              <div className="text-2xl font-bold text-signal-red mt-0.5 tabular-nums">
                {myAssignedIssues.length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Need your resolution</span>
            </button>

            <button
              type="button"
              onClick={() => setIssueFilter("In Progress")}
              className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                issueFilter === "In Progress"
                  ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 ring-2 ring-blue-400/20"
                  : "bg-white dark:bg-[#111111] border-blue-200/70 dark:border-blue-950/50 hover:border-blue-300"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent dark:text-blue-400 block">
                In Progress
              </span>
              <div className="text-2xl font-bold text-accent dark:text-blue-400 mt-0.5 tabular-nums">
                {inProgressIssues.length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Active fixes</span>
            </button>

            <button
              type="button"
              onClick={() => setIssueFilter("Resolved")}
              className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                issueFilter === "Resolved"
                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-400/20"
                  : "bg-white dark:bg-[#111111] border-emerald-200/70 dark:border-emerald-950/50 hover:border-emerald-300"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-green dark:text-emerald-400 block">
                Resolved
              </span>
              <div className="text-2xl font-bold text-signal-green dark:text-emerald-400 mt-0.5 tabular-nums">
                {resolvedIssues.length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Verified & closed</span>
            </button>
          </div>

          {/* Issue Toolbar: Prominent + Report Button, Search, Filters, Fullscreen & View Mode */}
          <div className="bg-white dark:bg-[#111111] p-3 sm:p-3.5 rounded-xl border border-border dark:border-[#262626] shadow-xs flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Left group: + Report Defect button + Real-time Search */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenReportModal()}
                  className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span className="text-sm font-bold leading-none">+</span>
                  <span>Report Defect</span>
                </button>

                {/* Instant Search Bar */}
                <div className="relative flex-1 sm:w-72">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 dark:text-neutral-500 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={issueSearchQuery}
                    onChange={(e) => setIssueSearchQuery(e.target.value)}
                    placeholder="Search defect, path, project, person..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface dark:bg-[#161616] border border-border dark:border-[#262626] rounded-xl text-ink dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  {issueSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setIssueSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-ink dark:hover:text-white text-xs cursor-pointer"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Right group: Maximize & View Mode Switcher */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                {/* Maximize / Full-Screen Table Toggle */}
                <button
                  type="button"
                  onClick={() => setIsTableMaximized((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isTableMaximized
                      ? "bg-accent text-white border-accent shadow-xs"
                      : "bg-surface dark:bg-[#161616] border-border dark:border-[#262626] text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white"
                  }`}
                  title={isTableMaximized ? "Restore table size" : "Expand table full screen"}
                >
                  <span>{isTableMaximized ? "🗗" : "⛶"}</span>
                  <span className="hidden sm:inline">{isTableMaximized ? "Compact" : "Maximize Table"}</span>
                </button>

                {/* View Mode Toggle */}
                <div className="flex p-0.5 bg-surface dark:bg-[#161616] border border-border dark:border-[#262626] rounded-xl text-xs font-medium shrink-0">
                  <button
                    type="button"
                    onClick={() => setIssueViewMode("table")}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      issueViewMode === "table"
                        ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-white"
                    }`}
                  >
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueViewMode("cards")}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      issueViewMode === "cards"
                        ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-white"
                    }`}
                  >
                    <span>Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-row: Status Pills + Module Filter */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/60 dark:border-[#262626]/60">
              <div className="flex items-center gap-1.5 flex-wrap">
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
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer tabular-nums font-medium ${
                      issueFilter === tab.key
                        ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "bg-surface dark:bg-[#161616] text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-neutral-800 border border-border dark:border-[#262626]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Module Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Module:</span>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="px-2.5 py-1 bg-surface dark:bg-[#161616] border border-border dark:border-[#262626] rounded-lg text-xs font-medium text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
                >
                  <option value="All">All Modules</option>
                  <option value="Admin Side">🛡️ Admin Side</option>
                  <option value="User Side">👤 User Side</option>
                  <option value="Client Portal">🏢 Client Portal</option>
                  <option value="API / Backend">⚡ API / Backend</option>
                  <option value="Public / Landing">🌐 Public / Landing</option>
                </select>
              </div>
            </div>
          </div>

          {/* Issues Presentation: Table View (Primary - Large Viewport & Sticky Actions) vs Cards View */}
          {filteredIssues.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] p-12 border border-border dark:border-[#262626] rounded-xl text-center space-y-3 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No issues found</h3>
              <p className="text-xs text-slate-400 dark:text-neutral-500 max-w-xs mx-auto">
                {issueSearchQuery ? "No issues matched your search query." : "No bugs are currently blocking your deliverables under this filter."}
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
            /* TABLE FORMAT (FREE FLOW - GENEROUS HEIGHT & NO HORIZONTAL SCROLL) */
            <div className={`flex flex-col ${isTableMaximized ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-2xl shadow-2xl border border-border dark:border-[#262626] overflow-hidden" : ""}`}>
              <div className={`overflow-y-auto overflow-x-hidden ${isTableMaximized ? "flex-1 min-h-0" : "min-h-[520px] max-h-[76vh]"}`}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-surface/95 dark:bg-[#161616]/95 backdrop-blur border-b border-border dark:border-[#262626]">
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-2 w-7 text-center">#</th>
                      <th className="py-2.5 px-2 w-28">Module</th>
                      <th className="py-2.5 px-2">Defect / Issue Title</th>
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
                    {filteredIssues.map((issue) => {
                      const isOpen = issue.status === "Open";
                      const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                      const isMyIssue = issue.assignedTo?.id === currentUserId;
                      const isExpanded = expandedIssueIds.has(issue.id);

                      return (
                        <React.Fragment key={issue.id}>
                          <tr
                            className={`hover:bg-surface/70 dark:hover:bg-neutral-800/50 transition-colors group ${
                              isMyIssue && isOpen ? "bg-red-50/20 dark:bg-red-950/20" : ""
                            } ${isExpanded ? "bg-surface/50 dark:bg-neutral-900/60" : ""}`}
                          >
                            {/* Expand icon */}
                            <td className="py-2.5 px-2 text-center text-slate-400 dark:text-neutral-500 font-medium tabular-nums">
                              <button
                                type="button"
                                onClick={() => toggleRowExpansion(issue.id)}
                                className="hover:text-ink dark:hover:text-white cursor-pointer p-0.5"
                                title={isExpanded ? "Collapse details" : "Expand details"}
                              >
                                {isExpanded ? "▼" : "▶"}
                              </button>
                            </td>

                            {/* Module */}
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
                                  className="font-semibold text-ink dark:text-white hover:text-accent dark:hover:text-blue-400 transition-colors text-left block text-xs"
                                >
                                  {issue.title}
                                </button>
                                {issue.description && (
                                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-1 max-w-sm">
                                    {issue.description}
                                  </p>
                                )}
                                {(issue.attachmentUrl || issue.attachmentName) && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-900">
                                    <span>Evidence attached</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Route / Path */}
                            <td className="py-2.5 px-2">
                              {issue.path ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-200 dark:border-neutral-700 truncate max-w-[130px] sm:max-w-[160px]"
                                  title={`Route / Path: ${issue.path}`}
                                >
                                  <span>📍</span>
                                  <span className="truncate">{issue.path}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-neutral-600 text-xs">—</span>
                              )}
                            </td>

                            {/* Project */}
                            <td className="py-2.5 px-2">
                              <span className="font-medium text-slate-700 dark:text-slate-300 block truncate max-w-[100px] sm:max-w-[120px]">
                                {issue.projectName}
                              </span>
                            </td>

                            {/* Priority */}
                            <td className="py-2.5 px-1.5">
                              <span
                                className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getPriorityBadgeClass(
                                  issue.priority
                                )}`}
                              >
                                {issue.priority}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-1.5">
                              <span
                                className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getStatusBadgeClass(
                                  issue.status
                                )}`}
                              >
                                {issue.status}
                              </span>
                            </td>

                            {/* Assigned To */}
                            <td className="py-2.5 px-2">
                              <span
                                className={`font-medium block truncate max-w-[100px] ${
                                  isMyIssue ? "text-accent dark:text-blue-400 font-semibold" : "text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {issue.assignedTo ? (
                                  <>
                                    {issue.assignedTo.name} {isMyIssue ? "(You)" : ""}
                                  </>
                                ) : (
                                  <span className="italic text-slate-400 dark:text-neutral-500">Unassigned</span>
                                )}
                              </span>
                            </td>

                            {/* Reporter & Date */}
                            <td className="py-2.5 px-2">
                              <span className="font-medium text-slate-700 dark:text-slate-300 block truncate max-w-[90px] sm:max-w-[100px]">
                                {issue.raisedBy.name}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums">
                                {new Date(issue.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </td>

                            {/* Actions (Natural Right Alignment) */}
                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingIssue(issue)}
                                  className="px-2 py-0.5 bg-blue-50 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-neutral-700 text-accent dark:text-white border border-blue-200 dark:border-neutral-700 font-semibold rounded text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Edit Defect"
                                >
                                  <span>✏️</span>
                                  <span>Edit</span>
                                </button>

                                {isOpen && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                    className="px-2 py-0.5 bg-surface dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-accent dark:text-blue-300 border border-border dark:border-neutral-700 font-medium rounded text-[11px] transition-colors cursor-pointer"
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
                                      setResolvingIssueId(issue.id);
                                      setResolutionText("");
                                    }}
                                    className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-signal-green dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium rounded text-[11px] transition-colors cursor-pointer"
                                  >
                                    Resolve
                                  </button>
                                )}

                                {isResolved && (
                                  <span className="text-[11px] font-medium text-signal-green dark:text-emerald-400">
                                    Resolved
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteIssue(issue.id)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-signal-red dark:hover:text-rose-400 rounded transition-colors cursor-pointer text-xs"
                                  title="Delete issue"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Details Row */}
                          {isExpanded && (
                            <tr className="bg-surface/70 dark:bg-[#161616] border-b border-border dark:border-[#262626]">
                              <td colSpan={10} className="p-4 sm:p-5">
                                <div className="space-y-4 max-w-4xl mx-auto bg-white dark:bg-[#111111] p-4 rounded-xl border border-border dark:border-[#262626]">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Module */}
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                        Target Module / Side
                                      </span>
                                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-surface dark:bg-[#161616] p-2.5 rounded-lg border border-border dark:border-[#262626] flex items-center gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getModuleBadgeClass(
                                            issue.module
                                          )}`}
                                        >
                                          {issue.module || "User Side"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Route / Screen / File Path */}
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                        📍 Route / Screen / File Path
                                      </span>
                                      <div className="text-xs font-mono bg-surface dark:bg-[#161616] p-2.5 rounded-lg border border-border dark:border-[#262626] text-slate-800 dark:text-slate-200 font-semibold select-all truncate">
                                        {issue.path || "Not specified"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Full description */}
                                  {issue.description ? (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                        Description & Steps to Reproduce
                                      </span>
                                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-surface dark:bg-[#161616] p-3 rounded-lg border border-border dark:border-[#262626]">
                                        {issue.description}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 dark:text-neutral-500 italic">
                                      No extra reproduction steps recorded.
                                    </p>
                                  )}

                                  {/* Evidence Attachment */}
                                  {(issue.attachmentUrl || issue.attachmentName) && (
                                    <div className="space-y-2 pt-2 border-t border-border dark:border-[#262626]">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                        Attached Evidence
                                      </span>
                                      <IssueAttachmentViewer
                                        attachmentUrl={issue.attachmentUrl}
                                        attachmentName={issue.attachmentName}
                                        attachmentType={issue.attachmentType}
                                      />
                                    </div>
                                  )}

                                  {/* Inline Resolution form */}
                                  {resolvingIssueId === issue.id ? (
                                    <div className="space-y-3 pt-3 border-t border-border dark:border-[#262626] bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                                      <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-semibold text-signal-green dark:text-emerald-300 flex items-center gap-1.5">
                                          <span>✓</span> Record Resolution Notes
                                        </h5>
                                        <button
                                          type="button"
                                          onClick={() => setResolvingIssueId(null)}
                                          className="text-xs text-slate-400 hover:text-ink cursor-pointer"
                                        >
                                          ✕ Cancel
                                        </button>
                                      </div>
                                      <textarea
                                        rows={2}
                                        value={resolutionText}
                                        onChange={(e) => setResolutionText(e.target.value)}
                                        placeholder="Explain how this bug was fixed, PR link, or confirmation of fix..."
                                        className="w-full text-xs p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#111111] text-ink dark:text-white focus:ring-2 focus:ring-signal-green/20 focus:outline-none"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setResolvingIssueId(null)}
                                          className="px-3 py-1.5 text-xs text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isPending}
                                          onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                                          className="px-3.5 py-1.5 bg-signal-green hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                                        >
                                          {isPending ? "Saving..." : "Confirm Resolved"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    issue.resolution && (
                                      <div className="space-y-1 pt-2 border-t border-border dark:border-[#262626]">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-green dark:text-emerald-400 block">
                                          Resolution Notes
                                        </span>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                                          {issue.resolution}
                                        </p>
                                      </div>
                                    )
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

              {/* Table Footer Stats Bar */}
              <div className="px-4 py-2.5 bg-surface dark:bg-[#161616] border-t border-border dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-neutral-400 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink dark:text-white tabular-nums">
                    Showing {filteredIssues.length} of {issues.length} issues
                  </span>
                  {issueSearchQuery && (
                    <span className="text-accent dark:text-blue-400 font-medium">
                      (filtered by &quot;{issueSearchQuery}&quot;)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-signal-red font-medium tabular-nums">{openIssues.length} Open</span>
                  <span>·</span>
                  <span className="text-accent dark:text-blue-400 font-medium tabular-nums">{inProgressIssues.length} In Progress</span>
                  <span>·</span>
                  <span className="text-signal-green dark:text-emerald-400 font-medium tabular-nums">{resolvedIssues.length} Resolved</span>
                </div>
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
                    className={`bg-white dark:bg-[#111111] p-5 rounded-xl border transition-colors shadow-xs space-y-3.5 ${
                      isMyIssue && isOpen
                        ? "border-red-300 dark:border-red-900 ring-1 ring-red-200 dark:ring-red-950"
                        : "border-border dark:border-[#262626]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
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
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-surface dark:bg-[#161616] border border-border dark:border-[#262626] px-2 py-0.5 rounded">
                          {issue.projectName}
                        </span>
                      </div>

                      <span className="text-slate-400 dark:text-neutral-500 text-[11px] tabular-nums">
                        {new Date(issue.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-ink dark:text-white">
                          {issue.title}
                        </h3>
                        {issue.path && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-200 dark:border-neutral-700"
                            title={`Route / File Path: ${issue.path}`}
                          >
                            <span>📍</span>
                            <span>{issue.path}</span>
                          </span>
                        )}
                      </div>
                      {issue.description && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-surface dark:bg-[#161616] p-3 rounded-lg border border-border dark:border-[#262626]">
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
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs text-signal-green dark:text-emerald-300 space-y-0.5">
                        <span className="font-semibold block">Resolution Note:</span>
                        <p className="whitespace-pre-wrap">{issue.resolution}</p>
                      </div>
                    )}

                    {/* Inline Resolution Box */}
                    {resolvingIssueId === issue.id && (
                      <div className="bg-surface dark:bg-[#161616] p-3.5 rounded-lg border border-border dark:border-[#262626] space-y-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          How did you resolve this bug?
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="e.g. Corrected CSS overflow issue and updated mobile breakpoint."
                          className="w-full p-2.5 text-xs bg-white dark:bg-[#111111] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingIssueId(null);
                              setResolutionText("");
                            }}
                            className="px-3 py-1 text-xs text-slate-600 dark:text-neutral-400 bg-white dark:bg-[#202020] hover:bg-surface dark:hover:bg-neutral-700 border border-border dark:border-neutral-700 rounded-lg"
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
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border dark:border-[#262626] text-xs">
                      <div className="flex items-center gap-3 text-slate-500 dark:text-neutral-400">
                        <span>
                          Reported by: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{issue.raisedBy.name}</strong>
                        </span>
                        <span>
                          Assigned to:{" "}
                          <strong className="text-slate-700 dark:text-slate-200 font-semibold">
                            {issue.assignedTo ? issue.assignedTo.name : "Unassigned"}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingIssue(issue)}
                          className="px-3 py-1 bg-surface dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg border border-border dark:border-neutral-700 transition-colors cursor-pointer"
                        >
                          ✏️ Edit
                        </button>

                        {isOpen && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-accent dark:text-blue-300 font-semibold rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
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
                            className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-signal-green dark:text-emerald-300 font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                          >
                            Mark as Resolved
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteIssue(issue.id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-signal-red dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete issue"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111111] p-4 rounded-xl border border-border dark:border-[#262626]">
            <div>
              <h2 className="text-base font-semibold text-ink dark:text-white">Client Calls & Follow-up Logs</h2>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
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
                className="px-3.5 py-1.5 bg-surface dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 border border-border dark:border-neutral-700 font-medium text-xs rounded-lg transition-colors"
              >
                Full Hub ↗
              </Link>
            </div>
          </div>

          {/* KPI Strip - Interactive */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setMeetingFilter("All")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                meetingFilter === "All"
                  ? "bg-slate-50 dark:bg-neutral-800/80 border-slate-400 dark:border-neutral-500 ring-2 ring-slate-400/20"
                  : "bg-white dark:bg-[#111111] border-border dark:border-[#262626] hover:border-slate-300 dark:hover:border-neutral-700"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                Total Calls
              </span>
              <div className="text-2xl font-bold text-ink dark:text-white mt-1 tabular-nums">{meetings.length}</div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Assigned / scheduled</span>
            </button>

            <button
              type="button"
              onClick={() => setMeetingFilter("Scheduled")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                meetingFilter === "Scheduled"
                  ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 ring-2 ring-blue-400/20"
                  : "bg-white dark:bg-[#111111] border-border dark:border-[#262626] hover:border-blue-300"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent dark:text-blue-400 block">
                Scheduled
              </span>
              <div className="text-2xl font-bold text-accent dark:text-blue-400 mt-1 tabular-nums">
                {meetings.filter((m) => m.status === "Scheduled").length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Upcoming calls</span>
            </button>

            <button
              type="button"
              onClick={() => setMeetingFilter("Completed")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                meetingFilter === "Completed"
                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-400/20"
                  : "bg-white dark:bg-[#111111] border-border dark:border-[#262626] hover:border-emerald-300"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-green dark:text-emerald-400 block">
                Completed
              </span>
              <div className="text-2xl font-bold text-signal-green dark:text-emerald-400 mt-1 tabular-nums">
                {meetings.filter((m) => m.status === "Completed").length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Past discussions</span>
            </button>

            <button
              type="button"
              onClick={() => setMeetingFilter("Follow-up Required")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                meetingFilter === "Follow-up Required"
                  ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-400/20"
                  : "bg-white dark:bg-[#111111] border-border dark:border-[#262626] hover:border-amber-300"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-amber dark:text-amber-400 block">
                Action Items
              </span>
              <div className="text-2xl font-bold text-signal-amber dark:text-amber-400 mt-1 tabular-nums">
                {meetings.filter((m) => m.nextFollowUpDate || m.outcome === "Follow-up Required").length}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Pending follow-ups</span>
            </button>
          </div>

          {/* Filter Bar + Search + Maximize */}
          <div className="bg-white dark:bg-[#111111] p-3 sm:p-3.5 rounded-xl border border-border dark:border-[#262626] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-xs text-gray-500 dark:text-neutral-400 font-medium">Filter:</span>
              {["All", "Scheduled", "Completed", "Follow-up Required"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setMeetingFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    meetingFilter === filter
                      ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                      : "bg-surface dark:bg-[#161616] text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white border border-border dark:border-[#262626]"
                  }`}
                >
                  {filter}
                </button>
              ))}

              {/* Real-time search for meetings */}
              <div className="relative w-full sm:w-56 ml-0 sm:ml-2">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 dark:text-neutral-500 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={meetingSearchQuery}
                  onChange={(e) => setMeetingSearchQuery(e.target.value)}
                  placeholder="Search calls, clients..."
                  className="w-full pl-8 pr-6 py-1 text-xs bg-surface dark:bg-[#161616] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                {meetingSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMeetingSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-ink dark:hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Maximize toggle */}
            <button
              type="button"
              onClick={() => setIsMeetingTableMaximized((prev) => !prev)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 self-end sm:self-auto ${
                isMeetingTableMaximized
                  ? "bg-accent text-white border-accent shadow-xs"
                  : "bg-surface dark:bg-[#161616] border-border dark:border-[#262626] text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white"
              }`}
              title={isMeetingTableMaximized ? "Restore table size" : "Expand table full screen"}
            >
              <span>{isMeetingTableMaximized ? "🗗" : "⛶"}</span>
              <span>{isMeetingTableMaximized ? "Compact" : "Maximize"}</span>
            </button>
          </div>

          {/* Meetings Table with Large Viewport & Sticky Actions */}
          <div className={`bg-white dark:bg-[#111111] border border-border dark:border-[#262626] rounded-xl shadow-xs overflow-hidden flex flex-col ${isMeetingTableMaximized ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-2xl shadow-2xl" : ""}`}>
            {filteredMeetings.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {meetingSearchQuery ? "No calls match your search query." : "No meetings found for the selected filter."}
                </p>
              </div>
            ) : (
              <div className={`overflow-x-auto overflow-y-auto ${isMeetingTableMaximized ? "flex-1 min-h-0" : "min-h-[520px] max-h-[76vh]"}`}>
                <table className="w-full text-left border-collapse text-xs relative">
                  <thead className="sticky top-0 z-20 bg-surface dark:bg-[#161616] border-b border-border dark:border-[#262626] shadow-xs">
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4 min-w-[150px]">Timing & Status</th>
                      <th className="py-3 px-4 min-w-[200px]">Client & Title</th>
                      <th className="py-3 px-4 min-w-[140px]">Project</th>
                      <th className="py-3 px-4 min-w-[140px]">Platform & Link</th>
                      <th className="py-3 px-4 min-w-[200px]">Outcome & Notes</th>
                      <th className="sticky right-0 z-30 bg-surface dark:bg-[#161616] py-3 px-4 min-w-[150px] text-right font-semibold shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.6)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-[#262626] text-xs">
                    {filteredMeetings.map((m) => {
                      const isExpanded = expandedMeetingIds.has(m.id);
                      return (
                        <React.Fragment key={m.id}>
                          <tr className="hover:bg-surface/50 dark:hover:bg-neutral-800/40 transition-colors">
                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                    m.status === "Completed"
                                      ? "bg-signal-green/10 text-signal-green border border-signal-green/20"
                                      : m.status === "Cancelled"
                                      ? "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
                                      : "bg-blue-50 text-accent border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                  }`}
                                >
                                  {m.status}
                                </span>
                                <span className="font-semibold text-ink dark:text-white tabular-nums">
                                  {new Date(m.scheduledAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-neutral-400 tabular-nums">
                                  {new Date(m.scheduledAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  ({m.durationMinutes}m)
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-semibold text-ink dark:text-white">{m.title}</div>
                              <div className="text-gray-600 dark:text-neutral-300 text-[11px] mt-0.5">
                                <span className="font-medium">{m.clientName}</span>
                                {m.clientPhone && (
                                  <span className="text-gray-400 ml-1.5">· {m.clientPhone}</span>
                                )}
                              </div>
                              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-surface dark:bg-[#161616] text-gray-600 dark:text-neutral-300 border border-border dark:border-[#262626] font-medium">
                                {m.type}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              {m.projectId ? (
                                <Link
                                  href={`/projects/${m.projectId}`}
                                  className="font-medium text-accent dark:text-blue-400 hover:underline"
                                >
                                  {m.projectName}
                                </Link>
                              ) : (
                                <span className="text-gray-400 dark:text-neutral-500 italic">General</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-gray-700 dark:text-neutral-200">{m.platform}</span>
                                {m.meetingLink ? (
                                  <a
                                    href={m.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-semibold text-accent dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                  >
                                    Join Call ↗
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-gray-400 dark:text-neutral-500">No link</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="flex flex-col gap-1">
                                {m.outcome && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-accent dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    {m.outcome}
                                  </span>
                                )}
                                {m.notes ? (
                                  <p className="text-[11px] text-gray-500 dark:text-neutral-400 line-clamp-2">{m.notes}</p>
                                ) : (
                                  <span className="text-[11px] text-gray-400 dark:text-neutral-500 italic">No notes logged</span>
                                )}
                              </div>
                            </td>

                            {/* Sticky Actions */}
                            <td className="sticky right-0 z-10 bg-white dark:bg-[#111111] group-hover:bg-[#f8fafc] dark:group-hover:bg-[#181818] py-3.5 px-4 align-top text-right whitespace-nowrap shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.6)]">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveFollowUpMeeting(m)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-accent dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer"
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
                                  className="p-1 text-gray-400 hover:text-ink dark:hover:text-white text-xs rounded hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer"
                                  title={isExpanded ? "Collapse notes" : "Expand notes"}
                                >
                                  {isExpanded ? "▲" : "▼"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-surface/40 dark:bg-neutral-900/60 border-b border-border dark:border-[#262626]">
                              <td colSpan={6} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                  <div className="p-3 bg-white dark:bg-[#111111] border border-border dark:border-[#262626] rounded-xl">
                                    <h5 className="font-semibold text-gray-700 dark:text-neutral-200 mb-1">Agenda</h5>
                                    <p className="text-gray-600 dark:text-neutral-400 whitespace-pre-line">
                                      {m.agenda || "No agenda set."}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-white dark:bg-[#111111] border border-border dark:border-[#262626] rounded-xl">
                                    <h5 className="font-semibold text-gray-700 dark:text-neutral-200 mb-1">Discussion Notes</h5>
                                    <p className="text-gray-600 dark:text-neutral-400 whitespace-pre-line">
                                      {m.notes || "No notes logged."}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-white dark:bg-[#111111] border border-border dark:border-[#262626] rounded-xl">
                                    <h5 className="font-semibold text-gray-700 dark:text-neutral-200 mb-1">Action Items</h5>
                                    <p className="text-gray-600 dark:text-neutral-400 whitespace-pre-line">
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

            {/* Meetings Footer Summary */}
            <div className="px-4 py-2.5 bg-surface dark:bg-[#161616] border-t border-border dark:border-[#262626] flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
              <span className="font-semibold text-ink dark:text-white tabular-nums">
                Showing {filteredMeetings.length} of {meetings.length} calls
              </span>
              <span className="text-[11px]">
                {meetings.filter((m) => m.status === "Scheduled").length} Upcoming · {meetings.filter((m) => m.status === "Completed").length} Completed
              </span>
            </div>
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
          if (created) {
            const formatted: MemberIssueData = {
              id: created.id,
              projectId: created.projectId,
              projectName: created.project?.name || projects.find((p) => p.id === created.projectId)?.name || "General Project",
              title: created.title,
              description: created.description,
              path: created.path || null,
              module: created.module || "User Side",
              priority: created.priority,
              status: created.status,
              resolution: created.resolution,
              attachmentUrl: created.attachmentUrl,
              attachmentName: created.attachmentName,
              attachmentType: created.attachmentType,
              createdAt: new Date(created.createdAt).toISOString(),
              updatedAt: new Date(created.updatedAt).toISOString(),
              resolvedAt: created.resolvedAt ? new Date(created.resolvedAt).toISOString() : null,
              raisedBy: {
                id: created.raisedBy?.id || currentUserId,
                name: created.raisedBy?.name || memberName,
                email: created.raisedBy?.email || "",
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

      {/* Edit Assigned Task Modal for Members */}
      <EditTaskModal
        isOpen={!!taskToEdit}
        onClose={() => setTaskToEdit(null)}
        task={taskToEdit}
        teamMembers={teamMembers}
        isSuperAdmin={false}
        onTaskUpdated={(updated) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === updated.id
                ? {
                    ...t,
                    status: updated.status,
                    progress: updated.progress,
                    description: updated.description,
                  }
                : t
            )
          );
        }}
      />

      {/* Edit Issue Modal */}
      <EditIssueModal
        isOpen={!!editingIssue}
        onClose={() => setEditingIssue(null)}
        issue={editingIssue}
        projects={projects}
        teamMembers={assignableMembers}
        isSuperAdmin={false}
        currentUserId={currentUserId}
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
