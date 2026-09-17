"use client";

import React, { useState, useEffect, useTransition } from "react";
import { updateIssueAction, deleteIssueAction } from "@/lib/actions";

export interface EditIssueData {
  id: string;
  projectId: string;
  projectName?: string;
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
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  raisedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface EditIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: EditIssueData | null;
  projects?: { id: string; name: string; client?: string | null }[];
  teamMembers?: { id: string; name: string; email: string; role?: string }[];
  isSuperAdmin?: boolean;
  currentUserId?: string;
  onSuccess?: (updatedIssue: any) => void;
  onDelete?: (issueId: string) => void;
}

export default function EditIssueModal({
  isOpen,
  onClose,
  issue,
  projects = [],
  teamMembers = [],
  isSuperAdmin = false,
  currentUserId = "",
  onSuccess,
  onDelete,
}: EditIssueModalProps) {
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [module, setModule] = useState<string>("User Side");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [status, setStatus] = useState<"Open" | "In Progress" | "Resolved" | "Closed">("Open");
  const [assignedToId, setAssignedToId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [resolution, setResolution] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (issue && isOpen) {
      setTitle(issue.title || "");
      setPath(issue.path || "");
      setModule(issue.module || "User Side");
      setDescription(issue.description || "");
      setPriority((issue.priority as any) || "Medium");
      setStatus((issue.status as any) || "Open");
      setAssignedToId(issue.assignedTo?.id || "");
      setProjectId(issue.projectId || "");
      setResolution(issue.resolution || "");
      setShowDiscardConfirm(false);
    }
  }, [issue, isOpen]);

  // Combine and deduplicate assignable members, ensuring the currently assigned worker is always in the list
  const assignableMembers = React.useMemo(() => {
    const list = teamMembers.filter(
      (m) =>
        m.role !== "SUPER_ADMIN" &&
        !m.name?.toLowerCase().includes("super admin") &&
        !m.email?.toLowerCase().includes("admin@")
    );

    if (issue?.assignedTo && !list.some((m) => m.id === issue.assignedTo?.id)) {
      list.unshift({
        id: issue.assignedTo.id,
        name: issue.assignedTo.name,
        email: issue.assignedTo.email,
      });
    }

    return list;
  }, [teamMembers, issue?.assignedTo]);

  // Available project list
  const availableProjects = React.useMemo(() => {
    const list = [...projects];
    if (issue?.projectId && !list.some((p) => p.id === issue.projectId)) {
      list.unshift({
        id: issue.projectId,
        name: issue.projectName || "Current Project",
      });
    }
    return list;
  }, [projects, issue?.projectId, issue?.projectName]);

  const isDirty = Boolean(
    issue &&
      (title !== (issue.title || "") ||
        path !== (issue.path || "") ||
        module !== (issue.module || "User Side") ||
        description !== (issue.description || "") ||
        priority !== issue.priority ||
        status !== issue.status ||
        assignedToId !== (issue.assignedTo?.id || "") ||
        (projectId && projectId !== issue.projectId) ||
        resolution !== (issue.resolution || ""))
  );

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleAttemptClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDirty, showDiscardConfirm]);

  if (!isOpen || !issue) return null;

  const canDelete =
    isSuperAdmin ||
    issue.raisedBy?.id === currentUserId ||
    issue.assignedTo?.id === currentUserId ||
    Boolean(onDelete);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter an issue title.");
      return;
    }

    if (!assignedToId) {
      alert("Please select an assigned worker for this bug.");
      return;
    }

    const formData = new FormData();
    formData.append("issueId", issue.id);
    formData.append("title", title.trim());
    formData.append("path", path.trim());
    formData.append("module", module || "User Side");
    formData.append("description", description.trim());
    formData.append("priority", priority);
    formData.append("status", status);
    formData.append("assignedToId", assignedToId);
    if (resolution.trim()) {
      formData.append("resolution", resolution.trim());
    }
    if (projectId) {
      formData.append("projectId", projectId);
    }

    startTransition(async () => {
      try {
        const updated = await updateIssueAction(formData);
        if (onSuccess) {
          onSuccess(updated);
        }
        onClose();
      } catch (err: any) {
        alert(err?.message || "Failed to update issue.");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to permanently delete this issue / defect?")) return;

    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteIssueAction(issue.id);
        if (onDelete) {
          onDelete(issue.id);
        }
        onClose();
      } catch (err: any) {
        alert(err?.message || "Failed to delete issue.");
      } finally {
        setIsDeleting(false);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleAttemptClose}
    >
      <div
        className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-border dark:border-[#262626] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-ink dark:text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-[#262626]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">✏️ Edit Issue / Defect</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                priority === "Critical"
                  ? "bg-red-50 text-signal-red border-red-200"
                  : priority === "High"
                  ? "bg-amber-50 text-signal-amber border-amber-200"
                  : "bg-surface text-slate-600 border-border"
              }`}
            >
              {priority}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-neutral-900 transition-colors text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Issue Title <span className="text-signal-red">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Mobile header alignment glitch on Safari"
              className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white text-xs font-medium"
            />
          </div>

          {/* Route / Screen / File Path (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <span>📍</span>
                <span>Route / Screen / File Path</span>
              </label>
              <span className="text-[10px] text-slate-400">Optional</span>
            </div>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g. /dashboard/settings, components/TaskCard.tsx, or /api/auth"
              className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white font-medium text-xs placeholder:text-slate-400"
            />
          </div>

          {/* Module / Side */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Module / Side <span className="text-signal-red">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Target Area</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { id: "Admin Side", label: "🛡️ Admin Side" },
                { id: "User Side", label: "👤 User Side" },
                { id: "Client Portal", label: "🏢 Client Portal" },
                { id: "API / Backend", label: "⚡ API / Backend" },
                { id: "Public / Landing", label: "🌐 Public / Landing" },
              ].map((m) => {
                const isSelected = module === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModule(m.id)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer text-xs font-medium border ${
                      isSelected
                        ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-xs font-semibold"
                        : "bg-surface dark:bg-[#111111] border-border dark:border-[#262626] text-slate-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project & Assigned Worker (2-column layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Project Dropdown */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Project <span className="text-signal-red">*</span>
              </label>
              {availableProjects.length > 0 ? (
                <select
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
                >
                  <option value="">-- Select Project --</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.client ? `(${p.client})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-surface dark:bg-[#111111] border border-border dark:border-[#262626] rounded-lg text-slate-700 dark:text-slate-300 font-medium truncate">
                  {issue.projectName || "Current Project"}
                </div>
              )}
            </div>

            {/* Assigned Member (Required Dropdown) */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Assigned Worker <span className="text-signal-red">*</span>
              </label>
              <select
                required
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
              >
                <option value="">-- Select Worker (Required) --</option>
                {assignableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.email ? `(${m.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["Low", "Medium", "High", "Critical"] as const).map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer text-xs font-medium border ${
                      isSelected
                        ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-xs font-semibold"
                        : "bg-surface dark:bg-[#111111] border-border dark:border-[#262626] text-slate-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["Open", "In Progress", "Resolved", "Closed"] as const).map((s) => {
                const isSelected = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer text-xs font-medium border ${
                      isSelected
                        ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-xs font-semibold"
                        : "bg-surface dark:bg-[#111111] border-border dark:border-[#262626] text-slate-600 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description & Steps */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Description & Steps to Reproduce
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe defect in detail, expected behavior, device/browser..."
              className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white text-xs leading-relaxed resize-none font-medium"
            />
          </div>

          {/* Resolution Notes (if in progress or resolved) */}
          {(status === "Resolved" || status === "Closed" || status === "In Progress") && (
            <div className="space-y-1.5 pt-2 border-t border-border dark:border-[#262626]">
              <label className="font-semibold text-emerald-700 dark:text-emerald-400 block">
                Resolution Notes / Fix Details
              </label>
              <textarea
                rows={2}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Explain what changes were made to fix this defect..."
                className="w-full px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-ink dark:text-white text-xs leading-relaxed resize-none font-medium"
              />
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border dark:border-[#262626]">
            {canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending || isDeleting}
                className="px-3 py-1.5 text-signal-red hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <span>🗑️ Delete Issue</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAttemptClose}
                disabled={isPending || isDeleting}
                className="px-3.5 py-1.5 rounded-lg border border-border dark:border-[#262626] text-slate-600 dark:text-slate-300 hover:bg-surface dark:hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || isDeleting}
                className="px-4 py-1.5 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>

        {/* Discard Confirmation Dialog */}
        {showDiscardConfirm && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-[#141414] rounded-xl border border-border dark:border-[#262626] shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 text-ink dark:text-white">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg shrink-0 border border-amber-200 dark:border-amber-800/60">
                  ⚠️
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-ink dark:text-white">
                    Discard Unsaved Changes?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                    You have unsaved edits on this defect report. If you close now, your changes will be discarded.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-border dark:border-[#262626] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-surface dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="px-3.5 py-1.5 bg-signal-red hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
