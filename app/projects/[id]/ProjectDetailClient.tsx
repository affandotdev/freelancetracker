"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { updateProjectAction, deleteProjectAction } from "@/lib/actions";
import {
  getProjectDuration,
  formatDeadlineDate,
} from "@/lib/dateUtils";

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
}

export default function ProjectDetailClient({
  project,
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
  const [description, setDescription] = useState(project.description || "");

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [message, setMessage] = useState("");
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
    setMessage("");

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
      setMessage("Project & financials updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage("Failed to update project.");
    } finally {
      setIsUpdating(false);
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Back to Dashboard
        </Link>
        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
        >
          🗑️ Delete Project
        </button>
      </div>

      {/* Main Hero Header Card */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-xs space-y-4">
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
        </div>

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

        {/* Financial & Timeline KPI Widget */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              Total Contract
            </span>
            <span
              suppressHydrationWarning
              className="text-xl sm:text-2xl font-extrabold text-slate-900"
            >
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-600 block mb-1">
              Received Cash
            </span>
            <span
              suppressHydrationWarning
              className="text-xl sm:text-2xl font-extrabold text-emerald-700"
            >
              {formatCurrency(receivedAmount)}
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">
              {paymentPct}% collected
            </span>
          </div>

          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100">
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 block mb-1">
              Pending Balance
            </span>
            <span
              suppressHydrationWarning
              className="text-xl sm:text-2xl font-extrabold text-amber-700"
            >
              {formatCurrency(pendingAmount)}
            </span>
            <span className="text-[10px] text-amber-600 block mt-0.5">
              {pendingAmount === 0 ? "Fully Settled" : "Awaiting payment"}
            </span>
          </div>

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
              className={`text-xl sm:text-2xl font-extrabold flex items-center gap-1.5 ${
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
      </div>

      {/* Enquiry Onboarding Banner */}
      {status === "Enquiry" && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                Uncommitted Enquiry / Prospective Lead
              </span>
            </div>
            <p className="text-xs text-purple-700 mt-1">
              This client inquiry is under discussion and not yet committed. Click below once the proposal is accepted to onboard it into active deliverables.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("In Progress");
              if (progress === 0) setProgress(15);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            🚀 Onboard to Active Work
          </button>
        </div>
      )}

      {/* Planning / Upcoming Kickoff Banner */}
      {status === "Planning" && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 border border-cyan-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-bold text-cyan-900 uppercase tracking-wider">
                🗓️ Confirmed Upcoming Project (Fixed Amount)
              </span>
            </div>
            <p className="text-xs text-cyan-700 mt-1">
              Fixed contract terms confirmed with client. Ready to kick off? Click below to move status to In Progress.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("In Progress");
              if (progress === 0) setProgress(15);
            }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            ⚡ Kick Off & Start Work
          </button>
        </div>
      )}

      {/* Editable Management Form */}
      <form
        onSubmit={handleUpdate}
        className="bg-white p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-xs space-y-6"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            Project Specifications & Milestones
          </h2>
          {message && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              {message}
            </span>
          )}
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
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Client Email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Financials Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {status === "Planning"
                ? "Fixed Agreed Contract Amount (₹)"
                : "Total Contract Amount (₹)"}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {status === "Planning" && (
              <p className="text-[11px] text-cyan-700 mt-1">
                Agreed fixed fee for upcoming project kickoff.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {status === "Planning"
                ? "Advance / Deposit Received (₹)"
                : "Received Amount (₹)"}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(Number(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {status === "Planning" && (
              <p className="text-[11px] text-slate-500 mt-1">
                Advance paid to confirm the upcoming work slot.
              </p>
            )}
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
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Planning">🗓️ Planning / Upcoming (Fixed Amount)</option>
                <option value="Enquiry">💡 Enquiry (Uncommitted / Lead)</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {status === "Planning"
                  ? "Scheduled Kickoff / Start Date"
                  : "Target Deadline"}
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              {mounted && deadline && (
                <p
                  suppressHydrationWarning
                  className="text-xs mt-1.5 font-medium flex items-center gap-1.5"
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
                  <span className="text-slate-400">
                    ({formatDeadlineDate(deadline)})
                  </span>
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Work Completion Progress
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProgress((p) => Math.max(0, p - 10))}
                  className="px-2 py-0.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  -10%
                </button>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {progress}%
                </span>
                <button
                  type="button"
                  onClick={() => setProgress((p) => Math.min(100, p + 10))}
                  className="px-2 py-0.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  +10%
                </button>
              </div>
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
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Scope & Notes
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Save Changes Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? "Saving..." : "Save Project Changes"}
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900">Delete Project?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900">&quot;{name}&quot;</strong>?
              This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
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
