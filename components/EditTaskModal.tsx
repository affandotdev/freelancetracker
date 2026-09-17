"use client";

import React, { useState, useEffect, useMemo } from "react";
import { updateTaskAction } from "@/lib/actions";
import { formatDeadlineDate } from "@/lib/dateUtils";
import SearchableSelect from "./SearchableSelect";

export interface EditableTaskData {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  deadline?: string | null;
  projectId?: string;
  projectName?: string;
  projectDeadline?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignedToId?: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: EditableTaskData | null;
  teamMembers?: TeamMember[];
  isSuperAdmin?: boolean;
  onTaskUpdated?: (updatedTask: EditableTaskData) => void;
}

export default function EditTaskModal({
  isOpen,
  onClose,
  task,
  teamMembers = [],
  isSuperAdmin = false,
  onTaskUpdated,
}: EditTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("To Do");
  const [progress, setProgress] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "To Do");
      setProgress(task.progress !== undefined ? task.progress : 0);
      setDeadline(task.deadline ? task.deadline.split("T")[0] : "");
      setAssignedToId(task.assignedTo?.id || task.assignedToId || "");
      setError("");
    }
  }, [task]);

  const memberOptions = useMemo(() => {
    return teamMembers.map((m) => ({
      value: m.id,
      label: m.name,
      subLabel: m.email || undefined,
      badge: m.role && m.role !== "MEMBER" ? m.role : undefined,
    }));
  }, [teamMembers]);

  if (!isOpen || !task) return null;

  const handleStatusSelect = (newStatus: string) => {
    setStatus(newStatus);
    if (newStatus === "Done" && progress < 100) {
      setProgress(100);
    } else if (newStatus === "To Do" && progress === 100) {
      setProgress(0);
    }
  };

  const handleProgressChange = (newProgress: number) => {
    setProgress(newProgress);
    if (newProgress === 100 && status !== "Done") {
      setStatus("Done");
    } else if (newProgress < 100 && status === "Done") {
      setStatus("In Progress");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (isSuperAdmin && !title.trim()) {
      setError("Task title is required.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload: any = {
        status,
        progress,
        description: description.trim() || null,
      };

      if (isSuperAdmin) {
        payload.title = title.trim();
        payload.assignedToId = assignedToId && assignedToId !== "unassigned" ? assignedToId : null;
        payload.deadline = deadline || null;
      }

      await updateTaskAction(task.id, payload);

      const assignedMember = teamMembers.find((m) => m.id === assignedToId);

      const updatedTaskObj: EditableTaskData = {
        ...task,
        title: isSuperAdmin ? title.trim() : task.title,
        description: description.trim() || null,
        status,
        progress,
        deadline: isSuperAdmin ? (deadline ? new Date(deadline).toISOString() : null) : task.deadline,
        assignedTo: isSuperAdmin
          ? assignedMember
            ? { id: assignedMember.id, name: assignedMember.name, email: assignedMember.email }
            : null
          : task.assignedTo,
        assignedToId: isSuperAdmin ? (assignedToId || null) : task.assignedToId,
      };

      if (onTaskUpdated) {
        onTaskUpdated(updatedTaskObj);
      }

      onClose();
    } catch (err: any) {
      console.error("Failed to update task:", err);
      setError(err?.message || "Failed to save task changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl border border-border max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">
                {isSuperAdmin ? "Edit Task Details" : "Update Assigned Task"}
              </h3>
              {task.projectName && (
                <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-border">
                  {task.projectName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin
                ? "Modify title, assignment, milestone deadline, status, and deliverable notes."
                : "Update your progress, status, and deliverable remarks."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-ink font-bold text-sm cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-signal-red font-medium">
              {error}
            </div>
          )}

          {/* Super Admin Title Edit vs Member View */}
          {isSuperAdmin ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Task Title <span className="text-signal-red">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Logo Design & Brand Identity"
                className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium"
              />
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                Task Title
              </span>
              <p className="text-sm font-bold text-ink">{task.title}</p>
              {task.deadline && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Target Deadline: <strong className="text-slate-700">{formatDeadlineDate(task.deadline)}</strong>
                </p>
              )}
            </div>
          )}

          {/* Status and Progress Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Execution Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done (100% Complete)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Work Progress
                </label>
                <span className="text-xs font-bold text-ink tabular-nums">{progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => handleProgressChange(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Super Admin: Assignee & Deadline */}
          {isSuperAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assignee
                </label>
                <SearchableSelect
                  value={assignedToId}
                  onChange={(val) => setAssignedToId(val)}
                  options={memberOptions}
                  placeholder="Unassigned"
                  searchPlaceholder="Search assignee by name or email..."
                  allowClear
                  emptyMessage="No team members found"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Milestone Deadline
                  </label>
                  {task.projectDeadline && (
                    <button
                      type="button"
                      onClick={() => setDeadline(task.projectDeadline!.split("T")[0])}
                      className="text-[10px] text-accent hover:underline cursor-pointer"
                      title="Sync with parent project deadline"
                    >
                      Use Project Due
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Description & Deliverable Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Deliverable Notes & Acceptance Criteria
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Requirements, deliverable specifications, assets link, or notes..."
              className="w-full p-3 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400 leading-relaxed resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-border hover:bg-surface rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-accent hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
