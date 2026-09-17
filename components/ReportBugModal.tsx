"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { createIssueAction } from "@/lib/actions";

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

interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  teamMembers: TeamMemberOption[];
  defaultProjectId?: string;
  defaultAssignedToId?: string;
  defaultTitle?: string;
  onSuccess?: (createdIssue: any) => void;
}

export default function ReportBugModal({
  isOpen,
  onClose,
  projects,
  teamMembers,
  defaultProjectId = "",
  defaultAssignedToId = "",
  defaultTitle = "",
  onSuccess,
}: ReportBugModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || "");
  const [selectedMemberId, setSelectedMemberId] = useState(defaultAssignedToId || "");
  const [title, setTitle] = useState(defaultTitle || "");
  const [path, setPath] = useState("");
  const [module, setModule] = useState<string>("User Side");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Attachment state
  const [attachmentMode, setAttachmentMode] = useState<"file" | "link">("file");
  const [attachedFile, setAttachedFile] = useState<{
    file?: File;
    name: string;
    url: string;
    type: "image" | "video" | "file";
    size: number;
  } | null>(null);
  const [videoLinkUrl, setVideoLinkUrl] = useState("");
  const [videoLinkTitle, setVideoLinkTitle] = useState("");
  const [isConvertingFile, setIsConvertingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = Boolean(
    (title.trim() && title.trim() !== defaultTitle) ||
    description.trim().length > 0 ||
    path.trim().length > 0 ||
    module !== "User Side" ||
    priority !== "Medium" ||
    (selectedProjectId && selectedProjectId !== defaultProjectId) ||
    (selectedMemberId && selectedMemberId !== defaultAssignedToId) ||
    attachedFile !== null ||
    videoLinkUrl.trim().length > 0
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

  const processSelectedFile = (file: File) => {
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File exceeds 15MB limit. Please upload a smaller video/file or paste a Loom/Drive link.");
      return;
    }

    setIsConvertingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      let detectedType: "image" | "video" | "file" = "file";
      if (file.type.startsWith("image/")) detectedType = "image";
      else if (file.type.startsWith("video/")) detectedType = "video";

      setAttachedFile({
        file,
        name: file.name,
        url: dataUrl,
        type: detectedType,
        size: file.size,
      });
      setIsConvertingFile(false);
    };
    reader.onerror = () => {
      alert("Failed to read file.");
      setIsConvertingFile(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type.startsWith("image/")) {
          e.preventDefault();
          processSelectedFile(pastedFile);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen]);

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

  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(defaultProjectId || "");

      if (defaultAssignedToId) {
        const isTargetAdmin = teamMembers.find(
          (m) =>
            m.id === defaultAssignedToId &&
            (m.role === "SUPER_ADMIN" ||
              m.name.toLowerCase().includes("super admin") ||
              m.email.toLowerCase().includes("admin@"))
        );
        setSelectedMemberId(isTargetAdmin ? "" : defaultAssignedToId);
      } else {
        setSelectedMemberId("");
      }

      if (defaultTitle) setTitle(defaultTitle);
      setPath("");
      setModule("User Side");
      setDescription("");
      setAttachedFile(null);
      setVideoLinkUrl("");
      setShowDiscardConfirm(false);
    }
  }, [isOpen, defaultProjectId, defaultAssignedToId, defaultTitle, projects, teamMembers]);

  if (!isOpen) return null;

  const nonAdminMembers = teamMembers.filter(
    (m) =>
      m.role !== "SUPER_ADMIN" &&
      !m.name.toLowerCase().includes("super admin") &&
      !m.email.toLowerCase().includes("admin@")
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) {
      alert("Please select a project and enter an issue title.");
      return;
    }

    if (!selectedMemberId) {
      alert("Please select a team member to assign this bug to.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", selectedProjectId);
    formData.append("title", title.trim());
    if (path.trim()) formData.append("path", path.trim());
    formData.append("module", module || "User Side");
    formData.append("description", description.trim());
    formData.append("priority", priority);
    formData.append("assignedToId", selectedMemberId);

    if (attachedFile) {
      formData.append("attachmentUrl", attachedFile.url);
      formData.append("attachmentName", attachedFile.name);
      formData.append("attachmentType", attachedFile.type);
    } else if (videoLinkUrl.trim()) {
      formData.append("linkUrl", videoLinkUrl.trim());
      formData.append("linkName", videoLinkTitle.trim() || "Video Recording");
    }

    startTransition(async () => {
      try {
        const created = await createIssueAction(formData);
        if (onSuccess) {
          onSuccess(created);
        }
        onClose();
        setTitle("");
        setPath("");
        setModule("User Side");
        setSelectedMemberId("");
        setDescription("");
        setAttachedFile(null);
        setVideoLinkUrl("");
        setVideoLinkTitle("");
      } catch (err: any) {
        alert(err?.message || "Failed to submit bug report.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleAttemptClose}
    >
      <div
        className="bg-white dark:bg-[#0a0a0a] max-w-lg w-full rounded-xl border border-border dark:border-[#262626] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-ink dark:text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border dark:border-[#262626] flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              🐛 Report Issue / Defect
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Select project, enter issue title, and assign a worker.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAttemptClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-neutral-900 transition-colors text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Project Selection (Required) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Project <span className="text-signal-red">*</span>
            </label>
            <select
              required
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
            >
              <option value="">-- Select Project (Required) --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.client ? `(${p.client})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Title (Required) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Issue Title <span className="text-signal-red">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken checkout form validation on mobile"
              className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white font-medium text-xs"
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

          {/* Module / Side (Admin Side vs User Side etc.) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Module / Side <span className="text-signal-red">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Where defect occurs</span>
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

          {/* Assign Worker (Required) & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Assign Member */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Assign Worker <span className="text-signal-red">*</span>
              </label>
              <select
                required
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
              >
                <option value="">-- Select Worker (Required) --</option>
                {nonAdminMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Priority
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["Low", "Medium", "High", "Critical"] as const).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 px-1 rounded-md text-center transition-all cursor-pointer text-[11px] font-medium border ${
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
          </div>

          {/* Description (Optional) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-200 block">
              Description & Steps to Reproduce (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any helpful details, browser/device info, or steps to reproduce..."
              className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white text-xs leading-relaxed resize-none font-medium"
            />
          </div>

          {/* Attachment / Screen Recording (Optional) */}
          <div className="space-y-2 pt-2 border-t border-border dark:border-[#262626]">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Evidence / Attachment (Optional)
              </label>
              <div className="flex items-center gap-1 bg-surface dark:bg-[#141414] p-0.5 rounded-md border border-border dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setAttachmentMode("file")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    attachmentMode === "file"
                      ? "bg-white dark:bg-black text-ink dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-ink dark:hover:text-white"
                  }`}
                >
                  File / Paste
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentMode("link")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    attachmentMode === "link"
                      ? "bg-white dark:bg-black text-ink dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-ink dark:hover:text-white"
                  }`}
                >
                  Video Link
                </button>
              </div>
            </div>

            {attachmentMode === "file" ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.zip"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {attachedFile ? (
                  <div className="flex items-center justify-between p-2.5 bg-surface dark:bg-[#111111] rounded-lg border border-border dark:border-[#262626]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm">
                        {attachedFile.type === "image"
                          ? "🖼️"
                          : attachedFile.type === "video"
                          ? "🎥"
                          : "📄"}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                        {attachedFile.name}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        ({(attachedFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-signal-red hover:text-red-700 text-xs font-semibold p-1 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isConvertingFile}
                    className="w-full p-3 border border-dashed border-border dark:border-[#262626] rounded-lg text-center hover:bg-surface dark:hover:bg-[#111111] transition-colors cursor-pointer text-slate-500 dark:text-slate-400"
                  >
                    <span>
                      {isConvertingFile
                        ? "Processing file..."
                        : "📎 Click to upload screenshot/file or press Ctrl+V to paste screenshot"}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  value={videoLinkUrl}
                  onChange={(e) => setVideoLinkUrl(e.target.value)}
                  placeholder="https://loom.com/share/... or Google Drive link"
                  className="w-full px-3 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white text-xs font-medium"
                />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border dark:border-[#262626]">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="px-3.5 py-1.5 rounded-lg border border-border dark:border-[#262626] text-slate-600 dark:text-slate-300 hover:bg-surface dark:hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isConvertingFile}
              className="px-4 py-1.5 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? "Submitting..." : "Report Issue"}
            </button>
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
                    Discard Unsaved Bug Report?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                    You have unsaved changes in this issue report. If you close now, your entered details and attachments will be discarded.
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
