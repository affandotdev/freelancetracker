"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { createProjectAction } from "@/lib/actions";
import {
  getProjectDuration,
  formatDeadlineDate,
  addDaysToDate,
  getDaysDifference,
} from "@/lib/dateUtils";

export default function NewProjectPage() {
  const [status, setStatus] = useState("Not Started");
  const [progress, setProgress] = useState(0);
  const [totalAmount, setTotalAmount] = useState<number | string>("");
  const [receivedAmount, setReceivedAmount] = useState<number | string>("");
  const [deadline, setDeadline] = useState("");
  const [durationDays, setDurationDays] = useState<string>("");
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const isEnquiry = status === "Enquiry";
  const isPlanning = status === "Planning";
  const duration = getProjectDuration(deadline, status, mounted);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <BackButton fallbackHref="/" label="Back to Dashboard" />
        <h1 className="text-2xl font-bold text-ink tracking-tight mt-1">
          {isEnquiry
            ? "Record Project Enquiry"
            : isPlanning
            ? "Schedule Upcoming Project"
            : "Create New Project"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEnquiry
            ? "Log a potential lead or client enquiry that has not yet been committed or onboarded."
            : isPlanning
            ? "Record a confirmed project with a fixed contract amount scheduled for kickoff."
            : "Fill in deliverable details, client contact, and financial milestones."}
        </p>
      </div>

      {/* Project Type Switcher */}
      <div className="flex p-1 bg-surface border border-border rounded-lg max-w-md gap-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setStatus("Not Started")}
          className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
            !isEnquiry && !isPlanning
              ? "bg-white text-ink shadow-xs border border-border/80 font-semibold"
              : "text-slate-600 hover:text-ink"
          }`}
        >
          Active Work
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("Planning");
            setProgress(0);
          }}
          className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
            isPlanning
              ? "bg-white text-ink shadow-xs border border-border/80 font-semibold"
              : "text-slate-600 hover:text-ink"
          }`}
        >
          Planning / Upcoming
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("Enquiry");
            setProgress(0);
            setReceivedAmount("");
          }}
          className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer text-center ${
            isEnquiry
              ? "bg-white text-ink shadow-xs border border-border/80 font-semibold"
              : "text-slate-600 hover:text-ink"
          }`}
        >
          Enquiry / Lead
        </button>
      </div>

      {/* Form Card */}
      <form
        action={createProjectAction}
        className="bg-white p-6 sm:p-7 border border-border rounded-lg shadow-xs space-y-6"
      >
        {/* Project Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Project Title <span className="text-signal-red">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. E-Commerce Redesign & Stripe Integration"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Category
            </label>
            <select
              name="category"
              defaultValue="Web Development"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer"
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
              Priority Level
            </label>
            <select
              name="priority"
              defaultValue="Medium"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client / Company Name
            </label>
            <input
              type="text"
              name="client"
              placeholder="e.g. Acme Corporation"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client Email (Optional)
            </label>
            <input
              type="email"
              name="clientEmail"
              placeholder="client@example.com"
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>🌐</span>
                <span>Project Link / Live URL / Figma / Repo</span>
              </label>
              <span className="text-[10px] text-slate-400">Visible to team members</span>
            </div>
            <div className="relative">
              <input
                type="text"
                name="projectUrl"
                placeholder="https://myclient.com, https://figma.com/..., or github.com/..."
                className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400 pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                🔗
              </span>
            </div>
          </div>
        </div>

        {/* Financials: Total & Received */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border bg-surface p-4 rounded-lg border">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isEnquiry
                ? "Estimated / Quoted Budget (₹)"
                : isPlanning
                ? "Fixed Agreed Contract Amount (₹)"
                : "Total Contract Amount (₹)"}
            </label>
            <input
              type="number"
              name="totalAmount"
              min="0"
              step="1"
              placeholder="e.g. 50000"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink tabular-nums placeholder:text-slate-400"
            />
            {isEnquiry && (
              <p className="text-[11px] text-slate-500 mt-1">
                Potential project value quoted to the prospective client.
              </p>
            )}
            {isPlanning && (
              <p className="text-[11px] text-slate-500 mt-1">
                Guaranteed fixed fee agreed with client for upcoming kickoff.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isPlanning ? "Advance / Deposit Received (₹)" : "Received Amount (₹)"}
            </label>
            <input
              type="number"
              name="receivedAmount"
              min="0"
              step="1"
              placeholder={
                isEnquiry
                  ? "0 (Not onboarded)"
                  : isPlanning
                  ? "e.g. 15000"
                  : "e.g. 20000"
              }
              value={receivedAmount}
              disabled={isEnquiry}
              onChange={(e) => setReceivedAmount(e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink tabular-nums placeholder:text-slate-400 ${
                isEnquiry ? "opacity-60 cursor-not-allowed bg-slate-100" : ""
              }`}
            />
            {isEnquiry && (
              <p className="text-[11px] text-slate-400 mt-1">
                Payments begin once the lead is onboarded into active work.
              </p>
            )}
            {isPlanning && (
              <p className="text-[11px] text-slate-500 mt-1">
                Any booking deposit or upfront token paid to reserve schedule.
              </p>
            )}
          </div>
        </div>

        {/* Status & Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status
            </label>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink cursor-pointer"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Planning">Planning / Upcoming (Fixed Amount)</option>
              <option value="Enquiry">Enquiry (Not Committed / Lead)</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                {isEnquiry
                  ? "Target Decision / Start Date"
                  : isPlanning
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
                  name="deadline"
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
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {formatDeadlineDate(deadline)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Work Progress Slider */}
        {!isEnquiry && !isPlanning && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Work Progress
              </label>
              <span className="text-xs font-semibold text-accent tabular-nums bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {progress}%
              </span>
            </div>
            <input
              type="range"
              name="progress"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>
        )}
        {(isEnquiry || isPlanning) && (
          <input type="hidden" name="progress" value="0" />
        )}

        {/* Description / Deliverables */}
        <div className="pt-4 border-t border-border">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {isEnquiry
              ? "Enquiry Scope & Client Discussion Notes"
              : isPlanning
              ? "Planning Scope & Kickoff Requirements"
              : "Project Description & Scope"}
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder={
              isEnquiry
                ? "Notes on what the client inquired about, proposals sent, follow-up dates..."
                : isPlanning
                ? "Key deliverables agreed, fixed payment milestones, advance terms, kickoff checklist..."
                : "Add key deliverable milestones, notes, or client specifications..."
            }
            className="w-full p-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none text-ink placeholder:text-slate-400"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
          <Link
            href="/"
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-border hover:bg-surface rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {isEnquiry
              ? "Record Enquiry Lead"
              : isPlanning
              ? "Schedule Upcoming Project"
              : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
