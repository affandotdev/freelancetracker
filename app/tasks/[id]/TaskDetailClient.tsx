"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import TaskStatusBadge from "@/components/TaskStatusBadge";
import BackButton from "@/components/BackButton";
import ReportBugModal from "@/components/ReportBugModal";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import LogMeetingFollowUpModal from "@/components/LogMeetingFollowUpModal";
import LogDirectMeetingModal from "@/components/LogDirectMeetingModal";
import EditTaskModal, { EditableTaskData } from "@/components/EditTaskModal";
import {
  updateTaskAction,
  addTaskUpdateAction,
  deleteTaskUpdateAction,
  raiseObjectionAction,
  resolveObjectionAction,
  deleteTaskAction,
  updateMeetingStatusAction,
} from "@/lib/actions";
import { getProjectDuration, formatDeadlineDate } from "@/lib/dateUtils";

export interface TaskMeetingData {
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
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface TaskDetailData {
  id: string;
  projectId: string;
  projectName: string;
  projectClient?: string | null;
  projectDeadline?: string | null;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  deadline?: string | null;
  createdAt: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  updates: {
    id: string;
    text: string;
    createdAt: string;
  }[];
  objections: {
    id: string;
    message: string;
    status: string;
    resolution?: string | null;
    createdAt: string;
    resolvedAt?: string | null;
    raisedBy: {
      id: string;
      name: string;
      email: string;
    };
  }[];
}

interface TaskDetailClientProps {
  task: TaskDetailData;
  isSuperAdmin: boolean;
  currentUserId: string;
  teamMembers?: { id: string; name: string; email: string; role?: string }[];
  initialMeetings?: TaskMeetingData[];
}

export default function TaskDetailClient({
  task,
  isSuperAdmin,
  currentUserId,
  teamMembers = [],
  initialMeetings = [],
}: TaskDetailClientProps) {
  const [taskTitle, setTaskTitle] = useState(task.title);
  const [taskDescription, setTaskDescription] = useState(task.description || "");
  const [status, setStatus] = useState(task.status);
  const [progress, setProgress] = useState(task.progress);
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.id || "");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [isObjectionModalOpen, setIsObjectionModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [objectionMessage, setObjectionMessage] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [isPending, startTransition] = useTransition();

  // Meetings state
  const [meetings, setMeetings] = useState<TaskMeetingData[]>(initialMeetings);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDirectMeetingModalOpen, setIsDirectMeetingModalOpen] = useState(false);
  const [activeFollowUpMeeting, setActiveFollowUpMeeting] = useState<TaskMeetingData | null>(null);
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Set<string>>(new Set());

  const toggleMeetingExpand = (mId: string) => {
    setExpandedMeetingIds((prev) => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      return next;
    });
  };

  const [updates, setUpdates] = useState(task.updates);
  const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null);

  // Deadline state
  const [taskDeadline, setTaskDeadline] = useState(
    task.deadline ? task.deadline.split("T")[0] : ""
  );
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);

  React.useEffect(() => {
    setUpdates(task.updates);
  }, [task.updates]);

  const handleAssigneeChange = (newAssigneeId: string) => {
    setAssignedToId(newAssigneeId);
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { assignedToId: newAssigneeId || null });
      } catch (err: any) {
        alert(err?.message || "Failed to reassign task.");
      }
    });
  };

  const handleDeadlineChange = (newDate: string) => {
    setTaskDeadline(newDate);
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { deadline: newDate || null });
        setIsEditingDeadline(false);
      } catch (err: any) {
        alert(err?.message || "Failed to update deadline.");
      }
    });
  };

  const duration = getProjectDuration(taskDeadline, status);

  // Handle instant status / progress updates
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const newProgress = newStatus === "Done" ? 100 : progress;
    if (newStatus === "Done") setProgress(100);

    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { status: newStatus, progress: newProgress });
      } catch (err: any) {
        alert(err?.message || "Failed to update task status.");
      }
    });
  };

  const handleProgressChange = (newProgress: number) => {
    setProgress(newProgress);
    const newStatus = newProgress === 100 ? "Done" : status === "Done" ? "In Progress" : status;
    if (newProgress === 100) setStatus("Done");

    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { progress: newProgress, status: newStatus });
      } catch (err: any) {
        alert(err?.message || "Failed to update task progress.");
      }
    });
  };

  const handleAddUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateText.trim()) return;

    const textToSubmit = updateText;
    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("text", textToSubmit);

    startTransition(async () => {
      try {
        const newUpdate = await addTaskUpdateAction(formData);
        if (newUpdate) {
          setUpdates((prev) => [
            {
              id: newUpdate.id,
              text: newUpdate.text,
              createdAt:
                typeof newUpdate.createdAt === "string"
                  ? newUpdate.createdAt
                  : new Date(newUpdate.createdAt).toISOString(),
            },
            ...prev.filter((u) => u.id !== newUpdate.id),
          ]);
        }
        setUpdateText("");
      } catch (err: any) {
        alert(err?.message || "Failed to post task update.");
      }
    });
  };

  const handleDeleteUpdate = (updateId: string) => {
    if (!confirm("Are you sure you want to delete this work update?")) return;

    setDeletingUpdateId(updateId);
    startTransition(async () => {
      try {
        await deleteTaskUpdateAction(updateId);
        setUpdates((prev) => prev.filter((u) => u.id !== updateId));
      } catch (err: any) {
        alert(err?.message || "Failed to delete update.");
      } finally {
        setDeletingUpdateId(null);
      }
    });
  };

  const handleRaiseObjection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectionMessage.trim()) return;

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("message", objectionMessage);

    startTransition(async () => {
      try {
        await raiseObjectionAction(formData);
        setIsObjectionModalOpen(false);
        setObjectionMessage("");
        setStatus("Blocked");
      } catch (err: any) {
        alert(err?.message || "Failed to raise objection.");
      }
    });
  };

  const handleResolveObjection = (e: React.FormEvent, objectionId: string) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("objectionId", objectionId);
    formData.append("resolution", resolutionText);

    startTransition(async () => {
      try {
        await resolveObjectionAction(formData);
        setResolvingId(null);
        setResolutionText("");
        if (status === "Blocked") {
          setStatus("In Progress");
        }
      } catch (err: any) {
        alert(err?.message || "Failed to resolve objection.");
      }
    });
  };

  const handleDeleteTask = () => {
    if (!confirm("Are you sure you want to permanently delete this task?")) return;

    startTransition(async () => {
      try {
        await deleteTaskAction(task.id);
      } catch (err: any) {
        alert(err?.message || "Failed to delete task.");
      }
    });
  };

  const openObjections = task.objections.filter((o) => o.status === "Open");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <BackButton
          fallbackHref={isSuperAdmin ? `/projects/${task.projectId}` : "/"}
          label={isSuperAdmin ? `Project: ${task.projectName}` : "Back to My Tasks"}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBugModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-surface text-slate-700 border border-border rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Report Defect on Task
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-accent font-semibold border border-blue-200 rounded-lg text-xs transition-colors cursor-pointer"
          >
            <span>✏️ Edit Task</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleDeleteTask}
              disabled={isPending}
              className="text-xs font-medium text-signal-red hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
            >
              Delete Task
            </button>
          )}
        </div>
      </div>

      {/* Task Header Card */}
      <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              {task.projectName}
            </span>
            <h1 className="text-xl font-bold text-ink tracking-tight">
              {taskTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <TaskStatusBadge status={status} />
            {openObjections.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-50 text-signal-red text-xs font-semibold border border-red-200 tabular-nums">
                Blocked ({openObjections.length})
              </span>
            )}
          </div>
        </div>

        {taskDescription && (
          <div className="bg-surface p-4 rounded-lg border border-border text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {taskDescription}
          </div>
        )}

        {/* Status & Progress Controller */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Task Status
            </label>
            <select
              value={status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink cursor-pointer"
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Done">Done</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Work Completion
              </label>
              <span className="text-xs font-semibold text-accent tabular-nums bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {progress}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              disabled={isPending}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-accent mt-2"
            />
          </div>
        </div>

        {/* Meta Info Bar: Assignee & Deadline */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Assigned To:</span>
            {isSuperAdmin && teamMembers.length > 0 ? (
              <select
                value={assignedToId}
                disabled={isPending}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink cursor-pointer"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            ) : task.assignedTo ? (
              <span className="font-semibold text-ink">
                {task.assignedTo.name} ({task.assignedTo.email})
              </span>
            ) : (
              <span className="text-slate-400 italic">Unassigned</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium">Target Deadline:</span>
            {isSuperAdmin ? (
              isEditingDeadline ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="date"
                    value={taskDeadline}
                    disabled={isPending}
                    onChange={(e) => handleDeadlineChange(e.target.value)}
                    className="px-2 py-0.5 text-xs bg-white border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
                  />
                  {task.projectDeadline && (
                    <button
                      type="button"
                      onClick={() => handleDeadlineChange(task.projectDeadline!.split("T")[0])}
                      className="text-[10px] font-semibold text-accent hover:underline cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                      title="Sync with parent project contract deadline"
                    >
                      Use Project Due ({formatDeadlineDate(task.projectDeadline)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingDeadline(false)}
                    className="text-[11px] text-slate-400 hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink tabular-nums">
                    {taskDeadline ? formatDeadlineDate(taskDeadline) : "No deadline"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingDeadline(true)}
                    className="text-[10px] text-accent hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              )
            ) : (
              <span className="font-semibold text-ink tabular-nums">
                {taskDeadline ? formatDeadlineDate(taskDeadline) : "No deadline"}
              </span>
            )}

            {taskDeadline && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                  duration.statusType === "overdue"
                    ? "bg-red-50 text-signal-red border-red-200"
                    : "bg-surface text-slate-700 border-border"
                }`}
              >
                {duration.label}
              </span>
            )}

            {task.projectDeadline && (
              <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
                Project delivery: <span className="font-medium text-slate-700">{formatDeadlineDate(task.projectDeadline)}</span>
              </span>
            )}

            {task.projectDeadline && taskDeadline && taskDeadline > task.projectDeadline.split("T")[0] && (
              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ⚠️ Exceeds project delivery ({formatDeadlineDate(task.projectDeadline)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Objections & Blockers Section */}
      <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span>Roadblocks & Objections</span>
              <span className="text-xs font-semibold text-slate-600 bg-surface px-2 py-0.5 rounded border border-border tabular-nums">
                {task.objections.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Raise a question or blocker that prevents task completion.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsObjectionModalOpen(true)}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-signal-red border border-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            + Raise Objection
          </button>
        </div>

        {task.objections.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No objections raised on this task. Work is proceeding smoothly.
          </p>
        ) : (
          <div className="space-y-3">
            {task.objections.map((obj) => {
              const isOpen = obj.status === "Open";

              return (
                <div
                  key={obj.id}
                  className={`p-4 rounded-lg border space-y-2.5 transition-colors ${
                    isOpen
                      ? "bg-red-50/40 border-red-200"
                      : "bg-surface border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                          isOpen
                            ? "bg-red-100 text-signal-red border border-red-200"
                            : "bg-emerald-100 text-signal-green border border-emerald-200"
                        }`}
                      >
                        {isOpen ? "Open Blocker" : "Resolved"}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {obj.raisedBy.name}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {new Date(obj.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">
                    {obj.message}
                  </p>

                  {obj.resolution && (
                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                      <span className="font-semibold block">Resolution Note:</span>
                      <p className="whitespace-pre-wrap">{obj.resolution}</p>
                    </div>
                  )}

                  {/* Super Admin can resolve directly here */}
                  {isOpen && isSuperAdmin && (
                    <div className="pt-1">
                      {resolvingId === obj.id ? (
                        <form
                          onSubmit={(e) => handleResolveObjection(e, obj.id)}
                          className="space-y-2 bg-white p-3 rounded-lg border border-border"
                        >
                          <textarea
                            rows={2}
                            required
                            value={resolutionText}
                            onChange={(e) => setResolutionText(e.target.value)}
                            placeholder="Add resolution explanation..."
                            className="w-full p-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingId(null);
                                setResolutionText("");
                              }}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-surface border border-border rounded-md"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isPending}
                              className="px-3 py-1 text-xs font-semibold text-white bg-signal-green hover:bg-green-700 rounded-md shadow-xs cursor-pointer"
                            >
                              Confirm Resolution
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setResolvingId(obj.id)}
                          className="text-xs font-semibold text-signal-green hover:underline cursor-pointer"
                        >
                          Resolve Objection
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client Meetings & Updates Section */}
      <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span>Client Meetings & Updates</span>
              <span className="text-xs font-semibold text-slate-600 bg-surface px-2 py-0.5 rounded border border-border tabular-nums">
                {meetings.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Client discussions, call logs, feedback outcomes, and scheduled syncs for this deliverable.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDirectMeetingModalOpen(true)}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>+ Log Meeting / Call</span>
            </button>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-surface text-slate-700 border border-border rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Schedule Call
            </button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <div className="py-6 text-center bg-surface/50 border border-dashed border-border rounded-lg space-y-2">
            <p className="text-xs text-slate-500">
              No meetings or client discussions recorded yet for this task.
            </p>
            <button
              type="button"
              onClick={() => setIsDirectMeetingModalOpen(true)}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline cursor-pointer"
            >
              Record an ad-hoc client phone call or discussion update
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => {
              const isScheduled = m.status === "Scheduled";
              const isCompleted = m.status === "Completed";

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-lg border transition-all space-y-3 ${
                    isScheduled
                      ? "bg-purple-50/30 border-purple-200/80"
                      : "bg-surface border-border"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                            isCompleted
                              ? "bg-emerald-100 text-signal-green border border-emerald-200"
                              : isScheduled
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {m.status}
                        </span>

                        <span className="text-xs font-semibold text-ink">
                          {m.title}
                        </span>

                        <span className="text-[11px] text-slate-500 font-medium">
                          with <span className="font-semibold text-slate-700">{m.clientName}</span> ({m.platform})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>
                          {new Date(m.scheduledAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>•</span>
                        <span>{m.durationMinutes} mins</span>
                        {m.assignedTo && (
                          <>
                            <span>•</span>
                            <span>Assigned: {m.assignedTo.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.meetingLink && isScheduled && (
                        <a
                          href={m.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-accent hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <span>Join Call</span>
                          <span>↗</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveFollowUpMeeting(m)}
                        className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors cursor-pointer"
                      >
                        {m.notes ? "Edit Notes / Outcome" : "Log Notes & Outcome"}
                      </button>
                    </div>
                  </div>

                  {/* Outcome Tag */}
                  {m.outcome && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Outcome:</span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-border rounded text-slate-700">
                        {m.outcome}
                      </span>
                      {m.nextFollowUpDate && (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                          Next Follow-up: {new Date(m.nextFollowUpDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Notes / Discussion Feedback */}
                  {m.notes && (
                    <div className="bg-white p-3 rounded-md border border-border text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      <span className="font-semibold text-slate-900 block mb-0.5">Discussion Summary & Feedback:</span>
                      {m.notes}
                    </div>
                  )}

                  {/* Action Items */}
                  {m.actionItems && (
                    <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                      <span className="font-semibold text-slate-900 block mb-0.5">Action Items:</span>
                      {m.actionItems}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Work Updates Log */}
      <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-5">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <span>Work Updates Log</span>
            <span className="text-xs font-semibold text-slate-600 bg-surface px-2 py-0.5 rounded border border-border tabular-nums">
              {updates.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Post timestamped progress updates and milestone notes.
          </p>
        </div>

        {/* Post Update Form */}
        <form onSubmit={handleAddUpdate} className="space-y-3">
          <textarea
            rows={2}
            required
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="What did you just finish or work on? (e.g. Completed header redesign, starting on checkout flow next...)"
            className="w-full p-3 text-xs sm:text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium leading-relaxed resize-none text-ink placeholder:text-slate-400"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || !updateText.trim()}
              className="px-4 py-2 bg-accent hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? "Posting..." : "Post Update"}
            </button>
          </div>
        </form>

        {/* Updates Feed */}
        <div className="space-y-2.5 pt-1">
          {updates.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No updates posted yet.
            </p>
          ) : (
            updates.map((up) => {
              const canDelete = isSuperAdmin || task.assignedTo?.id === currentUserId;

              return (
                <div
                  key={up.id}
                  className="group p-3.5 bg-surface hover:bg-slate-100/70 rounded-lg border border-border transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      Task Update
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="tabular-nums">
                        {new Date(up.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUpdate(up.id)}
                          disabled={deletingUpdateId === up.id}
                          title="Delete this update"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-signal-red hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingUpdateId === up.id ? (
                            <span className="text-signal-red font-semibold">Deleting...</span>
                          ) : (
                            <span>Delete</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">
                    {up.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Raise Objection Modal */}
      {isObjectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-lg shadow-xl border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-ink">
                Raise an Objection / Roadblock
              </h3>
              <button
                type="button"
                onClick={() => setIsObjectionModalOpen(false)}
                className="text-slate-400 hover:text-ink text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Describe what is blocking your progress. The agency owner will be notified in their Objections inbox.
            </p>

            <form onSubmit={handleRaiseObjection} className="space-y-4">
              <textarea
                rows={4}
                required
                value={objectionMessage}
                onChange={(e) => setObjectionMessage(e.target.value)}
                placeholder="e.g. Waiting on client's Stripe test keys, cannot proceed with payment gateway testing."
                className="w-full p-3 text-xs sm:text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent leading-relaxed text-ink placeholder:text-slate-400 resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsObjectionModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-border hover:bg-surface rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !objectionMessage.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-signal-red hover:bg-red-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Blocker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Bug Modal */}
      <ReportBugModal
        isOpen={isBugModalOpen}
        onClose={() => setIsBugModalOpen(false)}
        projects={[{ id: task.projectId, name: task.projectName }]}
        teamMembers={teamMembers}
        defaultProjectId={task.projectId}
        defaultAssignedToId={task.assignedTo?.id || ""}
        defaultTitle={`Defect on task: ${task.title}`}
        onSuccess={() => {
          alert("Bug report submitted successfully");
        }}
      />

      {/* Direct / Unscheduled Meeting Modal */}
      <LogDirectMeetingModal
        isOpen={isDirectMeetingModalOpen}
        onClose={() => setIsDirectMeetingModalOpen(false)}
        projects={[{ id: task.projectId, name: task.projectName, client: task.projectClient }]}
        defaultProjectId={task.projectId}
        defaultClientName={task.projectClient || ""}
        defaultTitle={`Meeting update: ${task.title}`}
        defaultAssignedToId={task.assignedTo?.id || currentUserId}
        onMeetingLogged={(newMeeting) => {
          setMeetings((prev) => [
            {
              id: newMeeting.id,
              projectId: newMeeting.projectId,
              projectName: task.projectName,
              projectClient: task.projectClient || null,
              clientName: newMeeting.clientName,
              clientEmail: newMeeting.clientEmail || null,
              clientPhone: newMeeting.clientPhone || null,
              title: newMeeting.title,
              type: newMeeting.type,
              platform: newMeeting.platform,
              meetingLink: newMeeting.meetingLink || null,
              scheduledAt: typeof newMeeting.scheduledAt === "string" ? newMeeting.scheduledAt : new Date(newMeeting.scheduledAt).toISOString(),
              durationMinutes: newMeeting.durationMinutes,
              status: newMeeting.status,
              agenda: newMeeting.agenda || null,
              notes: newMeeting.notes || null,
              actionItems: newMeeting.actionItems || null,
              outcome: newMeeting.outcome || null,
              nextFollowUpDate: newMeeting.nextFollowUpDate ? (typeof newMeeting.nextFollowUpDate === "string" ? newMeeting.nextFollowUpDate : new Date(newMeeting.nextFollowUpDate).toISOString()) : null,
              completedAt: newMeeting.completedAt ? (typeof newMeeting.completedAt === "string" ? newMeeting.completedAt : new Date(newMeeting.completedAt).toISOString()) : null,
              createdAt: new Date().toISOString(),
              assignedTo: newMeeting.assignedTo || (task.assignedTo ? { id: task.assignedTo.id, name: task.assignedTo.name, email: task.assignedTo.email } : null),
            },
            ...prev,
          ]);
        }}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        projects={[{ id: task.projectId, name: task.projectName, client: task.projectClient }]}
        teamMembers={teamMembers}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUserId}
        preselectedProjectId={task.projectId}
        defaultClientName={task.projectClient || ""}
        defaultTitle={`Discussion on ${task.title}`}
        defaultAssignedToId={task.assignedTo?.id || currentUserId}
        onMeetingCreated={(created) => {
          setMeetings((prev) => [
            {
              id: created.id,
              projectId: created.projectId,
              projectName: task.projectName,
              projectClient: task.projectClient || null,
              clientName: created.clientName,
              clientEmail: created.clientEmail || null,
              clientPhone: created.clientPhone || null,
              title: created.title,
              type: created.type,
              platform: created.platform,
              meetingLink: created.meetingLink || null,
              scheduledAt: typeof created.scheduledAt === "string" ? created.scheduledAt : new Date(created.scheduledAt).toISOString(),
              durationMinutes: created.durationMinutes,
              status: created.status,
              agenda: created.agenda || null,
              notes: created.notes || null,
              actionItems: created.actionItems || null,
              outcome: created.outcome || null,
              nextFollowUpDate: created.nextFollowUpDate ? (typeof created.nextFollowUpDate === "string" ? created.nextFollowUpDate : new Date(created.nextFollowUpDate).toISOString()) : null,
              completedAt: created.completedAt ? (typeof created.completedAt === "string" ? created.completedAt : new Date(created.completedAt).toISOString()) : null,
              createdAt: new Date().toISOString(),
              assignedTo: created.assignedTo || (task.assignedTo ? { id: task.assignedTo.id, name: task.assignedTo.name, email: task.assignedTo.email } : null),
            },
            ...prev,
          ]);
        }}
      />

      {/* Log Meeting Follow Up Modal */}
      {activeFollowUpMeeting && (
        <LogMeetingFollowUpModal
          isOpen={!!activeFollowUpMeeting}
          onClose={() => setActiveFollowUpMeeting(null)}
          meeting={activeFollowUpMeeting}
          onSaved={(updated) => {
            setMeetings((prev) =>
              prev.map((m) =>
                m.id === updated.id
                  ? {
                      ...m,
                      notes: updated.notes,
                      outcome: updated.outcome,
                      actionItems: updated.actionItems,
                      nextFollowUpDate: updated.nextFollowUpDate ? (typeof updated.nextFollowUpDate === "string" ? updated.nextFollowUpDate : new Date(updated.nextFollowUpDate).toISOString()) : null,
                      status: updated.status,
                      completedAt: updated.completedAt ? (typeof updated.completedAt === "string" ? updated.completedAt : new Date(updated.completedAt).toISOString()) : m.completedAt,
                    }
                  : m
              )
            );
            setActiveFollowUpMeeting(null);
          }}
        />
      )}

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        task={{
          id: task.id,
          title: taskTitle,
          description: taskDescription,
          status,
          progress,
          deadline: taskDeadline,
          projectId: task.projectId,
          projectName: task.projectName,
          projectDeadline: task.projectDeadline,
          assignedTo: task.assignedTo,
          assignedToId,
        }}
        teamMembers={teamMembers}
        isSuperAdmin={isSuperAdmin}
        onTaskUpdated={(updated) => {
          setTaskTitle(updated.title);
          setTaskDescription(updated.description || "");
          setStatus(updated.status);
          setProgress(updated.progress);
          if (updated.deadline) {
            setTaskDeadline(updated.deadline.split("T")[0]);
          } else if (isSuperAdmin && updated.deadline === null) {
            setTaskDeadline("");
          }
          if (updated.assignedToId !== undefined) {
            setAssignedToId(updated.assignedToId || "");
          }
        }}
      />
    </div>
  );
}
