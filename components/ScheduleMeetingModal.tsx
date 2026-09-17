"use client";

import React, { useState, useEffect } from "react";
import { createMeetingAction } from "@/lib/actions";

interface TeamMember {
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

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: TeamMember[];
  projects: ProjectOption[];
  isSuperAdmin: boolean;
  currentUserId: string;
  preselectedProjectId?: string;
  defaultTitle?: string;
  defaultClientName?: string;
  defaultAssignedToId?: string;
  onMeetingCreated?: (meeting: any) => void;
}

const MEETING_TYPES = [
  "Client Meeting",
  "Discovery Call",
  "Requirement Gathering",
  "Progress Review",
  "Deliverable Walkthrough",
  "Follow-up Check-in",
  "Payment Follow-up",
  "General",
];

const PLATFORMS = [
  "Google Meet",
  "Zoom",
  "Microsoft Teams",
  "Phone Call",
  "In-Person",
  "Other",
];

export default function ScheduleMeetingModal({
  isOpen,
  onClose,
  teamMembers,
  projects,
  isSuperAdmin,
  currentUserId,
  preselectedProjectId = "",
  defaultTitle = "",
  defaultClientName = "",
  defaultAssignedToId = "",
  onMeetingCreated,
}: ScheduleMeetingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default scheduled time to tomorrow at 10:00 AM local
  const getDefaultScheduledAt = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Form state
  const [title, setTitle] = useState(defaultTitle);
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [projectId, setProjectId] = useState(preselectedProjectId);
  const [type, setType] = useState("Client Meeting");
  const [platform, setPlatform] = useState("Google Meet");
  const [meetingLink, setMeetingLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt());
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [assignedToId, setAssignedToId] = useState(
    defaultAssignedToId || (isSuperAdmin ? "" : currentUserId)
  );
  const [agenda, setAgenda] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setProjectId(preselectedProjectId);
      setScheduledAt(getDefaultScheduledAt());
      setMeetingLink("");
      setAgenda("");
      setError(null);
      setAssignedToId(defaultAssignedToId || (isSuperAdmin ? "" : currentUserId));

      if (defaultClientName) {
        setClientName(defaultClientName);
      } else if (preselectedProjectId) {
        const found = projects.find((p) => p.id === preselectedProjectId);
        if (found?.client) setClientName(found.client);
      } else {
        setClientName("");
      }
    }
  }, [isOpen, preselectedProjectId, defaultTitle, defaultClientName, defaultAssignedToId, isSuperAdmin, currentUserId, projects]);

  if (!isOpen) return null;

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setProjectId(pId);
    if (pId) {
      const selected = projects.find((p) => p.id === pId);
      if (selected && selected.client && !clientName) {
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
      if (clientEmail) formData.set("clientEmail", clientEmail);
      if (clientPhone) formData.set("clientPhone", clientPhone);
      if (projectId) formData.set("projectId", projectId);
      formData.set("type", type);
      formData.set("platform", platform);
      if (meetingLink) formData.set("meetingLink", meetingLink);
      formData.set("scheduledAt", scheduledAt);
      formData.set("durationMinutes", String(durationMinutes));
      if (agenda) formData.set("agenda", agenda);
      if (assignedToId) formData.set("assignedToId", assignedToId);

      const created = await createMeetingAction(formData);
      if (onMeetingCreated) {
        onMeetingCreated(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to schedule meeting.");
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
            <h2 className="text-base font-semibold text-ink">Schedule Client Meeting / Follow-up</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set up call details, assign team members, and prepare agenda.
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

          {/* Meeting Title & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Meeting Title <span className="text-signal-red">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scope Alignment & Demo Call"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Meeting Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Client Name <span className="text-signal-red">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp / Sarah"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Client Email (optional)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Client Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          {/* Project Link & Team Member Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Related Project
              </label>
              <select
                value={projectId}
                onChange={handleProjectChange}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                <option value="">-- No specific project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.client ? `(${p.client})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Assign Team Member
              </label>
              {isSuperAdmin ? (
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                >
                  <option value="">-- Unassigned --</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-surface/50 border border-border rounded-md text-sm text-gray-600">
                  Assigned to You
                </div>
              )}
            </div>
          </div>

          {/* Platform & Meeting Link */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Platform
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Meeting URL / Join Link
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          {/* Schedule Date/Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date & Time <span className="text-signal-red">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins (1 hr)</option>
                <option value={90}>90 mins (1.5 hrs)</option>
                <option value={120}>120 mins (2 hrs)</option>
              </select>
            </div>
          </div>

          {/* Agenda */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Agenda & Talking Points (optional)
            </label>
            <textarea
              rows={3}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="1. Review latest milestone design&#10;2. Clarify payment release date&#10;3. Finalize next sprint targets"
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
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
              {loading ? "Scheduling..." : "Schedule Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
