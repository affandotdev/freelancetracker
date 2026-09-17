"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  updateProjectAction,
  deleteProjectAction,
  uploadAttachmentAction,
  deleteAttachmentAction,
  createTaskAction,
} from "@/lib/actions";
import {
  getProjectDuration,
  formatDeadlineDate,
  addDaysToDate,
  getDaysDifference,
} from "@/lib/dateUtils";
import TaskStatusBadge from "@/components/TaskStatusBadge";
import BackButton from "@/components/BackButton";
import ProjectIssuesSection, { ProjectIssueItem } from "@/components/ProjectIssuesSection";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import LogMeetingFollowUpModal from "@/components/LogMeetingFollowUpModal";
import LogDirectMeetingModal from "@/components/LogDirectMeetingModal";

export interface AttachmentItem {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  fileData: string;
  isLink: boolean;
  createdAt: string;
}

export interface ProjectTaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  deadline?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  openObjectionsCount?: number;
}

export interface ProjectMeetingItem {
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
    role?: string;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
}

export interface TeamMemberOption {
  id: string;
  name: string;
  email: string;
}

interface ProjectDetailClientProps {
  project: {
    id: string;
    name: string;
    client: string | null;
    clientEmail: string | null;
    category: string | null;
    priority: string;
    status: string;
    progress: number;
    totalAmount: number;
    receivedAmount: number;
    deadline: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  initialAttachments?: AttachmentItem[];
  initialTasks?: ProjectTaskItem[];
  initialIssues?: ProjectIssueItem[];
  initialMeetings?: ProjectMeetingItem[];
  teamMembers?: TeamMemberOption[];
  currentUserId?: string;
}

export default function ProjectDetailClient({
  project,
  initialAttachments = [],
  initialTasks = [],
  initialIssues = [],
  initialMeetings = [],
  teamMembers = [],
  currentUserId = "",
}: ProjectDetailClientProps) {
  const [meetings, setMeetings] = useState<ProjectMeetingItem[]>(initialMeetings);
  const [isScheduleMeetingModalOpen, setIsScheduleMeetingModalOpen] = useState(false);
  const [isDirectMeetingModalOpen, setIsDirectMeetingModalOpen] = useState(false);
  const [activeFollowUpMeeting, setActiveFollowUpMeeting] = useState<ProjectMeetingItem | null>(null);

  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client || "");
  const [clientEmail, setClientEmail] = useState(project.clientEmail || "");
  const [category, setCategory] = useState(project.category || "Web Development");
  const [priority, setPriority] = useState(project.priority || "Medium");
  const [status, setStatus] = useState(project.status || "Not Started");
  const [progress, setProgress] = useState(project.progress || 0);
  const [totalAmount, setTotalAmount] = useState(project.totalAmount || 0);
  const [receivedAmount, setReceivedAmount] = useState(project.receivedAmount || 0);
  const [deadline, setDeadline] = useState(
    project.deadline ? project.deadline.split("T")[0] : ""
  );
  const [durationDays, setDurationDays] = useState<string>(() => {
    if (!project.deadline) return "";
    const diff = getDaysDifference(project.deadline);
    return diff !== null && diff >= 0 ? diff.toString() : "";
  });

  const handleDaysChange = (daysStr: string) => {
    setDurationDays(daysStr);
    const parsed = parseInt(daysStr, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setDeadline(addDaysToDate(parsed));
    } else if (daysStr === "") {
      setDeadline("");
    }
  };

  const handleDateChange = (dateVal: string) => {
    setDeadline(dateVal);
    const diff = getDaysDifference(dateVal);
    if (diff !== null && diff >= 0) {
      setDurationDays(diff.toString());
    } else {
      setDurationDays("");
    }
  };

  const applyDaysPreset = (days: number) => {
    setDurationDays(days.toString());
    setDeadline(addDaysToDate(days));
  };

  const extendDeadlineByDays = (daysToAdd: number) => {
    const baseDate = deadline || new Date().toISOString().split("T")[0];
    const newDate = addDaysToDate(daysToAdd, baseDate);
    setDeadline(newDate);
    const diff = getDaysDifference(newDate);
    if (diff !== null && diff >= 0) {
      setDurationDays(diff.toString());
    }
    setToastMessage(`Extended deadline by +${daysToAdd} days`);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const [description, setDescription] = useState(project.description || "");

  // Tasks State & Handler
  const [tasks, setTasks] = useState<ProjectTaskItem[]>(initialTasks);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignedToId, setTaskAssignedToId] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setIsCreatingTask(true);
    try {
      const formData = new FormData();
      formData.append("projectId", project.id);
      formData.append("title", taskTitle);
      formData.append("description", taskDescription);
      formData.append("assignedToId", taskAssignedToId);
      formData.append("deadline", taskDeadline);

      const created = await createTaskAction(formData);
      if (created) {
        const assignedMember = teamMembers.find((m) => m.id === taskAssignedToId);
        setTasks((prev) => [
          ...prev,
          {
            id: created.id,
            title: created.title,
            description: created.description,
            status: created.status,
            progress: created.progress,
            deadline: created.deadline ? created.deadline.toISOString() : null,
            assignedTo: assignedMember
              ? { id: assignedMember.id, name: assignedMember.name, email: assignedMember.email }
              : null,
            openObjectionsCount: 0,
          },
        ]);
      }
      setIsAddTaskModalOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignedToId("");
      setTaskDeadline("");
      setToastMessage("Task created and assigned successfully");
      setTimeout(() => setToastMessage(""), 3000);
    } catch (err: any) {
      alert(err?.message || "Failed to create task.");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Quotation");
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentFilter, setAttachmentFilter] = useState("all");
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setUploadError("");
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const duration = getProjectDuration(deadline, status, mounted);

  const pendingAmount = Math.max(0, totalAmount - receivedAmount);
  const paymentPct =
    totalAmount > 0
      ? Math.min(100, Math.round((receivedAmount / totalAmount) * 100))
      : 0;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setToastMessage("");

    try {
      await updateProjectAction(project.id, {
        name,
        client,
        clientEmail,
        category,
        priority,
        status,
        progress,
        totalAmount,
        receivedAmount,
        deadline: deadline || null,
        description,
      });

      setToastMessage("Project changes saved successfully");
      setTimeout(() => setToastMessage(""), 3500);
    } catch (err) {
      console.error("Failed to update project:", err);
      alert("Failed to update project. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload");
      return;
    }

    if (selectedFile.size > 4.5 * 1024 * 1024) {
      setUploadError("File exceeds 4.5MB limit. Please choose a smaller file or attach a cloud link.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const fd = new FormData();
      fd.append("projectId", project.id);
      fd.append("category", uploadCategory);
      fd.append("file", selectedFile);

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: fd,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        console.warn("Upload response parse warning:", parseErr);
      }

      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
          (res.status === 413
            ? "File size exceeds server payload limit. Please upload a smaller file or attach a cloud link."
            : `Upload failed (Status ${res.status}). Please try again.`)
        );
      }

      setAttachments((prev) => [data.attachment, ...prev]);
      setToastMessage(`"${selectedFile.name}" uploaded successfully`);
      setTimeout(() => setToastMessage(""), 3500);
      closeModal();
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const fd = new FormData();
      fd.append("projectId", project.id);
      fd.append("category", uploadCategory);
      fd.append("isLink", "true");
      fd.append("linkUrl", linkUrl.trim());
      fd.append("linkName", linkName.trim() || "Cloud Document");

      const res = await fetch("/api/attachments", {
        method: "POST",
        body: fd,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        console.warn("Link response parse warning:", parseErr);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to attach link");
      }

      setAttachments((prev) => [data.attachment, ...prev]);
      setToastMessage("Cloud document link added");
      setTimeout(() => setToastMessage(""), 3500);
      setLinkUrl("");
      setLinkName("");
      closeModal();
    } catch (err: any) {
      console.error("Link attachment failed:", err);
      setUploadError(err.message || "Failed to attach link");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Delete this document/photo?")) return;
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete attachment");
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      setAttachmentFilter("all");
      if (previewItem?.id === attachmentId) setPreviewItem(null);
      setToastMessage("Attachment removed");
      setTimeout(() => setToastMessage(""), 3000);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(err.message || "Failed to delete attachment");
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteProjectAction(project.id);
    } catch (err) {
      console.error(err);
      alert("Failed to delete project.");
      setIsDeleting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "Cloud link";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "Quotation":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "Invoice":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Contract":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Receipt":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Photo":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Filter attachments
  const filteredAttachments = attachments.filter((att) => {
    if (attachmentFilter === "all") return true;
    return att.category === attachmentFilter;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-ink text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-green"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" label="Dashboard" />
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>/</span>
            <span className="text-slate-600">{client || "Personal"}</span>
            <span>/</span>
            <span className="text-ink font-semibold truncate max-w-[200px]">{name}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="text-xs font-medium text-signal-red hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
        >
          Delete Project
        </button>
      </div>

      {/* Main Hero Header Card */}
      <div className="bg-white p-6 sm:p-7 border border-border rounded-lg shadow-xs space-y-5">
        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface text-slate-700 border border-border">
            {category}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-accent border border-blue-100">
            Priority: {priority}
          </span>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
              status === "Enquiry"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : status === "Planning"
                ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                : status === "In Progress"
                ? "bg-blue-50 text-accent border-blue-200"
                : status === "Completed"
                ? "bg-emerald-50 text-signal-green border-emerald-200"
                : status === "On Hold"
                ? "bg-amber-50 text-signal-amber border-amber-200"
                : "bg-surface text-slate-700 border-border"
            }`}
          >
            {status === "Enquiry"
              ? "Enquiry (Uncommitted Lead)"
              : status === "Planning"
              ? "Planning / Upcoming"
              : status}
          </span>

          {mounted && (
            <span
              suppressHydrationWarning
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                duration.statusType === "overdue"
                  ? "bg-red-50 text-signal-red border-red-200"
                  : duration.statusType === "today"
                  ? "bg-amber-50 text-signal-amber border-amber-200"
                  : duration.statusType === "urgent"
                  ? "bg-amber-50 text-signal-amber border-amber-200"
                  : duration.statusType === "planning"
                  ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                  : duration.statusType === "completed"
                  ? "bg-emerald-50 text-signal-green border-emerald-200"
                  : "bg-surface text-slate-600 border-border"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  duration.statusType === "overdue"
                    ? "bg-signal-red"
                    : duration.statusType === "today" || duration.statusType === "urgent"
                    ? "bg-signal-amber"
                    : duration.statusType === "completed"
                    ? "bg-signal-green"
                    : "bg-accent"
                }`}
              />
              <span>{duration.label}</span>
            </span>
          )}

          {attachments.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface text-slate-600 border border-border">
              {attachments.length} {attachments.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>

        {/* Project Title & Client Info */}
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            {name}
          </h1>
          {client && (
            <p className="text-sm text-slate-500 mt-1">
              Client: <strong className="text-slate-800 font-semibold">{client}</strong>
              {clientEmail && (
                <span className="ml-2 text-slate-400">
                  •{" "}
                  <a
                    href={`mailto:${clientEmail}`}
                    className="text-accent hover:underline font-normal"
                  >
                    {clientEmail}
                  </a>
                </span>
              )}
            </p>
          )}
        </div>

        {/* Financial & Timeline KPI Cards Grid */}
        <div className="pt-4 border-t border-border grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Contract */}
          <div className="p-4 bg-surface rounded-lg border border-border">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              Total Contract
            </span>
            <span
              suppressHydrationWarning
              className="text-xl font-bold text-ink tracking-tight tabular-nums block"
            >
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {/* Received Cash */}
          <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-signal-green block mb-1">
              Received Cash
            </span>
            <span
              suppressHydrationWarning
              className="text-xl font-bold text-emerald-700 tracking-tight tabular-nums block"
            >
              {formatCurrency(receivedAmount)}
            </span>
            <span className="text-[11px] text-emerald-600 block mt-0.5 font-medium tabular-nums">
              {paymentPct}% collected
            </span>
          </div>

          {/* Pending Balance */}
          <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-signal-amber block mb-1">
              Pending Balance
            </span>
            <span
              suppressHydrationWarning
              className="text-xl font-bold text-amber-700 tracking-tight tabular-nums block"
            >
              {formatCurrency(pendingAmount)}
            </span>
            <span className="text-[11px] text-amber-600 block mt-0.5 font-medium">
              {pendingAmount === 0 ? "Fully Settled" : "Awaiting payment"}
            </span>
          </div>

          {/* Project Duration Left */}
          <div className="p-4 bg-surface rounded-lg border border-border">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              {status === "Planning" ? "Kickoff Countdown" : "Duration Left"}
            </span>
            <span
              suppressHydrationWarning
              className="text-xl font-bold text-ink tracking-tight block truncate"
            >
              {duration.label}
            </span>
            <span
              suppressHydrationWarning
              className="text-[11px] text-slate-500 block mt-0.5 truncate tabular-nums"
            >
              {deadline ? `Target: ${formatDeadlineDate(deadline)}` : "No deadline set"}
            </span>
          </div>
        </div>

        {/* Dual Progress Meter for Deliverable & Collection */}
        {totalAmount > 0 && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Financial Recovery vs Work Progress</span>
              <span className="text-ink font-semibold tabular-nums">
                {paymentPct}% Billed • {progress}% Built
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-signal-green h-full transition-all duration-300"
                style={{ width: `${paymentPct}%` }}
                title={`Cash Collected: ${paymentPct}%`}
              />
              <div
                className="bg-slate-200 h-full transition-all duration-300"
                style={{ width: `${100 - paymentPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROJECT TASKS & TEAM ASSIGNMENT SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink tracking-tight flex items-center gap-2">
              <span>Deliverable Tasks & Team Assignments</span>
              <span className="text-xs font-semibold text-slate-600 bg-surface px-2 py-0.5 rounded border border-border tabular-nums">
                {tasks.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Break this project down into assignable tasks, track progress, and resolve blockers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddTaskModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            + Add Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-lg text-center space-y-1 bg-surface/50">
            <p className="text-xs font-semibold text-slate-700">No tasks created for this project yet</p>
            <p className="text-xs text-slate-500">Click &quot;+ Add Task&quot; to assign work to team members.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group p-4 bg-white hover:bg-surface border border-border rounded-lg transition-colors shadow-xs space-y-2.5 block"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink group-hover:text-accent transition-colors line-clamp-1">
                    {task.title}
                  </h3>
                  <TaskStatusBadge status={task.status} className="shrink-0 scale-90 origin-top-right" />
                </div>

                {task.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                )}

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>Progress</span>
                    <span className="text-accent font-semibold tabular-nums">{task.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        task.status === "Done"
                          ? "bg-signal-green"
                          : task.status === "Blocked"
                          ? "bg-signal-red"
                          : "bg-accent"
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 truncate">
                    {task.assignedTo ? (
                      <>
                        <span className="w-4 h-4 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 border border-indigo-100">
                          {task.assignedTo.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium truncate text-slate-700">{task.assignedTo.name}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.openObjectionsCount && task.openObjectionsCount > 0 ? (
                      <span className="text-[10px] font-semibold text-signal-red bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                        Blocker
                      </span>
                    ) : null}
                    {task.deadline && (
                      <span className="text-slate-500 text-[11px] tabular-nums font-medium">
                        Due: {formatDeadlineDate(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-6 sm:p-7 rounded-lg shadow-xl border border-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-ink">
                Add Task to Project
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                className="text-slate-400 hover:text-ink font-semibold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Task Title <span className="text-signal-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Design mobile wireframes & user flows"
                  className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description / Deliverable Notes
                </label>
                <textarea
                  rows={3}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Specific requirements, assets needed, or acceptance criteria..."
                  className="w-full p-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400 leading-relaxed resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Assign To Team Member
                  </label>
                  <select
                    value={taskAssignedToId}
                    onChange={(e) => setTaskAssignedToId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-border hover:bg-surface rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTask || !taskTitle.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreatingTask ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLIENT MEETINGS & FOLLOW-UPS SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span>Client Meetings & Follow-ups</span>
              <span className="text-xs font-semibold text-slate-600 bg-surface px-2 py-0.5 rounded border border-border tabular-nums">
                {meetings.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled calls, client discussions, outcomes, and progress reviews for {name}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDirectMeetingModalOpen(true)}
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>+ Log Meeting / Call</span>
            </button>
            <button
              type="button"
              onClick={() => setIsScheduleMeetingModalOpen(true)}
              className="px-3.5 py-1.5 bg-white hover:bg-surface text-slate-700 border border-border rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Schedule Call
            </button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-lg text-center space-y-1 bg-surface/50">
            <p className="text-xs font-semibold text-slate-700">No meetings logged for this project yet</p>
            <p className="text-xs text-slate-500">Log ad-hoc phone calls or schedule upcoming client calls with team members.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="flex items-start justify-between gap-2">
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
                        <h3 className="text-xs font-bold text-ink">{m.title}</h3>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Client: <span className="font-semibold text-slate-700">{m.clientName}</span> ({m.platform})
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.meetingLink && isScheduled && (
                        <a
                          href={m.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 text-xs font-semibold text-white bg-accent hover:bg-blue-700 rounded transition-colors inline-flex items-center gap-0.5"
                        >
                          Join ↗
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveFollowUpMeeting(m)}
                        className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition-colors cursor-pointer"
                      >
                        {m.notes ? "Edit Notes" : "Log Notes"}
                      </button>
                    </div>
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
                    <span>{m.durationMinutes}m</span>
                    {m.assignedTo && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">
                          Assignee: {m.assignedTo.name}
                        </span>
                      </>
                    )}
                  </div>

                  {m.outcome && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[11px] text-slate-400">Outcome:</span>
                      <span className="font-semibold px-2 py-0.5 bg-white border border-border rounded text-slate-700 text-[11px]">
                        {m.outcome}
                      </span>
                      {m.nextFollowUpDate && (
                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                          Next: {new Date(m.nextFollowUpDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {m.notes && (
                    <div className="bg-white p-2.5 rounded border border-border text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      <span className="font-semibold text-slate-900 block mb-0.5 text-[11px]">Discussion Notes:</span>
                      {m.notes}
                    </div>
                  )}

                  {m.actionItems && (
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px] text-slate-700 whitespace-pre-wrap">
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

      {/* ========================================================================= */}
      {/* ISSUES & BUG TRACKER SECTION */}
      {/* ========================================================================= */}
      <ProjectIssuesSection
        projectId={project.id}
        projectName={name}
        initialIssues={initialIssues}
        teamMembers={teamMembers}
      />

      {/* ========================================================================= */}
      {/* DOCUMENTS, QUOTATIONS & PHOTOS SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-7 border border-border rounded-lg shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span>Quotations, Documents & Photos</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface text-slate-600 border border-border tabular-nums">
                {attachments.length} {attachments.length === 1 ? "file" : "files"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently store project estimates, signed contracts, receipts, screenshots, or cloud links.
            </p>
          </div>
        </div>

        {/* ALWAYS-VISIBLE INLINE UPLOAD AREA */}
        <div className="bg-surface border border-border rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: "Quotation", label: "Quotation" },
                { id: "Invoice", label: "Invoice" },
                { id: "Contract", label: "Contract" },
                { id: "Receipt", label: "Receipt" },
                { id: "Photo", label: "Photo / Asset" },
                { id: "Other", label: "Other" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setUploadCategory(cat.id)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap text-xs ${
                    uploadCategory === cat.id
                      ? "bg-ink text-white font-semibold"
                      : "bg-white text-slate-600 hover:text-ink border border-border"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Mode Switcher: File vs Cloud Link */}
            <div className="flex p-1 bg-white border border-border rounded-lg gap-1 text-xs font-medium shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setUploadMode("file");
                  setUploadError("");
                }}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  uploadMode === "file"
                    ? "bg-surface text-ink font-semibold border border-border/80"
                    : "text-slate-500 hover:text-ink"
                }`}
              >
                Direct File
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode("link");
                  setUploadError("");
                }}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  uploadMode === "link"
                    ? "bg-surface text-ink font-semibold border border-border/80"
                    : "text-slate-500 hover:text-ink"
                }`}
              >
                Cloud Link
              </button>
            </div>
          </div>

          {/* Inline Upload Form */}
          {uploadMode === "file" ? (
            <form onSubmit={handleFileUploadSubmit} className="space-y-3">
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-signal-red font-medium flex items-center gap-2">
                  <span className="flex-1">{uploadError}</span>
                </div>
              )}

              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setUploadError("");
                    }
                  }}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    isDragging
                      ? "border-accent bg-blue-50/50"
                      : "border-border hover:border-slate-400 bg-white"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-surface text-slate-600 flex items-center justify-center text-sm border border-border font-semibold">
                    ↑
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Click to browse or drag & drop {uploadCategory.toLowerCase()} file here
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PDF, JPG, PNG, DOCX, XLSX up to 4.5MB • Stored permanently
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.doc,.xlsx,.xls,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setSelectedFile(f);
                        setUploadError("");
                      }
                    }}
                    disabled={isUploading}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border border-border bg-white rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <span className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 uppercase">
                      {selectedFile.name.split(".").pop() || "doc"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {formatBytes(selectedFile.size)} • Category: <strong className="text-accent font-medium">{uploadCategory}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      disabled={isUploading}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-signal-red hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || selectedFile.size > 4.5 * 1024 * 1024}
                      className="flex-1 sm:flex-initial px-4 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <span>Uploading...</span>
                      ) : (
                        <span>Upload {uploadCategory}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* Inline Cloud Link Form */
            <form onSubmit={handleLinkSubmit} className="space-y-3">
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-signal-red font-medium flex items-center gap-2">
                  <span className="flex-1">{uploadError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Document Title (e.g. Master Proposal on Google Docs / Figma)"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink placeholder:text-slate-400"
                />
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/... or https://figma.com/..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={isUploading || !linkUrl}
                    className="px-4 py-2 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isUploading ? "Saving..." : "+ Add Link"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Filter Tabs for Existing Files */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-border pt-4 scrollbar-none text-xs">
            {[
              { id: "all", label: "All Files" },
              { id: "Quotation", label: "Quotations" },
              { id: "Invoice", label: "Invoices" },
              { id: "Contract", label: "Contracts" },
              { id: "Receipt", label: "Receipts" },
              { id: "Photo", label: "Photos" },
              { id: "Other", label: "Other" },
            ].map((tab) => {
              const count =
                tab.id === "all"
                  ? attachments.length
                  : attachments.filter((a) => a.category === tab.id).length;
              if (count === 0 && tab.id !== "all") return null;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAttachmentFilter(tab.id)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    attachmentFilter === tab.id
                      ? "bg-ink text-white font-semibold"
                      : "bg-surface text-slate-600 hover:text-ink border border-border"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1 opacity-70 font-normal">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Attachment Gallery / List */}
        {filteredAttachments.length === 0 ? (
          <div className="py-8 px-4 border border-dashed border-border rounded-lg text-center bg-surface/40">
            <p className="text-xs font-semibold text-slate-700">No documents or photos currently attached</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
              Use the upload area above to attach quotation estimates, signed contracts, or design screenshots.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAttachments.map((att) => {
              const isImage =
                att.mimeType.startsWith("image/") ||
                att.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
              const isPdf =
                att.mimeType === "application/pdf" || att.name.endsWith(".pdf");

              return (
                <div
                  key={att.id}
                  className="bg-white rounded-lg p-3.5 border border-border hover:border-slate-400 hover:shadow-xs transition-all flex flex-col justify-between group space-y-3"
                >
                  <div>
                    {/* Top: Category Pill + Delete */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getCategoryBadge(
                          att.category
                        )}`}
                      >
                        {att.category}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        title="Delete file"
                        className="text-slate-400 hover:text-signal-red p-1 transition-colors cursor-pointer text-xs"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Preview / Thumbnail */}
                    {isImage && !att.isLink ? (
                      <div
                        onClick={() => setPreviewItem(att)}
                        className="w-full h-32 rounded bg-surface overflow-hidden mb-2.5 cursor-pointer relative group/img border border-border"
                      >
                        <img
                          src={att.fileData || `/api/attachments/${att.id}`}
                          alt={att.name}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                          View Image
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          if (att.isLink) {
                            window.open(att.fileData, "_blank");
                          } else {
                            window.open(`/api/attachments/${att.id}`, "_blank");
                          }
                        }}
                        className="w-full h-24 rounded bg-surface hover:bg-slate-100 border border-border flex flex-col items-center justify-center cursor-pointer transition-colors mb-2.5 text-center p-2 group/doc"
                      >
                        <span className="text-xs font-bold text-slate-500 uppercase mb-1">
                          {att.isLink ? "LINK" : isPdf ? "PDF" : "DOC"}
                        </span>
                        <span className="text-[11px] font-medium text-slate-700 group-hover/doc:text-accent truncate max-w-full">
                          {att.isLink ? "Open Cloud Link" : "Click to Preview"}
                        </span>
                      </div>
                    )}

                    {/* File Name & Details */}
                    <div className="space-y-0.5">
                      <p
                        title={att.name}
                        className="text-xs font-semibold text-ink truncate"
                      >
                        {att.name}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                        <span>{formatBytes(att.size)}</span>
                        <span>
                          {new Date(att.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Open & Download */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2 text-xs">
                    {att.isLink ? (
                      <a
                        href={att.fileData}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline font-medium text-[11px] flex items-center gap-1"
                      >
                        <span>Open Link</span>
                        <span>↗</span>
                      </a>
                    ) : (
                      <>
                        <a
                          href={`/api/attachments/${att.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline font-medium text-[11px]"
                        >
                          Preview ↗
                        </a>
                        <a
                          href={`/api/attachments/${att.id}?download=true`}
                          download={att.name}
                          className="text-slate-600 hover:text-ink font-medium text-[11px]"
                        >
                          Download ↓
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox / Image Preview Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg overflow-hidden max-w-2xl w-full border border-border shadow-2xl space-y-3 p-4"
          >
            <div className="flex items-center justify-between px-2 pb-2 border-b border-border">
              <span className="text-xs font-semibold text-ink truncate max-w-md">
                {previewItem.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-ink text-sm p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-900 rounded p-2">
              <img
                src={previewItem.fileData || `/api/attachments/${previewItem.id}`}
                alt={previewItem.name}
                className="max-h-[65vh] object-contain rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-2 pt-1 text-xs">
              <a
                href={`/api/attachments/${previewItem.id}?download=true`}
                download={previewItem.name}
                className="px-4 py-2 bg-accent hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                Download Photo
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Editable Management Form */}
      <form
        onSubmit={handleUpdate}
        className="bg-white p-6 sm:p-7 border border-border rounded-lg shadow-xs space-y-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-ink">
              Project Configuration & Specifications
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update scope, timeline, contracted fees, and current completion level
            </p>
          </div>
        </div>

        {/* Title, Category & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Project Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer font-medium"
            >
              <option value="Web Development">Web Development</option>
              <option value="UI/UX Design">UI/UX Design</option>
              <option value="Mobile App">Mobile App</option>
              <option value="Branding">Branding</option>
              <option value="SEO & Marketing">SEO & Marketing</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer font-medium"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Client & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client Name
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Acme Corp / Sarah Jenkins"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client Contact Email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@company.com"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-medium text-ink placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Financial Specifications */}
        <div className="p-4 bg-surface rounded-lg border border-border space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Financial Terms & Milestones (₹ INR)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {status === "Enquiry"
                  ? "Quoted Budget Estimate (₹)"
                  : status === "Planning"
                  ? "Fixed Agreed Contract Amount (₹)"
                  : "Total Contract Value (₹)"}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-semibold text-ink tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {status === "Planning"
                  ? "Advance Deposit Received (₹)"
                  : "Received Cash Amount (₹)"}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-semibold text-signal-green tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Status, Deadline & Work Progress */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Deliverable Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value;
                  setStatus(s);
                  if (s === "Completed" && progress < 100) setProgress(100);
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer font-medium"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Planning">Planning / Upcoming (Fixed Amount)</option>
                <option value="Enquiry">Enquiry (Uncommitted / Lead)</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  {status === "Planning"
                    ? "Scheduled Kickoff Date"
                    : "Target Deadline & Duration"}
                </label>
                {deadline && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeadline("");
                      setDurationDays("");
                    }}
                    className="text-[11px] text-slate-400 hover:text-signal-red font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Two-Way Inputs: Calendar Date OR Duration in Days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-1">Calendar Date:</span>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer font-medium tabular-nums"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-1">Duration (Days):</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="e.g. 20"
                      value={durationDays}
                      onChange={(e) => handleDaysChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 pr-10 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink tabular-nums font-semibold"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 pointer-events-none">
                      days
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mr-1">Presets:</span>
                {[
                  { days: 7, label: "+7d" },
                  { days: 15, label: "+15d" },
                  { days: 20, label: "+20d" },
                  { days: 30, label: "+30d" },
                  { days: 45, label: "+45d" },
                  { days: 60, label: "+60d" },
                ].map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => applyDaysPreset(p.days)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium tabular-nums transition-colors cursor-pointer ${
                      durationDays === p.days.toString()
                        ? "bg-slate-900 text-white"
                        : "bg-surface hover:bg-slate-200 text-slate-600 border border-border"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}

                {deadline && (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-slate-400 font-medium">Extend:</span>
                    <button
                      type="button"
                      onClick={() => extendDeadlineByDays(7)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 hover:bg-amber-100 text-signal-amber border border-amber-200 transition-colors cursor-pointer tabular-nums"
                    >
                      +7d
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDeadlineByDays(15)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 hover:bg-amber-100 text-signal-amber border border-amber-200 transition-colors cursor-pointer tabular-nums"
                    >
                      +15d
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDeadlineByDays(30)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 hover:bg-amber-100 text-signal-amber border border-amber-200 transition-colors cursor-pointer tabular-nums"
                    >
                      +30d
                    </button>
                  </div>
                )}
              </div>

              {mounted && deadline && (
                <div
                  suppressHydrationWarning
                  className="text-xs mt-1 px-3 py-2 bg-surface rounded-lg border border-border flex items-center justify-between font-medium"
                >
                  <span
                    className={
                      duration.statusType === "overdue"
                        ? "text-signal-red font-semibold"
                        : duration.statusType === "today"
                        ? "text-signal-amber font-semibold"
                        : duration.statusType === "urgent"
                        ? "text-signal-amber font-semibold"
                        : duration.statusType === "planning"
                        ? "text-accent font-semibold"
                        : "text-slate-700 font-medium"
                    }
                  >
                    {duration.label}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums font-medium">
                    {formatDeadlineDate(deadline)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Work Progress with Quick Presets */}
          <div className="p-4 bg-surface rounded-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Work Completion Progress
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
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-accent"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Presets:</span>
              {[
                { label: "0%", val: 0 },
                { label: "25%", val: 25 },
                { label: "50%", val: 50 },
                { label: "75%", val: 75 },
                { label: "100%", val: 100 },
              ].map((btn) => (
                <button
                  key={btn.val}
                  type="button"
                  onClick={() => {
                    setProgress(btn.val);
                    if (btn.val === 100) setStatus("Completed");
                  }}
                  className={`text-xs font-medium px-2.5 py-0.5 rounded transition-colors cursor-pointer tabular-nums ${
                    progress === btn.val
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-border"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope & Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Scope, Milestones & Notes
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Record key milestones, client requests, deliverables, or technical specs..."
            className="w-full p-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none font-medium leading-relaxed text-ink placeholder:text-slate-400"
          />
        </div>

        {/* Submit Save Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full py-2.5 px-5 bg-accent hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? "Saving Changes..." : "Save Project Changes"}
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full border border-border shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-signal-red">
              <h3 className="text-base font-bold text-ink">Delete Project?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-ink font-semibold">&quot;{name}&quot;</strong>?
              This action will also erase all attached quotations, contracts, and receipts.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-border hover:bg-surface rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold bg-signal-red hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct / Unscheduled Meeting Modal */}
      <LogDirectMeetingModal
        isOpen={isDirectMeetingModalOpen}
        onClose={() => setIsDirectMeetingModalOpen(false)}
        projects={[{ id: project.id, name, client }]}
        defaultProjectId={project.id}
        defaultClientName={client || ""}
        defaultTitle={`Meeting update: ${name}`}
        onMeetingLogged={(newMeeting) => {
          setMeetings((prev) => [
            {
              id: newMeeting.id,
              projectId: newMeeting.projectId,
              projectName: name,
              projectClient: client || null,
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
              assignedTo: newMeeting.assignedTo || null,
              createdBy: newMeeting.createdBy || null,
            },
            ...prev,
          ]);
        }}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleMeetingModalOpen}
        onClose={() => setIsScheduleMeetingModalOpen(false)}
        projects={[{ id: project.id, name, client }]}
        teamMembers={teamMembers}
        isSuperAdmin={true}
        currentUserId={currentUserId}
        preselectedProjectId={project.id}
        defaultClientName={client || ""}
        defaultTitle={`Client Sync on ${name}`}
        onMeetingCreated={(created) => {
          setMeetings((prev) => [
            {
              id: created.id,
              projectId: created.projectId,
              projectName: name,
              projectClient: client || null,
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
              assignedTo: created.assignedTo || null,
              createdBy: created.createdBy || null,
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
    </div>
  );
}
