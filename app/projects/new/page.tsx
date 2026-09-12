"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
      <div>
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          {isEnquiry
            ? "Record Project Enquiry"
            : isPlanning
            ? "Schedule Upcoming Project"
            : "Create New Project"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          {isEnquiry
            ? "Log a potential lead or client enquiry that has not yet been committed or onboarded."
            : isPlanning
            ? "Record a confirmed project with a fixed contract amount scheduled for kickoff."
            : "Fill in deliverable details, client contact, and financial milestones."}
        </p>
      </div>

      {/* Project Type Switcher */}
      <div className="flex p-1 bg-slate-200/70 rounded-2xl max-w-md gap-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setStatus("Not Started")}
          className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
            !isEnquiry && !isPlanning
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📦 Active Work
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("Planning");
            setProgress(0);
          }}
          className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
            isPlanning
              ? "bg-cyan-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          🗓️ Planning / Upcoming
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("Enquiry");
            setProgress(0);
            setReceivedAmount("");
          }}
          className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
            isEnquiry
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          💡 Enquiry / Lead
        </button>
      </div>

      {/* Form Card */}
      <form
        action={createProjectAction}
        className="bg-white p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-xs space-y-6"
      >
        {/* Project Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Project Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. E-Commerce Redesign & Stripe Integration"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Category
            </label>
            <select
              name="category"
              defaultValue="Web Development"
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
              Priority Level
            </label>
            <select
              name="priority"
              defaultValue="Medium"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent 🔥</option>
            </select>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Client / Company Name
            </label>
            <input
              type="text"
              name="client"
              placeholder="e.g. Acme Corporation"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Client Email (Optional)
            </label>
            <input
              type="email"
              name="clientEmail"
              placeholder="client@example.com"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Financials: Total & Received */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 bg-slate-50/70 p-4 rounded-2xl">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isEnquiry && (
              <p className="text-[11px] text-purple-600 mt-1">
                Potential project value quoted to the prospective client.
              </p>
            )}
            {isPlanning && (
              <p className="text-[11px] text-cyan-700 mt-1">
                Guaranteed fixed fee agreed with client for upcoming kickoff.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                  ? "e.g. 15000 (Advance paid)"
                  : "e.g. 20000"
              }
              value={receivedAmount}
              disabled={isEnquiry}
              onChange={(e) => setReceivedAmount(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isEnquiry ? "opacity-50 cursor-not-allowed bg-slate-100" : ""
              }`}
            />
            {isEnquiry && (
              <p className="text-[11px] text-slate-400 mt-1">
                Payments begin once the lead is onboarded into active work.
              </p>
            )}
            {isPlanning && (
              <p className="text-[11px] text-slate-500 mt-1">
                Any booking deposit or upfront token paid to reserve your schedule.
              </p>
            )}
          </div>
        </div>

        {/* Status & Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Status
            </label>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Planning">🗓️ Planning / Upcoming (Fixed Amount)</option>
              <option value="Enquiry">💡 Enquiry (Not Committed / Lead)</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                {isEnquiry
                  ? "Target Decision / Start Date"
                  : isPlanning
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
                  name="deadline"
                  value={deadline}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">Or Duration (Days from now):</span>
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
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-0.5">Quick Add:</span>
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

        {/* Work Progress Slider */}
        {!isEnquiry && !isPlanning && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Work Progress
              </label>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
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
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        )}
        {(isEnquiry || isPlanning) && (
          <input type="hidden" name="progress" value="0" />
        )}

        {/* Description / Deliverables */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            {isEnquiry
              ? "Enquiry Scope & Client Discussion Notes"
              : isPlanning
              ? "Planning Scope, Deliverable Milestones & Kickoff Requirements"
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
            className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <Link
            href="/"
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer ${
              isEnquiry
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/20 hover:shadow-lg"
                : isPlanning
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-cyan-500/20 hover:shadow-lg"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20 hover:shadow-lg"
            }`}
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
