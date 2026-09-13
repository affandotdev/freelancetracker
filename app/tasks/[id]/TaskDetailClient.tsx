"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import TaskStatusBadge from "@/components/TaskStatusBadge";
import BackButton from "@/components/BackButton";
import {
  updateTaskAction,
  addTaskUpdateAction,
  deleteTaskUpdateAction,
  raiseObjectionAction,
  resolveObjectionAction,
  deleteTaskAction,
} from "@/lib/actions";
import { getProjectDuration, formatDeadlineDate } from "@/lib/dateUtils";

export interface TaskDetailData {
  id: string;
  projectId: string;
  projectName: string;
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
  teamMembers?: { id: string; name: string; email: string }[];
}

export default function TaskDetailClient({
  task,
  isSuperAdmin,
  currentUserId,
  teamMembers = [],
}: TaskDetailClientProps) {
  const [status, setStatus] = useState(task.status);
  const [progress, setProgress] = useState(task.progress);
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.id || "");
  const [updateText, setUpdateText] = useState("");
  const [isObjectionModalOpen, setIsObjectionModalOpen] = useState(false);
  const [objectionMessage, setObjectionMessage] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [isPending, startTransition] = useTransition();

  const [updates, setUpdates] = useState(task.updates);
  const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null);

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

  const duration = getProjectDuration(task.deadline, status);

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

        {isSuperAdmin && (
          <button
            type="button"
            onClick={handleDeleteTask}
            disabled={isPending}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
          >
            Delete Task
          </button>
        )}
      </div>

      {/* Task Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              📁 {task.projectName}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {task.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <TaskStatusBadge status={status} />
            {openObjections.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                ⚠️ Blocked ({openObjections.length})
              </span>
            )}
          </div>
        </div>

        {task.description && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {task.description}
          </div>
        )}

        {/* Status & Progress Controller */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Task Status
            </label>
            <select
              value={status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Work Completion
              </label>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
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
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2"
            />
          </div>
        </div>

        {/* Meta Info Bar: Assignee & Deadline */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Assigned To:</span>
            {isSuperAdmin && teamMembers.length > 0 ? (
              <select
                value={assignedToId}
                disabled={isPending}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 cursor-pointer"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            ) : task.assignedTo ? (
              <span className="font-bold text-slate-800">
                {task.assignedTo.name} ({task.assignedTo.email})
              </span>
            ) : (
              <span className="text-slate-400 italic">Unassigned</span>
            )}
          </div>

          {task.deadline && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Target Deadline:</span>
              <span className="font-bold text-slate-800">
                {formatDeadlineDate(task.deadline)}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  duration.statusType === "overdue"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                ⏱️ {duration.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Objections & Blockers Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>⚠️ Roadblocks & Objections</span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
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
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            + Raise an Objection
          </button>
        </div>

        {task.objections.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No objections raised on this task. Everything is clear!
          </p>
        ) : (
          <div className="space-y-3">
            {task.objections.map((obj) => {
              const isOpen = obj.status === "Open";

              return (
                <div
                  key={obj.id}
                  className={`p-4 rounded-2xl border space-y-2.5 transition-all ${
                    isOpen
                      ? "bg-rose-50/50 border-rose-200"
                      : "bg-slate-50 border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isOpen
                            ? "bg-rose-200 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOpen ? "Open Blocker" : "Resolved"}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {obj.raisedBy.name}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(obj.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {obj.message}
                  </p>

                  {obj.resolution && (
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                      <span className="font-bold block">Resolution Note:</span>
                      <p className="whitespace-pre-wrap">{obj.resolution}</p>
                    </div>
                  )}

                  {/* Super Admin can resolve directly here */}
                  {isOpen && isSuperAdmin && (
                    <div className="pt-1">
                      {resolvingId === obj.id ? (
                        <form
                          onSubmit={(e) => handleResolveObjection(e, obj.id)}
                          className="space-y-2 bg-white p-3 rounded-xl border border-slate-200"
                        >
                          <textarea
                            rows={2}
                            required
                            value={resolutionText}
                            onChange={(e) => setResolutionText(e.target.value)}
                            placeholder="Add resolution explanation..."
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingId(null);
                                setResolutionText("");
                              }}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isPending}
                              className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer"
                            >
                              Confirm Resolution
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setResolvingId(obj.id)}
                          className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          ✓ Resolve Objection
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

      {/* Task Work Updates Log */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>📝 Work Updates Log</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
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
            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || !updateText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              {isPending ? "Posting..." : "Post Update"}
            </button>
          </div>
        </form>

        {/* Updates Feed */}
        <div className="space-y-3 pt-2">
          {updates.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No updates posted yet. Be the first to share your progress!
            </p>
          ) : (
            updates.map((up) => {
              const canDelete = isSuperAdmin || task.assignedTo?.id === currentUserId;

              return (
                <div
                  key={up.id}
                  className="group p-4 bg-slate-50/70 hover:bg-slate-50/95 rounded-2xl border border-slate-100 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Task Update
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span>
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
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingUpdateId === up.id ? (
                            <span className="text-rose-500 font-bold">Deleting...</span>
                          ) : (
                            <>
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
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
          <div className="bg-white max-w-md w-full p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>⚠️ Raise an Objection</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsObjectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Describe what is blocking your progress. The Super Admin will be notified in their Objections inbox.
            </p>

            <form onSubmit={handleRaiseObjection} className="space-y-4">
              <textarea
                rows={4}
                required
                value={objectionMessage}
                onChange={(e) => setObjectionMessage(e.target.value)}
                placeholder="e.g. Waiting on client's Stripe test keys, cannot proceed with payment gateway testing."
                className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsObjectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !objectionMessage.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Blocker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
