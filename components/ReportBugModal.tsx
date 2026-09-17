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
  const [selectedProjectId, setSelectedProjectId] = useState(
    defaultProjectId || projects[0]?.id || ""
  );
  const [selectedMemberId, setSelectedMemberId] = useState(defaultAssignedToId || "");
  const [title, setTitle] = useState(defaultTitle || "");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [description, setDescription] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
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
      if (defaultProjectId) setSelectedProjectId(defaultProjectId);
      else if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);

      if (defaultAssignedToId !== undefined) {
        const isTargetAdmin = teamMembers.find(
          (m) =>
            m.id === defaultAssignedToId &&
            (m.role === "SUPER_ADMIN" ||
              m.name.toLowerCase().includes("super admin") ||
              m.email.toLowerCase().includes("admin@"))
        );
        setSelectedMemberId(isTargetAdmin ? "" : defaultAssignedToId);
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

  const filteredMembers = nonAdminMembers.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const selectedMember = nonAdminMembers.find((m) => m.id === selectedMemberId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const quickTags = [
    "Mobile layout broken",
    "Button not responding",
    "API 500 error",
    "Form validation error",
    "Data not saving",
    "UI alignment glitch",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) return;

    const formData = new FormData();
    formData.append("projectId", selectedProjectId);
    formData.append("title", title);
    formData.append("description", description);
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
        setMemberSearch("");
        setAttachedFile(null);
        setVideoLinkUrl("");
        setVideoLinkTitle("");
      } catch (err: any) {
        alert(err?.message || "Failed to submit bug report.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 overflow-y-auto">
      <div
        className="bg-white max-w-xl w-full my-8 rounded-lg border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-surface border-b border-border flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-ink">
              Report Issue
            </h3>
            <p className="text-[12px] text-gray-500">
              Report a defect, link it to the project, and assign it to a team member.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-ink text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-[13px]">
          {/* STEP 1: SELECT RESPONSIBLE MEMBER */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-medium text-gray-700">
                1. Assign To (Optional)
              </label>
              <span className="text-[11px] text-gray-400">
                {selectedMember ? (
                  <strong className="text-accent font-medium">{selectedMember.name}</strong>
                ) : (
                  "Unassigned"
                )}
              </span>
            </div>

            {teamMembers.length > 4 && (
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member..."
                className="w-full px-3 py-1.5 text-[12px] bg-white border border-border rounded-md focus:outline-none"
              />
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedMemberId("")}
                className={`p-2 rounded-md border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                  selectedMemberId === ""
                    ? "bg-blue-50/50 border-accent text-accent font-medium"
                    : "bg-surface border-border text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[12px] truncate font-medium">Unassigned</p>
                </div>
              </button>

              {filteredMembers.map((member) => {
                const isSelected = selectedMemberId === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`p-2 rounded-md border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "bg-blue-50/50 border-accent text-accent font-medium"
                        : "bg-surface border-border text-ink hover:bg-gray-100"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] truncate font-medium">{member.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT PROJECT */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="block text-[12px] font-medium text-gray-700">
              2. Target Project <span className="text-signal-red">*</span>
            </label>
            <select
              required
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.client ? `(Client: ${p.client})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* STEP 3: ISSUE TITLE */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="block text-[12px] font-medium text-gray-700">
              3. Issue Title <span className="text-signal-red">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Header dropdown closes unexpectedly on mobile"
              className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md focus:outline-none"
            />

            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[11px] text-gray-400">Suggestions:</span>
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTitle(tag)}
                  className="text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-gray-100 border border-border text-gray-600 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 4: PRIORITY */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="block text-[12px] font-medium text-gray-700">
              4. Severity & Priority
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["Low", "Medium", "High", "Critical"] as const).map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`p-2 rounded-md border text-center transition-colors cursor-pointer text-[12px] ${
                      isSelected
                        ? "bg-ink text-white font-medium border-ink"
                        : "bg-surface border-border text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 5: DESCRIPTION */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="block text-[12px] font-medium text-gray-700">
              5. Details / Steps to Reproduce
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1. Open product page&#10;2. Click checkout button&#10;3. Notice error dialog appears"
              className="w-full p-2.5 text-[13px] bg-white border border-border rounded-md focus:outline-none resize-none"
            />
          </div>

          {/* STEP 6: ATTACHMENTS */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-medium text-gray-700">
                6. Attachment (Optional)
              </label>
              <div className="flex items-center gap-1 bg-surface p-0.5 rounded border border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setAttachmentMode("file")}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                    attachmentMode === "file" ? "bg-white text-ink shadow-xs" : "text-gray-500"
                  }`}
                >
                  File
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentMode("link")}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                    attachmentMode === "link" ? "bg-white text-ink shadow-xs" : "text-gray-500"
                  }`}
                >
                  Video Link
                </button>
              </div>
            </div>

            {attachmentMode === "file" ? (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.txt,.log,.zip,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processSelectedFile(file);
                  }}
                />

                {!attachedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) processSelectedFile(file);
                    }}
                    className="border border-dashed border-border hover:border-accent bg-surface rounded-md p-4 text-center cursor-pointer transition-colors"
                  >
                    <p className="text-[12px] font-medium text-ink">
                      Click to upload screenshot or file
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Max 15MB • or paste image (Ctrl+V)
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-surface border border-border rounded-md flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink truncate">{attachedFile.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {(attachedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAttachedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-[12px] text-signal-red hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 bg-surface p-3 rounded-md border border-border">
                <div>
                  <input
                    type="url"
                    value={videoLinkUrl}
                    onChange={(e) => setVideoLinkUrl(e.target.value)}
                    placeholder="https://www.loom.com/share/... or video URL"
                    className="w-full px-3 py-1.5 text-[12px] bg-white border border-border rounded-md focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
            <div className="text-[12px] text-gray-500">
              {selectedMember && <span>Assignee: {selectedMember.name}</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !title.trim() || !selectedProjectId}
                className="px-4 py-1.5 bg-signal-red hover:bg-red-700 text-white text-[12px] font-medium rounded-md disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isPending ? "Submitting..." : "Report Issue"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
