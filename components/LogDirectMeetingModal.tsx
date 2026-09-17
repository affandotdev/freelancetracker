"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createDirectMeetingUpdateAction } from "@/lib/actions";
import SearchableSelect from "./SearchableSelect";

interface ProjectOption {
  id: string;
  name: string;
  client?: string | null;
}

interface LogDirectMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  defaultProjectId?: string;
  defaultClientName?: string;
  defaultClientEmail?: string;
  defaultClientPhone?: string;
  defaultTitle?: string;
  defaultAssignedToId?: string;
  onMeetingLogged?: (meeting: any) => void;
}

const OUTCOMES = [
  "Positive - Approved",
  "Revisions Requested",
  "Follow-up Required",
  "Decision Pending",
  "Deal Closed",
  "Payment Promised",
  "No Show",
  "Other",
];

const PLATFORMS = [
  "Phone Call",
  "Google Meet",
  "Zoom",
  "WhatsApp Call",
  "In-Person",
  "Microsoft Teams",
  "Other",
];

export default function LogDirectMeetingModal({
  isOpen,
  onClose,
  projects,
  defaultProjectId = "",
  defaultClientName = "",
  defaultClientEmail = "",
  defaultClientPhone = "",
  defaultTitle = "Ad-hoc Client Meeting",
  defaultAssignedToId = "",
  onMeetingLogged,
}: LogDirectMeetingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNowLocalISO = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState(defaultTitle);
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientPhone, setClientPhone] = useState(defaultClientPhone);
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [assignedToId, setAssignedToId] = useState(defaultAssignedToId);
  const [platform, setPlatform] = useState("Phone Call");
  const [conductedAt, setConductedAt] = useState(getNowLocalISO());
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("Positive - Approved");
  const [actionItems, setActionItems] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");

  // Sync defaults when modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setProjectId(defaultProjectId);
      setAssignedToId(defaultAssignedToId);
      setConductedAt(getNowLocalISO());
      setNotes("");
      setActionItems("");
      setNextFollowUpDate("");
      setError(null);

      if (defaultClientName) {
        setClientName(defaultClientName);
      } else if (defaultProjectId) {
        const found = projects.find((p) => p.id === defaultProjectId);
        if (found?.client) setClientName(found.client);
      } else {
        setClientName("");
      }

      setClientEmail(defaultClientEmail);
      setClientPhone(defaultClientPhone);
    }
  }, [isOpen, defaultProjectId, defaultClientName, defaultClientEmail, defaultClientPhone, defaultTitle, defaultAssignedToId, projects]);

  const projectOptions = useMemo(() => {
    return projects.map((p) => ({
      value: p.id,
      label: p.name,
      subLabel: p.client ? `Client: ${p.client}` : undefined,
    }));
  }, [projects]);

  if (!isOpen) return null;

  const handleProjectSelect = (pId: string) => {
    setProjectId(pId);
    if (pId) {
      const selected = projects.find((p) => p.id === pId);
      if (selected?.client && !clientName) {
        setClientName(selected.client);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("clientName", clientName);
      if (clientPhone) formData.set("clientPhone", clientPhone);
      if (clientEmail) formData.set("clientEmail", clientEmail);
      if (projectId) formData.set("projectId", projectId);
      formData.set("platform", platform);
      formData.set("conductedAt", conductedAt);
      formData.set("durationMinutes", String(durationMinutes));
      formData.set("notes", notes);
      formData.set("outcome", outcome);
      if (actionItems) formData.set("actionItems", actionItems);
      if (nextFollowUpDate) formData.set("nextFollowUpDate", nextFollowUpDate);
      if (assignedToId) formData.set("assignedToId", assignedToId);

      const logged = await createDirectMeetingUpdateAction(formData);
      if (onMeetingLogged) {
        onMeetingLogged(logged);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to log meeting update.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface/50">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Log Direct / Unscheduled Meeting Update
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Quickly record client calls, WhatsApp discussions, or offline meetings not previously scheduled.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-ink text-lg leading-none p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-signal-red/10 border border-signal-red/20 rounded-md text-xs text-signal-red">
              {error}
            </div>
          )}

          {/* Client Name & Project Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Client Name <span className="text-signal-red">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp / Alex"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Related Project (optional)
              </label>
              <SearchableSelect
                value={projectId}
                onChange={handleProjectSelect}
                options={projectOptions}
                placeholder="-- General / No Project --"
                searchPlaceholder="Search projects..."
                allowClear
                emptyMessage="No matching projects"
              />
            </div>
          </div>

          {/* Title & Platform */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Meeting Title / Topic <span className="text-signal-red">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scope Alignment & Demo Review"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Platform / Medium
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conducted Date & Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date & Time Conducted
              </label>
              <input
                type="datetime-local"
                value={conductedAt}
                onChange={(e) => setConductedAt(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Outcome / Decision
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Discussion Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Discussion Summary & Client Feedback <span className="text-signal-red">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did the client say? What was agreed upon? Any roadblocks or approvals?"
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Action Items & Next Follow-up Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action Items (optional)
              </label>
              <textarea
                rows={2}
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="- Send updated mockups by tomorrow&#10;- Deploy patch to staging"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Target Next Follow-up Date (optional)
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-ink hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? "Logging Update..." : "Post Meeting Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
