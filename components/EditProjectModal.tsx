"use client";

import React, { useState, useEffect } from "react";
import { updateProjectAction } from "@/lib/actions";
import { addDaysToDate, getDaysDifference } from "@/lib/dateUtils";

export interface EditableProjectData {
  id: string;
  name: string;
  client?: string | null;
  clientEmail?: string | null;
  category?: string | null;
  priority?: string;
  status: string;
  progress: number;
  totalAmount?: number;
  receivedAmount?: number;
  deadline?: string | null;
  description?: string | null;
}

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: EditableProjectData | null;
  onProjectUpdated?: (updatedProject: EditableProjectData) => void;
}

export default function EditProjectModal({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}: EditProjectModalProps) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [category, setCategory] = useState("Web Development");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("In Progress");
  const [progress, setProgress] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [durationDays, setDurationDays] = useState<string | number>("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setClient(project.client || "");
      setClientEmail(project.clientEmail || "");
      setCategory(project.category || "Web Development");
      setPriority(project.priority || "Medium");
      setStatus(project.status || "In Progress");
      setProgress(project.progress !== undefined ? project.progress : 0);
      setTotalAmount(project.totalAmount || 0);
      setReceivedAmount(project.receivedAmount || 0);
      const d = project.deadline ? project.deadline.split("T")[0] : "";
      setDeadline(d);
      setDescription(project.description || "");
      setError("");

      if (d) {
        const days = getDaysDifference(d);
        setDurationDays(days !== null && days >= 0 ? days : "");
      } else {
        setDurationDays("");
      }
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleDateChange = (val: string) => {
    setDeadline(val);
    if (!val) {
      setDurationDays("");
      return;
    }
    const days = getDaysDifference(val);
    if (days !== null && days >= 0) {
      setDurationDays(days);
    } else {
      setDurationDays("");
    }
  };

  const handleDaysChange = (val: string) => {
    setDurationDays(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setDeadline(addDaysToDate(num));
    } else if (val === "") {
      setDeadline("");
    }
  };

  const applyDaysPreset = (days: number) => {
    setDurationDays(days);
    setDeadline(addDaysToDate(days));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await updateProjectAction(project.id, {
        name: name.trim(),
        client: client.trim() || null,
        clientEmail: clientEmail.trim() || null,
        category,
        priority,
        status,
        progress,
        totalAmount,
        receivedAmount,
        deadline: deadline || null,
        description: description.trim() || null,
      });

      const updatedProjectObj: EditableProjectData = {
        ...project,
        name: name.trim(),
        client: client.trim() || null,
        clientEmail: clientEmail.trim() || null,
        category,
        priority,
        status,
        progress,
        totalAmount,
        receivedAmount,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        description: description.trim() || null,
      };

      if (onProjectUpdated) {
        onProjectUpdated(updatedProjectObj);
      }

      onClose();
    } catch (err: any) {
      console.error("Failed to update project:", err);
      setError(err?.message || "Failed to update project. Please try again.");
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
        className="bg-white rounded-xl shadow-2xl border border-border max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div>
            <h3 className="text-base font-bold text-ink">Edit Project Specifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update project scope, financials, schedule, and client contact details.
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-signal-red font-medium">
              {error}
            </div>
          )}

          {/* Project Title, Category, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Project Name <span className="text-signal-red">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer"
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
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer"
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
                Client Name / Organization
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. Acme Corp / Sarah Jenkins"
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium placeholder:text-slate-400"
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
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Status and Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Project Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value;
                  setStatus(s);
                  if (s === "Completed" && progress < 100) setProgress(100);
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink font-medium cursor-pointer"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Planning">Planning / Upcoming</option>
                <option value="Enquiry">Enquiry (Lead)</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Overall Completion
                </label>
                <span className="text-xs font-bold text-ink tabular-nums">{progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setProgress(p);
                  if (p === 100 && status !== "Completed") setStatus("Completed");
                }}
                className="w-full accent-accent cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Financials */}
          <div className="p-4 bg-surface rounded-lg border border-border space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Financial Terms (₹ INR)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Contract Value (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-semibold text-ink tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Received Cash Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-semibold text-signal-green tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Deadline & Duration Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Target Deadline & Duration
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
                  Clear Date
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1">
                  Calendar Date:
                </span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer font-medium tabular-nums"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1">
                  Duration (Days):
                </span>
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

            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mr-1">
                Presets:
              </span>
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
                  className="px-2 py-0.5 bg-surface hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded border border-border transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Project Description / Scope Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope details, deliverables list, or client requirements..."
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
              {isSaving ? "Saving..." : "Save Project Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
