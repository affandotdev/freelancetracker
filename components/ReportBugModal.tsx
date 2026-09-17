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
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

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
    if (isOpen) {
      if (defaultProjectId) {
        setSelectedProjectId(defaultProjectId);
      } else if (projects.length === 1) {
        setSelectedProjectId(projects[0].id);
      } else {
        setSelectedProjectId("");
      }

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

    const formData = new FormData();
    formData.append("projectId", selectedProjectId);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("priority", priority);
    formData.append("assignedToId", selectedMemberId || "none");

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
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0a0a0a] max-w-lg w-full rounded-xl border border-border dark:border-[#262626] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-ink dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border dark:border-[#262626] flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              🐛 Report Issue / Defect
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Only required fields: select project and enter issue title.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
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

          {/* Assign Worker (Optional) & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Assign Member */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                Assign Worker (Optional)
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-[#050505] border border-border dark:border-[#262626] rounded-lg text-ink dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
              >
                <option value="">-- Unassigned --</option>
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
              onClick={onClose}
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
      </div>
    </div>
  );
}
