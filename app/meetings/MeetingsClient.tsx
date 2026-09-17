"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import LogMeetingFollowUpModal from "@/components/LogMeetingFollowUpModal";
import LogDirectMeetingModal from "@/components/LogDirectMeetingModal";
import {
  updateMeetingStatusAction,
  reassignMeetingAction,
  deleteMeetingAction,
} from "@/lib/actions";

export interface FormattedMeeting {
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
  createdAt: string;
  updatedAt: string;
  assignedTo: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface MeetingsClientProps {
  meetings: FormattedMeeting[];
  projects: { id: string; name: string; client?: string | null }[];
  teamMembers: { id: string; name: string; email: string; role: string }[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function MeetingsClient({
  meetings: initialMeetings,
  projects,
  teamMembers,
  currentUser,
}: MeetingsClientProps) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<FormattedMeeting[]>(initialMeetings);

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDirectMeetingModalOpen, setIsDirectMeetingModalOpen] = useState(false);
  const [activeFollowUpMeeting, setActiveFollowUpMeeting] = useState<FormattedMeeting | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState(currentUser.role === "SUPER_ADMIN" ? "all" : "me");
  const [timeFilter, setTimeFilter] = useState("all"); // all, upcoming, today, past
  const [typeFilter, setTypeFilter] = useState("all");

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  // Filtered list
  const filteredMeetings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return meetings.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchClient = m.clientName.toLowerCase().includes(q);
        const matchProject = m.projectName?.toLowerCase().includes(q) || false;
        const matchNotes = m.notes?.toLowerCase().includes(q) || false;
        const matchAgenda = m.agenda?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchClient && !matchProject && !matchNotes && !matchAgenda) {
          return false;
        }
      }

      // Status
      if (statusFilter !== "all" && m.status !== statusFilter) {
        return false;
      }

      // Assignment
      if (assignedFilter === "me") {
        if (m.assignedTo?.id !== currentUser.id) return false;
      } else if (assignedFilter === "unassigned") {
        if (m.assignedTo) return false;
      } else if (assignedFilter !== "all") {
        if (m.assignedTo?.id !== assignedFilter) return false;
      }

      // Type
      if (typeFilter !== "all" && m.type !== typeFilter) {
        return false;
      }

      // Time filter
      const mDate = new Date(m.scheduledAt);
      if (timeFilter === "today") {
        if (mDate < startOfToday || mDate > endOfToday) return false;
      } else if (timeFilter === "upcoming") {
        if (mDate < now || m.status === "Completed") return false;
      } else if (timeFilter === "past") {
        if (mDate >= now && m.status !== "Completed") return false;
      }

      return true;
    });
  }, [meetings, searchQuery, statusFilter, assignedFilter, timeFilter, typeFilter, currentUser.id]);

  // Statistics
  const stats = useMemo(() => {
    const total = meetings.length;
    const scheduled = meetings.filter((m) => m.status === "Scheduled").length;
    const completed = meetings.filter((m) => m.status === "Completed").length;
    const pendingFollowUps = meetings.filter(
      (m) => m.outcome === "Follow-up Required" || (m.nextFollowUpDate && new Date(m.nextFollowUpDate) >= new Date())
    ).length;

    return { total, scheduled, completed, pendingFollowUps };
  }, [meetings]);

  // Handlers
  const handleMeetingCreated = (newMeeting: any) => {
    router.refresh();
  };

  const handleFollowUpSaved = (updated: any) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
    );
    router.refresh();
  };

  const handleStatusChange = async (meetingId: string, newStatus: string) => {
    try {
      const formData = new FormData();
      formData.set("meetingId", meetingId);
      formData.set("status", newStatus);
      await updateMeetingStatusAction(formData);

      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                status: newStatus,
                completedAt: newStatus === "Completed" ? new Date().toISOString() : null,
              }
            : m
        )
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const handleReassign = async (meetingId: string, targetUserId: string) => {
    try {
      const formData = new FormData();
      formData.set("meetingId", meetingId);
      formData.set("assignedToId", targetUserId);
      await reassignMeetingAction(formData);

      const targetMember = teamMembers.find((m) => m.id === targetUserId);
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                assignedTo: targetMember ? { ...targetMember, role: targetMember.role } : null,
              }
            : m
        )
      );
    } catch (err: any) {
      alert(err?.message || "Failed to reassign meeting.");
    }
  };

  const handleDelete = async (meetingId: string) => {
    if (!confirm("Are you sure you want to delete this meeting entry?")) return;
    try {
      await deleteMeetingAction(meetingId);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err: any) {
      alert(err?.message || "Failed to delete meeting.");
    }
  };

  const getRelativeTimeBadge = (scheduledAt: string, status: string) => {
    if (status === "Completed") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-signal-green/10 text-signal-green border border-signal-green/20">
          Completed
        </span>
      );
    }
    if (status === "Cancelled") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
          Cancelled
        </span>
      );
    }
    if (status === "Rescheduled") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-signal-amber/10 text-signal-amber border border-signal-amber/20">
          Rescheduled
        </span>
      );
    }

    const meetingTime = new Date(scheduledAt).getTime();
    const diffMs = meetingTime - Date.now();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0 && Math.abs(diffHours) <= 2) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-signal-red/10 text-signal-red border border-signal-red/20 animate-pulse">
          Live / Due Now
        </span>
      );
    }
    if (diffMs < 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
          Awaiting Notes
        </span>
      );
    }
    if (diffHours < 24) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-accent border border-blue-200">
          In {Math.max(1, diffHours)}h
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-accent border border-blue-200">
          Tomorrow
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-gray-700 border border-border">
        In {diffDays} days
      </span>
    );
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return null;
    if (outcome.includes("Approved") || outcome.includes("Closed")) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-signal-green/10 text-signal-green border border-signal-green/20">
          {outcome}
        </span>
      );
    }
    if (outcome.includes("Revision") || outcome.includes("Follow-up")) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-signal-amber/10 text-signal-amber border border-signal-amber/20">
          {outcome}
        </span>
      );
    }
    if (outcome.includes("No Show")) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-signal-red/10 text-signal-red border border-signal-red/20">
          {outcome}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
        {outcome}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Client Meetings & Follow-ups
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Schedule discovery calls, deliverable reviews, client syncs, and log follow-up action items.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDirectMeetingModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
          >
            <span>+</span>
            <span>Log Direct Call / Notes</span>
          </button>
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
          >
            <span>+</span>
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-border rounded-lg">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Total Meetings
          </p>
          <p className="text-2xl font-bold text-ink mt-1 tabular-nums">
            {stats.total}
          </p>
        </div>

        <div className="p-4 bg-white border border-border rounded-lg">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Scheduled / Active
          </p>
          <p className="text-2xl font-bold text-accent mt-1 tabular-nums">
            {stats.scheduled}
          </p>
        </div>

        <div className="p-4 bg-white border border-border rounded-lg">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Completed
          </p>
          <p className="text-2xl font-bold text-signal-green mt-1 tabular-nums">
            {stats.completed}
          </p>
        </div>

        <div className="p-4 bg-white border border-border rounded-lg">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Follow-ups Pending
          </p>
          <p className="text-2xl font-bold text-signal-amber mt-1 tabular-nums">
            {stats.pendingFollowUps}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-border rounded-lg p-3 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings, client name, notes, agenda..."
            className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-ink placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Rescheduled">Rescheduled</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Time Filter */}
        <div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past / Finished</option>
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Types</option>
            <option value="Client Meeting">Client Meeting</option>
            <option value="Discovery Call">Discovery Call</option>
            <option value="Deliverable Walkthrough">Deliverable Walkthrough</option>
            <option value="Progress Review">Progress Review</option>
            <option value="Follow-up Check-in">Follow-up Check-in</option>
            <option value="Payment Follow-up">Payment Follow-up</option>
          </select>
        </div>

        {/* Assignee Filter */}
        <div>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {isSuperAdmin ? (
              <>
                <option value="all">All Assignments</option>
                <option value="me">Assigned to Me</option>
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="me">My Assigned Meetings</option>
                <option value="all">All Meetings</option>
              </>
            )}
          </select>
        </div>

        {/* Clear Filters */}
        {(searchQuery || statusFilter !== "all" || timeFilter !== "all" || typeFilter !== "all" || (isSuperAdmin ? assignedFilter !== "all" : assignedFilter !== "me")) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setTimeFilter("all");
              setTypeFilter("all");
              setAssignedFilter(isSuperAdmin ? "all" : "me");
            }}
            className="text-xs text-gray-500 hover:text-ink font-medium underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Main Meetings Table */}
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        {filteredMeetings.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-surface flex items-center justify-center text-gray-400 mb-2 font-semibold">
              0
            </div>
            <h3 className="text-sm font-semibold text-ink">No meetings found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== "all" || timeFilter !== "all"
                ? "Try adjusting your search criteria or active filters."
                : "No meetings scheduled yet. Click '+ Schedule Meeting' to set up your first client sync."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-10 bg-surface dark:bg-[#161616] border-b border-border dark:border-[#262626] shadow-xs">
                <tr className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timing & Status</th>
                  <th className="py-3 px-4">Meeting & Client</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Platform & Link</th>
                  <th className="py-3 px-4">Assigned Member</th>
                  <th className="py-3 px-4">Outcome & Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredMeetings.map((m) => {
                  const isExpanded = expandedMeetingId === m.id;
                  const isAssignedToCurrent = m.assignedTo?.id === currentUser.id;
                  const canManage = isSuperAdmin || isAssignedToCurrent || m.createdBy?.id === currentUser.id;

                  return (
                    <React.Fragment key={m.id}>
                      <tr
                        className={`hover:bg-surface/50 transition-colors ${
                          isExpanded ? "bg-surface/30" : ""
                        }`}
                      >
                        {/* Timing & Status */}
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {getRelativeTimeBadge(m.scheduledAt, m.status)}
                            <span className="font-semibold text-ink tabular-nums">
                              {new Date(m.scheduledAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
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

                        {/* Meeting & Client */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-ink">{m.title}</div>
                          <div className="text-gray-600 text-[11px] mt-0.5">
                            <span className="font-medium">{m.clientName}</span>
                            {m.clientEmail && (
                              <span className="text-gray-400 block sm:inline sm:ml-1.5">
                                · {m.clientEmail}
                              </span>
                            )}
                            {m.clientPhone && (
                              <span className="text-gray-400 block sm:inline sm:ml-1.5">
                                · {m.clientPhone}
                              </span>
                            )}
                          </div>
                          <div className="mt-1">
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-surface text-gray-600 border border-border font-medium">
                              {m.type}
                            </span>
                          </div>
                        </td>

                        {/* Project */}
                        <td className="py-3 px-4 align-top">
                          {m.projectId ? (
                            <Link
                              href={`/projects/${m.projectId}`}
                              className="font-medium text-accent hover:underline inline-block max-w-[150px] truncate"
                              title={m.projectName || "View project"}
                            >
                              {m.projectName}
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic">General</span>
                          )}
                        </td>

                        {/* Platform & Link */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-700">
                              {m.platform}
                            </span>
                            {m.meetingLink ? (
                              <a
                                href={m.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                              >
                                Join Call ↗
                              </a>
                            ) : (
                              <span className="text-[11px] text-gray-400">No link added</span>
                            )}
                          </div>
                        </td>

                        {/* Assigned Member */}
                        <td className="py-3 px-4 align-top">
                          {isSuperAdmin ? (
                            <select
                              value={m.assignedTo?.id || "none"}
                              onChange={(e) => handleReassign(m.id, e.target.value)}
                              className="px-2 py-1 bg-surface border border-border rounded text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              <option value="none">Unassigned</option>
                              {teamMembers.map((tm) => (
                                <option key={tm.id} value={tm.id}>
                                  {tm.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-ink">
                              {m.assignedTo?.name || "Unassigned"}
                            </span>
                          )}
                        </td>

                        {/* Outcome & Notes Summary */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col gap-1">
                            {m.outcome ? (
                              getOutcomeBadge(m.outcome)
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {m.status === "Completed" ? "Completed" : "Pending call"}
                              </span>
                            )}

                            {m.nextFollowUpDate && (
                              <span className="text-[10px] text-signal-amber font-medium tabular-nums">
                                Follow-up: {new Date(m.nextFollowUpDate).toLocaleDateString()}
                              </span>
                            )}

                            {m.notes && (
                              <span className="text-[11px] text-gray-500 line-clamp-1">
                                {m.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Log Notes Button */}
                            <button
                              type="button"
                              onClick={() => setActiveFollowUpMeeting(m)}
                              className="px-2 py-1 text-[11px] font-medium text-accent bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              title="Log meeting discussion notes, outcome, and follow-ups"
                            >
                              Follow-up
                            </button>

                            {/* Status Selector */}
                            {canManage && (
                              <select
                                value={m.status}
                                onChange={(e) => handleStatusChange(m.id, e.target.value)}
                                className="px-1.5 py-1 bg-surface border border-border rounded text-[11px] text-ink focus:outline-none"
                              >
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed</option>
                                <option value="Rescheduled">Rescheduled</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            )}

                            {/* Details Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMeetingId(isExpanded ? null : m.id)
                              }
                              className="p-1 text-gray-400 hover:text-ink text-xs rounded hover:bg-gray-100 transition-colors"
                              title={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>

                            {/* Delete (Admin/Creator only) */}
                            {(isSuperAdmin || m.createdBy?.id === currentUser.id) && (
                              <button
                                type="button"
                                onClick={() => handleDelete(m.id)}
                                className="p-1 text-gray-400 hover:text-signal-red text-xs rounded hover:bg-gray-100 transition-colors"
                                title="Delete meeting"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Drawer */}
                      {isExpanded && (
                        <tr className="bg-surface/40 border-b border-border">
                          <td colSpan={7} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              {/* Agenda */}
                              <div className="p-3 bg-white border border-border rounded-md">
                                <h4 className="font-semibold text-gray-700 mb-1">
                                  Agenda & Discussion Topics
                                </h4>
                                <p className="text-gray-600 whitespace-pre-line">
                                  {m.agenda || "No agenda set for this meeting."}
                                </p>
                              </div>

                              {/* Discussion Notes */}
                              <div className="p-3 bg-white border border-border rounded-md">
                                <h4 className="font-semibold text-gray-700 mb-1">
                                  Discussion Notes & Client Feedback
                                </h4>
                                <p className="text-gray-600 whitespace-pre-line">
                                  {m.notes || "No discussion notes logged yet."}
                                </p>
                              </div>

                              {/* Action Items & Outcome */}
                              <div className="p-3 bg-white border border-border rounded-md">
                                <h4 className="font-semibold text-gray-700 mb-1">
                                  Action Items & Outcomes
                                </h4>
                                {m.outcome && (
                                  <div className="mb-2">
                                    <span className="text-gray-500 font-medium mr-1">Outcome:</span>
                                    {getOutcomeBadge(m.outcome)}
                                  </div>
                                )}
                                <p className="text-gray-600 whitespace-pre-line mb-2">
                                  {m.actionItems || "No action items defined."}
                                </p>
                                {m.nextFollowUpDate && (
                                  <div className="pt-2 border-t border-border text-[11px] text-gray-500 tabular-nums">
                                    Target Next Follow-up:{" "}
                                    <span className="font-semibold text-ink">
                                      {new Date(m.nextFollowUpDate).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
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

      {/* Schedule Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        teamMembers={teamMembers}
        projects={projects}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUser.id}
        onMeetingCreated={handleMeetingCreated}
      />

      {/* Log Follow-up Modal */}
      <LogMeetingFollowUpModal
        isOpen={!!activeFollowUpMeeting}
        onClose={() => setActiveFollowUpMeeting(null)}
        meeting={activeFollowUpMeeting}
        onSaved={handleFollowUpSaved}
      />

      {/* Log Direct / Unscheduled Meeting Modal */}
      <LogDirectMeetingModal
        isOpen={isDirectMeetingModalOpen}
        onClose={() => setIsDirectMeetingModalOpen(false)}
        projects={projects}
        onMeetingLogged={(logged) => {
          router.refresh();
        }}
      />
    </div>
  );
}
