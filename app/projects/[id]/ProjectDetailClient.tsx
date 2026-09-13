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
  teamMembers?: TeamMemberOption[];
}

export default function ProjectDetailClient({
  project,
  initialAttachments = [],
  initialTasks = [],
  teamMembers = [],
}: ProjectDetailClientProps) {
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
    setToastMessage(`Extended deadline by +${daysToAdd} days!`);
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
      setToastMessage("Task created and assigned!");
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

  const openUploadModal = (cat?: string) => {
    if (cat) setUploadCategory(cat);
    setSelectedFile(null);
    setUploadError("");
    setIsDragging(false);
    setIsUploadModalOpen(true);
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

      setToastMessage("Project changes saved successfully!");
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
      setToastMessage(`"${selectedFile.name}" uploaded successfully!`);
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
      setToastMessage("Cloud document link added!");
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
      setAttachmentFilter("all"); // Always reset filter so user isn't stuck on an empty tab
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
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Invoice":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Contract":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Receipt":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Photo":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Quotation":
        return "📄";
      case "Invoice":
        return "🧾";
      case "Contract":
        return "📝";
      case "Receipt":
        return "💳";
      case "Photo":
        return "🖼️";
      default:
        return "📎";
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
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" label="Dashboard" />
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>/</span>
            <span className="text-slate-700">{client || "Personal"}</span>
            <span>/</span>
            <span className="text-slate-900 font-bold truncate max-w-[200px]">{name}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
        >
          🗑️ Delete
        </button>
      </div>

      {/* Main Hero Header Card */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-2xs space-y-5">
        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
            {category}
          </span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            Priority: {priority}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
              status === "Enquiry"
                ? "bg-purple-600 text-white"
                : status === "Planning"
                ? "bg-cyan-600 text-white"
                : status === "In Progress"
                ? "bg-blue-600 text-white"
                : status === "Completed"
                ? "bg-emerald-600 text-white"
                : status === "On Hold"
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-white"
            }`}
          >
            {status === "Enquiry"
              ? "💡 Enquiry (Uncommitted Lead)"
              : status === "Planning"
              ? "🗓️ Planning / Upcoming (Fixed Amount)"
              : status}
          </span>

          {mounted && (
            <span
              suppressHydrationWarning
              className={`text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5 ${
                duration.statusType === "overdue"
                  ? "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"
                  : duration.statusType === "today"
                  ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                  : duration.statusType === "urgent"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : duration.statusType === "planning"
                  ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                  : duration.statusType === "completed"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              <span>
                {duration.statusType === "overdue"
                  ? "⚠️"
                  : duration.statusType === "today"
                  ? "🔥"
                  : duration.statusType === "planning"
                  ? "🚀"
                  : duration.statusType === "completed"
                  ? "✓"
                  : "⏳"}
              </span>
              <span>{duration.label}</span>
            </span>
          )}

          {attachments.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
              <span>📎</span>
              <span>{attachments.length} files</span>
            </span>
          )}
        </div>

        {/* Project Title & Client Info */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {name}
          </h1>
          {client && (
            <p className="text-sm text-slate-500 mt-1">
              Client: <strong className="text-slate-800">{client}</strong>
              {clientEmail && (
                <span className="ml-2">
                  •{" "}
                  <a
                    href={`mailto:${clientEmail}`}
                    className="text-blue-600 hover:underline"
                  >
                    {clientEmail}
                  </a>
                </span>
              )}
            </p>
          )}
        </div>

        {/* Financial & Timeline KPI Cards Grid */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Contract */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              Total Contract
            </span>
            <span
              suppressHydrationWarning
              className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight"
            >
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {/* Received Cash */}
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-600 block mb-1">
              Received Cash
            </span>
            <span
              suppressHydrationWarning
              className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight"
            >
              {formatCurrency(receivedAmount)}
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
              {paymentPct}% collected
            </span>
          </div>

          {/* Pending Balance */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 block mb-1">
              Pending Balance
            </span>
            <span
              suppressHydrationWarning
              className="text-xl sm:text-2xl font-extrabold text-amber-700 tracking-tight"
            >
              {formatCurrency(pendingAmount)}
            </span>
            <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">
              {pendingAmount === 0 ? "Fully Settled" : "Awaiting payment"}
            </span>
          </div>

          {/* Project Duration Left */}
          <div
            className={`p-4 rounded-2xl border ${
              duration.statusType === "overdue"
                ? "bg-rose-50/70 border-rose-200"
                : duration.statusType === "today"
                ? "bg-amber-50/80 border-amber-200"
                : duration.statusType === "urgent"
                ? "bg-amber-50/50 border-amber-200"
                : duration.statusType === "planning"
                ? "bg-cyan-50/60 border-cyan-100"
                : duration.statusType === "completed"
                ? "bg-emerald-50/60 border-emerald-100"
                : "bg-slate-50 border-slate-100"
            }`}
          >
            <span
              className={`text-xs uppercase tracking-wider font-semibold block mb-1 ${
                duration.statusType === "overdue"
                  ? "text-rose-600 font-bold"
                  : duration.statusType === "today"
                  ? "text-amber-700 font-bold"
                  : duration.statusType === "planning"
                  ? "text-cyan-700 font-bold"
                  : duration.statusType === "completed"
                  ? "text-emerald-700 font-bold"
                  : "text-slate-400"
              }`}
            >
              {status === "Planning" ? "Kickoff Countdown" : "Duration Left"}
            </span>
            <span
              suppressHydrationWarning
              className={`text-xl sm:text-2xl font-extrabold flex items-center gap-1.5 tracking-tight ${
                duration.statusType === "overdue"
                  ? "text-rose-700"
                  : duration.statusType === "today"
                  ? "text-amber-800"
                  : duration.statusType === "planning"
                  ? "text-cyan-800"
                  : duration.statusType === "completed"
                  ? "text-emerald-700"
                  : "text-slate-900"
              }`}
            >
              {duration.label}
            </span>
            <span
              suppressHydrationWarning
              className="text-[10px] text-slate-500 block mt-0.5 truncate"
            >
              {deadline ? `Target: ${formatDeadlineDate(deadline)}` : "No deadline set"}
            </span>
          </div>
        </div>

        {/* Dual Progress Meter for Deliverable & Collection */}
        {totalAmount > 0 && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Financial Recovery vs Work Progress</span>
              <span className="text-slate-900 font-bold">
                {paymentPct}% Billed • {progress}% Built
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${paymentPct}%` }}
                title={`Cash Collected: ${paymentPct}%`}
              />
              <div
                className="bg-slate-200 h-full transition-all duration-500"
                style={{ width: `${100 - paymentPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROJECT TASKS & TEAM ASSIGNMENT SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>📋 Deliverable Tasks & Team Assignments</span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Break this project down into assignable tasks, track worker progress, and resolve blockers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddTaskModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer self-start sm:self-auto"
          >
            <span>+ Add Task</span>
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
            <span className="text-2xl">📝</span>
            <p className="text-xs font-bold text-slate-700">No tasks created for this project yet.</p>
            <p className="text-xs text-slate-400">Click "+ Add Task" to assign work to your team members.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group p-4 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 hover:border-blue-400 rounded-2xl transition-all shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
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
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Progress</span>
                    <span className="text-blue-600">{task.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        task.status === "Done"
                          ? "bg-emerald-500"
                          : task.status === "Blocked"
                          ? "bg-rose-500"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 truncate">
                    {task.assignedTo ? (
                      <>
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {task.assignedTo.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold truncate">{task.assignedTo.name}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.openObjectionsCount && task.openObjectionsCount > 0 ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                        ⚠️ Blocker
                      </span>
                    ) : null}
                    {task.deadline && (
                      <span className="text-slate-500 text-[10px] font-medium">
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
          <div className="bg-white max-w-lg w-full p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Add Task to Project
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Design mobile wireframes & user flows"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Description / Deliverable Notes
                </label>
                <textarea
                  rows={3}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Specific requirements, assets needed, or acceptance criteria..."
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Assign To Team Member
                  </label>
                  <select
                    value={taskAssignedToId}
                    onChange={(e) => setTaskAssignedToId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTask || !taskTitle.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreatingTask ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOCUMENTS, QUOTATIONS & PHOTOS SECTION (ALWAYS-VISIBLE UPLOAD SUITE) */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📁 Quotations, Documents & Photos</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {attachments.length} {attachments.length === 1 ? "file" : "files"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently store project estimates, signed contracts, receipts, design photos, or external links
            </p>
          </div>
        </div>

        {/* ALWAYS-VISIBLE INLINE UPLOAD AREA (Never disappears when files are deleted) */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: "Quotation", label: "📄 Quotation" },
                { id: "Invoice", label: "🧾 Invoice" },
                { id: "Contract", label: "📝 Contract" },
                { id: "Receipt", label: "💳 Receipt" },
                { id: "Photo", label: "🖼️ Photo / Asset" },
                { id: "Other", label: "📎 Other" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setUploadCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    uploadCategory === cat.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Mode Switcher: File vs Cloud Link */}
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl gap-1 text-xs font-bold shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setUploadMode("file");
                  setUploadError("");
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  uploadMode === "file"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                📁 Direct File
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode("link");
                  setUploadError("");
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  uploadMode === "link"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🌐 Cloud Link
              </button>
            </div>
          </div>

          {/* Inline Upload Form */}
          {uploadMode === "file" ? (
            <form onSubmit={handleFileUploadSubmit} className="space-y-3">
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <span className="text-sm shrink-0">⚠️</span>
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
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/60 scale-[0.99]"
                      : "border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/20 shadow-2xs"
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-2xs">
                    📁
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to browse or drag & drop {uploadCategory.toLowerCase()} file here
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PDF, JPG, PNG, DOCX, XLSX up to 4.5MB • Stored permanently with project
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
                <div className="border border-slate-200 bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <span className="text-2xl shrink-0">
                      {selectedFile.type.startsWith("image/")
                        ? "🖼️"
                        : selectedFile.name.endsWith(".pdf")
                        ? "📄"
                        : "📎"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatBytes(selectedFile.size)} • Category: <strong className="text-blue-600">{uploadCategory}</strong>
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
                      className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      ✕ Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || selectedFile.size > 4.5 * 1024 * 1024}
                      className="flex-1 sm:flex-initial px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <span>Upload {uploadCategory} Now 🚀</span>
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
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <span className="text-sm shrink-0">⚠️</span>
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
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/... or https://figma.com/..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isUploading || !linkUrl}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-slate-100 pt-4 scrollbar-none text-xs">
            {[
              { id: "all", label: "All Files" },
              { id: "Quotation", label: "📄 Quotations" },
              { id: "Invoice", label: "🧾 Invoices" },
              { id: "Contract", label: "📝 Contracts" },
              { id: "Receipt", label: "💳 Receipts" },
              { id: "Photo", label: "🖼️ Photos" },
              { id: "Other", label: "📎 Other" },
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
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    attachmentFilter === tab.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1.5 opacity-70 font-normal">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Attachment Gallery / List */}
        {filteredAttachments.length === 0 ? (
          <div className="py-8 px-4 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/40">
            <span className="text-2xl block mb-1">📑</span>
            <p className="text-xs font-bold text-slate-700">No documents or photos currently attached</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
              Use the upload area above to attach quotation estimates, signed contracts, or design screenshots anytime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAttachments.map((att) => {
              const isImage =
                att.mimeType.startsWith("image/") ||
                att.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
              const isPdf =
                att.mimeType === "application/pdf" || att.name.endsWith(".pdf");

              return (
                <div
                  key={att.id}
                  className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/90 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between group space-y-3"
                >
                  <div>
                    {/* Top: Category Pill + Delete */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${getCategoryBadge(
                          att.category
                        )}`}
                      >
                        <span>{getCategoryIcon(att.category)}</span>
                        <span>{att.category}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        title="Delete file"
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Preview / Thumbnail */}
                    {isImage && !att.isLink ? (
                      <div
                        onClick={() => setPreviewItem(att)}
                        className="w-full h-32 rounded-xl bg-slate-200/80 overflow-hidden mb-2.5 cursor-pointer relative group/img border border-slate-200"
                      >
                        <img
                          src={att.fileData || `/api/attachments/${att.id}`}
                          alt={att.name}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <span>🔍 View Photo</span>
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
                        className="w-full h-24 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 flex flex-col items-center justify-center cursor-pointer transition-colors mb-2.5 text-center p-2 group/doc"
                      >
                        <span className="text-2xl mb-1">
                          {att.isLink ? "🌐" : isPdf ? "📄" : "📝"}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 group-hover/doc:text-blue-600 truncate max-w-full">
                          {att.isLink ? "Open Cloud Link" : "Click to Preview"}
                        </span>
                      </div>
                    )}

                    {/* File Name & Details */}
                    <div className="space-y-0.5">
                      <p
                        title={att.name}
                        className="text-xs font-bold text-slate-900 truncate"
                      >
                        {att.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
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
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
                    {att.isLink ? (
                      <a
                        href={att.fileData}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-bold text-[11px] flex items-center gap-1"
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
                          className="text-blue-600 hover:underline font-bold text-[11px]"
                        >
                          Preview ↗
                        </a>
                        <a
                          href={`/api/attachments/${att.id}?download=true`}
                          download={att.name}
                          className="text-slate-600 hover:text-slate-900 font-semibold text-[11px]"
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

      {/* Upload Modal Drawer */}
      {isUploadModalOpen && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Upload Project Attachment
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher: File vs Cloud Link */}
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setUploadMode("file");
                  setUploadError("");
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  uploadMode === "file"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                📁 Direct File Upload
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode("link");
                  setUploadError("");
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  uploadMode === "link"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🌐 Cloud Link (Drive/Figma)
              </button>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Attachment Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Quotation">📄 Quotation / Estimate</option>
                <option value="Invoice">🧾 Invoice / Bill</option>
                <option value="Contract">📝 Signed Contract / NDA</option>
                <option value="Receipt">💳 Payment Receipt</option>
                <option value="Photo">🖼️ Photo / Screenshot / Design</option>
                <option value="Other">📎 Other Document</option>
              </select>
            </div>

            {uploadMode === "file" ? (
              /* File Input Form */
              <form onSubmit={handleFileUploadSubmit} className="space-y-4">
                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                    <span className="text-sm shrink-0">⚠️</span>
                    <span className="flex-1">{uploadError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Select Document / Photo
                  </label>

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
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                          : "border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-2xs">
                        📁
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Click to browse or drag & drop file
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          PDF quotations, JPG/PNG photos, invoices, docs (up to 4.5MB)
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
                    <div className="border border-slate-200 bg-slate-50/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">
                            {selectedFile.type.startsWith("image/")
                              ? "🖼️"
                              : selectedFile.name.endsWith(".pdf")
                              ? "📄"
                              : "📎"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {formatBytes(selectedFile.size)} • {uploadCategory}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          disabled={isUploading}
                          className="text-xs font-bold text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        >
                          ✕ Change
                        </button>
                      </div>

                      {selectedFile.size > 4.5 * 1024 * 1024 && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-semibold">
                          ⚠️ File is {formatBytes(selectedFile.size)}, which exceeds the 4.5MB limit. Please choose a smaller file or use Cloud Link mode.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUploading || !selectedFile || (selectedFile && selectedFile.size > 4.5 * 1024 * 1024)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Uploading & Saving to Project...</span>
                    </>
                  ) : (
                    <span>Upload Attachment Now 🚀</span>
                  )}
                </button>
              </form>
            ) : (
              /* Cloud Link Input Form */
              <form onSubmit={handleLinkSubmit} className="space-y-3">
                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                    <span className="text-sm shrink-0">⚠️</span>
                    <span className="flex-1">{uploadError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Document Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Proposal on Google Docs / Figma Prototype"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Cloud URL Link
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/... or https://figma.com/..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUploading || !linkUrl}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer mt-2 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Saving Cloud Link...</span>
                    </>
                  ) : (
                    <span>Attach Cloud Document Link</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Lightbox / Image Preview Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full border border-slate-200 shadow-2xl space-y-3 p-4"
          >
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-800 truncate max-w-md">
                {previewItem.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-slate-700 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-900 rounded-2xl p-2">
              <img
                src={previewItem.fileData || `/api/attachments/${previewItem.id}`}
                alt={previewItem.name}
                className="max-h-[65vh] object-contain rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-2 pt-1 text-xs">
              <a
                href={`/api/attachments/${previewItem.id}?download=true`}
                download={previewItem.name}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
              >
                Download Photo ↓
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Editable Management Form */}
      <form
        onSubmit={handleUpdate}
        className="bg-white p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-2xs space-y-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Project Configuration & Specifications
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update scope, timeline, contracted fees, and current completion level
            </p>
          </div>
        </div>

        {/* Title, Category & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Project Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent 🔥</option>
            </select>
          </div>
        </div>

        {/* Client & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Client Name
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Acme Corp / Sarah Jenkins"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Client Contact Email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@company.com"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Financial Specifications */}
        <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Financial Terms & Milestones (₹ INR)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-emerald-700"
              />
            </div>
          </div>
        </div>

        {/* Status, Deadline & Work Progress */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Deliverable Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value;
                  setStatus(s);
                  if (s === "Completed" && progress < 100) setProgress(100);
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-semibold"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Planning">🗓️ Planning / Upcoming (Fixed Amount)</option>
                <option value="Enquiry">💡 Enquiry (Uncommitted / Lead)</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  {status === "Planning"
                    ? "Scheduled Kickoff / Start Date"
                    : "Target Deadline & Duration"}
                </label>
                {deadline && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeadline("");
                      setDurationDays("");
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Two-Way Inputs: Calendar Date OR Duration in Days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block mb-1">Calendar Date:</span>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block mb-1">Or Days from now:</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="e.g. 20, 30"
                      value={durationDays}
                      onChange={(e) => handleDaysChange(e.target.value)}
                      className="w-full px-3 py-2 pr-12 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      days
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Presets (e.g. +7d, +15d, +20d, +30d, +45d, +60d) */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-0.5">Quick:</span>
                {[
                  { days: 7, label: "+7d" },
                  { days: 15, label: "+15d" },
                  { days: 20, label: "+20d" },
                  { days: 30, label: "+30d (1 mo)" },
                  { days: 45, label: "+45d" },
                  { days: 60, label: "+60d (2 mos)" },
                ].map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => applyDaysPreset(p.days)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      durationDays === p.days.toString()
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}

                {deadline && (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-slate-400 font-semibold">Extend:</span>
                    <button
                      type="button"
                      onClick={() => extendDeadlineByDays(7)}
                      title="Add 7 days to current deadline"
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer"
                    >
                      +7d
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDeadlineByDays(15)}
                      title="Add 15 days to current deadline"
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer"
                    >
                      +15d
                    </button>
                    <button
                      type="button"
                      onClick={() => extendDeadlineByDays(30)}
                      title="Add 30 days to current deadline"
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer"
                    >
                      +30d
                    </button>
                  </div>
                )}
              </div>

              {mounted && deadline && (
                <div
                  suppressHydrationWarning
                  className="text-xs mt-1 p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between font-medium"
                >
                  <span
                    className={
                      duration.statusType === "overdue"
                        ? "text-rose-600 font-bold"
                        : duration.statusType === "today"
                        ? "text-amber-700 font-bold"
                        : duration.statusType === "urgent"
                        ? "text-amber-600 font-semibold"
                        : duration.statusType === "planning"
                        ? "text-cyan-700 font-semibold"
                        : "text-blue-600 font-semibold"
                    }
                  >
                    ⏱️ {duration.label}
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {formatDeadlineDate(deadline)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Work Progress with Quick Presets */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Work Completion Progress
              </label>
              <span className="text-xs font-extrabold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-lg">
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
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Presets:</span>
              {[
                { label: "0%", val: 0 },
                { label: "25%", val: 25 },
                { label: "50%", val: 50 },
                { label: "75%", val: 75 },
                { label: "100% Done", val: 100 },
              ].map((btn) => (
                <button
                  key={btn.val}
                  type="button"
                  onClick={() => {
                    setProgress(btn.val);
                    if (btn.val === 100) setStatus("Completed");
                  }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    progress === btn.val
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
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
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Scope, Milestones & Notes
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Record key milestones, client requests, deliverables, or technical specs..."
            className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium leading-relaxed"
          />
        </div>

        {/* Submit Save Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full py-3 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? "Saving Changes..." : "Save Project Changes"}
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900">Delete Project?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900">&quot;{name}&quot;</strong>?
              This action will also erase all attached quotations, contracts, and receipts.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
