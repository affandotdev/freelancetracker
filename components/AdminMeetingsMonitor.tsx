"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  updateMeetingStatusAction,
  reassignMeetingAction,
  deleteMeetingAction,
} from "@/lib/actions";
import ScheduleMeetingModal from "./ScheduleMeetingModal";
import LogMeetingFollowUpModal from "./LogMeetingFollowUpModal";

export interface MeetingMonitoringItem {
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
    role?: string;
  } | null;
  createdBy: {
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

interface AdminMeetingsMonitorProps {
  initialMeetings: MeetingMonitoringItem[];
  teamMembers: TeamMemberOption[];
  projects: ProjectOption[];
}

export default function AdminMeetingsMonitor({
  initialMeetings,
  teamMembers,
  projects,
}: AdminMeetingsMonitorProps) {
  const [meetings, setMeetings] = useState<MeetingMonitoringItem[]>(initialMeetings);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeFollowUpMeeting, setActiveFollowUpMeeting] = useState<MeetingMonitoringItem | null>(null);
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (id: string) => {
    setExpandedMeetingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered Meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchClient = m.clientName.toLowerCase().includes(q);
        const matchProject = m.projectName?.toLowerCase().includes(q) || false;
        const matchNotes = m.notes?.toLowerCase().includes(q) || false;
        const matchAgenda = m.agenda?.toLowerCase().includes(q) || false;
        const matchMember = m.assignedTo?.name.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchClient && !matchProject && !matchNotes && !matchAgenda && !matchMember) {
          return false;
        }
      }

      // Member
      if (selectedMemberId !== "all") {
        if (selectedMemberId === "unassigned") {
          if (m.assignedTo) return false;
        } else if (m.assignedTo?.id !== selectedMemberId) {
          return false;
        }
      }

      // Status
      if (statusFilter !== "all" && m.status !== statusFilter) {
        return false;
      }

      // Outcome
      if (outcomeFilter !== "all") {
        if (outcomeFilter === "with-outcome" && !m.outcome) return false;
        if (outcomeFilter === "no-outcome" && m.outcome) return false;
        if (outcomeFilter !== "with-outcome" && outcomeFilter !== "no-outcome" && m.outcome !== outcomeFilter) {
          return false;
        }
      }

      // Project
      if (selectedProjectId !== "all") {
        if (m.projectId !== selectedProjectId) return false;
      }

      return true;
    });
  }, [meetings, searchQuery, selectedMemberId, statusFilter, outcomeFilter, selectedProjectId]);

  // Statistics
  const stats = useMemo(() => {
    const total = meetings.length;
    const scheduled = meetings.filter((m) => m.status === "Scheduled").length;
    const completed = meetings.filter((m) => m.status === "Completed").length;
    const updatesLogged = meetings.filter((m) => m.notes || m.outcome).length;
    const followUpsPending = meetings.filter(
      (m) => m.outcome === "Follow-up Required" || (m.nextFollowUpDate && new Date(m.nextFollowUpDate) >= new Date())
    ).length;

    return { total, scheduled, completed, updatesLogged, followUpsPending };
  }, [meetings]);

  // Handlers
  const handleStatusChange = (meetingId: string, newStatus: string) => {
    startTransition(async () => {
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
    });
  };

  const handleReassign = (meetingId: string, targetUserId: string) => {
    startTransition(async () => {
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
                  assignedTo: targetMember ? { ...targetMember } : null,
                }
              : m
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to reassign meeting.");
      }
    });
  };

  const handleDelete = async (meetingId: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;
    try {
      await deleteMeetingAction(meetingId);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err: any) {
      alert(err?.message || "Failed to delete meeting.");
    }
  };

  const getRelativeBadge = (scheduledAt: string, status: string) => {
    if (status === "Completed") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-signal-green/10 text-signal-green border border-signal-green/20">
          Completed
        </span>
      );
    }
    if (status === "Cancelled") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500">
          Cancelled
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
          Live Now
        </span>
      );
    }
    if (diffMs < 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
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
        In {diffDays}d
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="bg-white border border-border p-5 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded bg-surface border border-border">
              Admin Monitoring Module
            </span>
            <span className="text-xs text-slate-400 font-medium">• Live Client Sync & Notes</span>
          </div>
          <h2 className="text-xl font-bold text-ink tracking-tight mt-1">
            Client Meetings & Member Follow-up Updates
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Assign team members to client calls, monitor discussion logs and client feedback submitted by freelancers in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="px-4 py-2 bg-accent hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Assign Meeting with Client</span>
          </button>
          <Link
            href="/meetings"
            className="px-3.5 py-2 bg-surface hover:bg-gray-100 text-slate-700 font-medium text-xs rounded-lg border border-border transition-colors flex items-center gap-1"
          >
            <span>Full Hub</span>
            <span>↗</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Total Scheduled
          </span>
          <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{stats.total}</div>
          <span className="text-[11px] text-slate-500">Across all projects</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Active / Upcoming
          </span>
          <div className="text-2xl font-bold text-accent mt-1 tabular-nums">{stats.scheduled}</div>
          <span className="text-[11px] text-slate-500">Pending calls</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Updates Logged
          </span>
          <div className="text-2xl font-bold text-signal-green mt-1 tabular-nums">
            {stats.updatesLogged}
          </div>
          <span className="text-[11px] text-slate-500">With notes/outcomes</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Follow-ups Pending
          </span>
          <div className="text-2xl font-bold text-signal-amber mt-1 tabular-nums">
            {stats.followUpsPending}
          </div>
          <span className="text-[11px] text-slate-500">Action items required</span>
        </div>
      </div>

      {/* Member Filter Strip */}
      <div className="bg-white p-3.5 rounded-lg border border-border shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Filter by Assigned Team Member:</span>
          {selectedMemberId !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedMemberId("all")}
              className="text-[11px] text-accent hover:underline"
            >
              Show All
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedMemberId("all")}
            className={`px-3 py-1 rounded-md font-medium transition-colors shrink-0 cursor-pointer ${
              selectedMemberId === "all"
                ? "bg-ink text-white font-semibold"
                : "bg-surface text-slate-600 hover:text-ink border border-border"
            }`}
          >
            All Members ({meetings.length})
          </button>
          {teamMembers.map((member) => {
            const memberCount = meetings.filter((m) => m.assignedTo?.id === member.id).length;
            const isSelected = selectedMemberId === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-ink text-white font-semibold"
                    : "bg-surface text-slate-600 hover:text-ink border border-border"
                }`}
              >
                <span>{member.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                    isSelected ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-border"
                  }`}
                >
                  {memberCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search client, title, member, notes..."
            className="w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-ink placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Rescheduled">Rescheduled</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Outcomes</option>
            <option value="with-outcome">With Update Logged</option>
            <option value="no-outcome">Awaiting Update</option>
            <option value="Positive - Approved">Positive - Approved</option>
            <option value="Revisions Requested">Revisions Requested</option>
            <option value="Follow-up Required">Follow-up Required</option>
            <option value="Decision Pending">Decision Pending</option>
            <option value="Deal Closed">Deal Closed</option>
          </select>
        </div>

        <div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Monitoring Table */}
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        {filteredMeetings.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-xs text-gray-500 font-medium">No meetings match your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface/75 border-b border-border text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Timing & Status</th>
                  <th className="py-3 px-4">Client & Title</th>
                  <th className="py-3 px-4">Assigned Member</th>
                  <th className="py-3 px-4">Project & Link</th>
                  <th className="py-3 px-4">Member Update & Notes</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredMeetings.map((m) => {
                  const isExpanded = expandedMeetingIds.has(m.id);
                  return (
                    <React.Fragment key={m.id}>
                      <tr className="hover:bg-surface/50 transition-colors">
                        {/* Timing */}
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {getRelativeBadge(m.scheduledAt, m.status)}
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

                        {/* Client & Title */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-ink">{m.title}</div>
                          <div className="text-gray-600 text-[11px] mt-0.5">
                            <span className="font-medium text-ink">{m.clientName}</span>
                            {m.clientPhone && (
                              <span className="text-gray-400 ml-1.5">· {m.clientPhone}</span>
                            )}
                            {m.clientEmail && (
                              <span className="text-gray-400 block text-[10px]">
                                {m.clientEmail}
                              </span>
                            )}
                          </div>
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-surface text-gray-600 border border-border font-medium">
                            {m.type}
                          </span>
                        </td>

                        {/* Assigned Member with Reassign Dropdown */}
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-1">
                            <select
                              value={m.assignedTo?.id || "none"}
                              onChange={(e) => handleReassign(m.id, e.target.value)}
                              className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px] text-ink font-medium focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              <option value="none">-- Unassigned --</option>
                              {teamMembers.map((tm) => (
                                <option key={tm.id} value={tm.id}>
                                  {tm.name}
                                </option>
                              ))}
                            </select>
                            {m.createdBy && (
                              <span className="text-[10px] text-gray-400 block">
                                Created by: {m.createdBy.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Project & Link */}
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-1">
                            {m.projectId ? (
                              <Link
                                href={`/projects/${m.projectId}`}
                                className="font-medium text-accent hover:underline block max-w-[130px] truncate"
                              >
                                {m.projectName}
                              </Link>
                            ) : (
                              <span className="text-gray-400 italic block">General</span>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-600 text-[11px]">{m.platform}</span>
                              {m.meetingLink && (
                                <a
                                  href={m.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-0.5"
                                >
                                  Join ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Member Update & Notes */}
                        <td className="py-3 px-4 align-top max-w-xs">
                          <div className="space-y-1">
                            {m.outcome ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-accent border border-blue-200">
                                  {m.outcome}
                                </span>
                                {m.nextFollowUpDate && (
                                  <span className="text-[10px] text-signal-amber font-medium tabular-nums">
                                    Next: {new Date(m.nextFollowUpDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic block">
                                No update logged yet
                              </span>
                            )}

                            {m.notes && (
                              <p className="text-[11px] text-gray-600 line-clamp-2 bg-surface/60 p-1.5 rounded border border-border">
                                {m.notes}
                              </p>
                            )}

                            {m.actionItems && (
                              <span className="text-[10px] text-slate-500 block font-medium">
                                Action Items: {m.actionItems.split("\n")[0]}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Admin Actions */}
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveFollowUpMeeting(m)}
                              className="px-2 py-1 text-[11px] font-medium text-accent bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                              title="Review / Edit follow-up notes and action items"
                            >
                              Follow-up
                            </button>

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

                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(m.id)}
                              className="p-1 text-gray-400 hover:text-ink text-xs rounded hover:bg-gray-100"
                              title={isExpanded ? "Collapse notes" : "View full notes"}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(m.id)}
                              className="p-1 text-gray-400 hover:text-signal-red text-xs rounded hover:bg-gray-100"
                              title="Delete meeting"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Drawer for Admin Inspection */}
                      {isExpanded && (
                        <tr className="bg-surface/40 border-b border-border">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="p-3 bg-white border border-border rounded-md">
                                <h5 className="font-semibold text-gray-700 mb-1">
                                  Meeting Agenda / Talking Points
                                </h5>
                                <p className="text-gray-600 whitespace-pre-line">
                                  {m.agenda || "No agenda set."}
                                </p>
                              </div>

                              <div className="p-3 bg-white border border-border rounded-md">
                                <h5 className="font-semibold text-gray-700 mb-1">
                                  Member Discussion Log & Client Feedback
                                </h5>
                                <p className="text-gray-600 whitespace-pre-line">
                                  {m.notes || "No notes logged yet by the assigned team member."}
                                </p>
                              </div>

                              <div className="p-3 bg-white border border-border rounded-md">
                                <h5 className="font-semibold text-gray-700 mb-1">
                                  Action Items & Follow-up Timeline
                                </h5>
                                {m.outcome && (
                                  <div className="mb-1.5">
                                    <span className="text-gray-500 mr-1">Outcome:</span>
                                    <span className="font-semibold text-ink">{m.outcome}</span>
                                  </div>
                                )}
                                <p className="text-gray-600 whitespace-pre-line mb-2">
                                  {m.actionItems || "No action items defined."}
                                </p>
                                {m.nextFollowUpDate && (
                                  <div className="pt-2 border-t border-border text-[11px] text-gray-500 tabular-nums">
                                    Target Follow-up Date:{" "}
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

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        teamMembers={teamMembers}
        projects={projects}
        isSuperAdmin={true}
        currentUserId=""
        onMeetingCreated={(created) => {
          const formatted: MeetingMonitoringItem = {
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
            createdAt: new Date(created.createdAt).toISOString(),
            updatedAt: new Date(created.updatedAt).toISOString(),
            assignedTo: created.assignedTo
              ? {
                  id: created.assignedTo.id,
                  name: created.assignedTo.name,
                  email: created.assignedTo.email,
                }
              : null,
            createdBy: created.createdBy
              ? {
                  id: created.createdBy.id,
                  name: created.createdBy.name,
                  email: created.createdBy.email,
                }
              : null,
          };
          setMeetings((prev) => [formatted, ...prev]);
        }}
      />

      {/* Log / Edit Follow-up Modal */}
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
    </div>
  );
}
