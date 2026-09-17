"use client";

import { useState } from "react";
import { addMeetingFollowUpAction } from "@/lib/actions";

interface Meeting {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  type: string;
  platform: string;
  meetingLink?: string | null;
  scheduledAt: string | Date;
  durationMinutes: number;
  status: string;
  agenda?: string | null;
  notes?: string | null;
  actionItems?: string | null;
  outcome?: string | null;
  nextFollowUpDate?: string | Date | null;
  project?: {
    id: string;
    name: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface LogMeetingFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  onSaved?: (updatedMeeting: any) => void;
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

export default function LogMeetingFollowUpModal({
  isOpen,
  onClose,
  meeting,
  onSaved,
}: LogMeetingFollowUpModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState(meeting?.notes || "");
  const [outcome, setOutcome] = useState(meeting?.outcome || "Positive - Approved");
  const [actionItems, setActionItems] = useState(meeting?.actionItems || "");
  
  const getInitialFollowUpDate = () => {
    if (meeting?.nextFollowUpDate) {
      const d = new Date(meeting.nextFollowUpDate);
      return d.toISOString().slice(0, 10);
    }
    return "";
  };

  const [nextFollowUpDate, setNextFollowUpDate] = useState(getInitialFollowUpDate());
  const [markCompleted, setMarkCompleted] = useState(meeting?.status !== "Completed");

  if (!isOpen || !meeting) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("meetingId", meeting.id);
      if (notes) formData.set("notes", notes);
      if (outcome) formData.set("outcome", outcome);
      if (actionItems) formData.set("actionItems", actionItems);
      if (nextFollowUpDate) formData.set("nextFollowUpDate", nextFollowUpDate);
      formData.set("markCompleted", String(markCompleted));

      const updated = await addMeetingFollowUpAction(formData);
      if (onSaved) {
        onSaved(updated);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save meeting follow-up.");
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-accent border border-accent/20">
                {meeting.type}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(meeting.scheduledAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <h2 className="text-base font-semibold text-ink mt-1">
              Log Follow-up & Outcomes: {meeting.title}
            </h2>
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

          {/* Quick Context Strip */}
          <div className="p-3 bg-surface border border-border rounded-lg text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
            <div>
              <span className="text-gray-400 block text-[11px]">Client</span>
              <span className="font-medium text-ink">{meeting.clientName}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Project</span>
              <span className="font-medium text-ink">
                {meeting.project?.name || "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Platform</span>
              <span className="font-medium text-ink">{meeting.platform}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Assigned Member</span>
              <span className="font-medium text-ink">
                {meeting.assignedTo?.name || "Unassigned"}
              </span>
            </div>
          </div>

          {meeting.agenda && (
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-md text-xs text-gray-700">
              <span className="font-semibold text-accent block mb-1">Agenda / Talking Points:</span>
              <p className="whitespace-pre-line">{meeting.agenda}</p>
            </div>
          )}

          {/* Outcome Picker */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Meeting Outcome
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

          {/* Meeting Notes / Discussion Points */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Discussion Summary & Client Feedback <span className="text-signal-red">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summary of what the client said, feedback on deliverables, approvals given, or roadblocks discussed..."
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Action Items */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Action Items & Next Steps
            </label>
            <textarea
              rows={3}
              value={actionItems}
              onChange={(e) => setActionItems(e.target.value)}
              placeholder="- Update checkout button color by tomorrow&#10;- Send revised quotation by Friday&#10;- Schedule milestone 2 demo"
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Next Follow-up Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Next Follow-up / Check-in Date (optional)
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={markCompleted}
                  onChange={(e) => setMarkCompleted(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                />
                Mark meeting as Completed
              </label>
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
              {loading ? "Saving..." : "Save Follow-up & Notes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
