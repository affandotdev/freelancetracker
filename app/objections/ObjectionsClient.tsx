"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { resolveObjectionAction } from "@/lib/actions";

export interface ObjectionData {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  raisedById: string;
  raisedByName: string;
  raisedByEmail: string;
  message: string;
  status: string; // Open | Resolved
  resolution?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

interface ObjectionsClientProps {
  objections: ObjectionData[];
}

export default function ObjectionsClient({ objections }: ObjectionsClientProps) {
  const [filter, setFilter] = useState<"All" | "Open" | "Resolved">("Open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = objections.filter((obj) => {
    if (filter === "All") return true;
    return obj.status === filter;
  });

  const openCount = objections.filter((o) => o.status === "Open").length;
  const resolvedCount = objections.filter((o) => o.status === "Resolved").length;

  const handleResolveSubmit = (e: React.FormEvent, objectionId: string) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("objectionId", objectionId);
    formData.append("resolution", resolutionText);

    startTransition(async () => {
      try {
        await resolveObjectionAction(formData);
        setResolvingId(null);
        setResolutionText("");
      } catch (err: any) {
        alert(err?.message || "Failed to resolve objection.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <BackButton fallbackHref="/" label="Back to Dashboard" />
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Objections & Blockers
          </h1>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-border">
            Inbox
          </span>
        </div>
        <p className="text-[13px] text-gray-500 mt-1">
          Review and resolve roadblocks, questions, and blockers raised by freelance workers.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Open roadblocks
          </p>
          <div className="text-2xl font-semibold text-signal-red tracking-tight tabular-nums">
            {openCount}
          </div>
          <p className="text-[12px] text-signal-red font-medium mt-1">
            Tasks currently paused or blocked
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Resolved issues
          </p>
          <div className="text-2xl font-semibold text-signal-green tracking-tight tabular-nums">
            {resolvedCount}
          </div>
          <p className="text-[12px] text-gray-400 mt-1">
            Past objections addressed
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Total objections
          </p>
          <div className="text-2xl font-semibold text-ink tracking-tight tabular-nums">
            {objections.length}
          </div>
          <p className="text-[12px] text-gray-400 mt-1">
            Lifetime team feedback
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1">
        {(["Open", "Resolved", "All"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
              filter === tab
                ? "bg-ink text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab === "Open" && `Open (${openCount})`}
            {tab === "Resolved" && `Resolved (${resolvedCount})`}
            {tab === "All" && `All (${objections.length})`}
          </button>
        ))}
      </div>

      {/* Objections List */}
      {filtered.length === 0 ? (
        <div className="bg-white p-8 border border-dashed border-border rounded-lg text-center space-y-1">
          <h3 className="text-[13px] font-medium text-ink">
            {filter === "Open"
              ? "No open blockers"
              : "No objections found in this view."}
          </h3>
          <p className="text-[12px] text-gray-400">
            Team is working smoothly without any active roadblocks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((obj) => {
            const isOpen = obj.status === "Open";

            return (
              <div
                key={obj.id}
                className="bg-white p-5 rounded-lg border border-border space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          isOpen
                            ? "bg-rose-50 text-signal-red border-rose-200"
                            : "bg-emerald-50 text-signal-green border-emerald-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOpen ? "bg-signal-red" : "bg-signal-green"
                          }`}
                        />
                        {isOpen ? "Open Blocker" : "Resolved"}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {obj.projectName}
                      </span>
                    </div>

                    <Link
                      href={`/tasks/${obj.taskId}`}
                      className="text-[14px] font-semibold text-ink hover:text-accent transition-colors block"
                    >
                      {obj.taskTitle} →
                    </Link>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[12px] font-medium text-gray-700 block">
                      Raised by {obj.raisedByName}
                    </span>
                    <span className="text-[11px] text-gray-400 tabular-nums">
                      {new Date(obj.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Blocker Message */}
                <div className="bg-surface p-3 rounded-md border border-border">
                  <span className="text-[11px] font-medium text-gray-400 block mb-0.5">
                    Worker&apos;s Message:
                  </span>
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {obj.message}
                  </p>
                </div>

                {/* Resolution note if already resolved */}
                {!isOpen && obj.resolution && (
                  <div className="bg-emerald-50 p-3 rounded-md border border-emerald-200 text-[12px] text-signal-green space-y-0.5">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Resolution Note:</span>
                      {obj.resolvedAt && (
                        <span className="text-[11px] text-gray-500 font-normal tabular-nums">
                          Resolved on {new Date(obj.resolvedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{obj.resolution}</p>
                  </div>
                )}

                {/* Super Admin Action: Resolve */}
                {isOpen && (
                  <div className="pt-1">
                    {resolvingId === obj.id ? (
                      <form
                        onSubmit={(e) => handleResolveSubmit(e, obj.id)}
                        className="bg-surface p-3.5 rounded-md border border-border space-y-2.5"
                      >
                        <label className="block text-[12px] font-medium text-gray-700">
                          Add Resolution Note (Shared with worker):
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="e.g. Sent client credentials via Slack. You are unblocked!"
                          className="w-full p-2 text-[13px] bg-white border border-border rounded-md focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingId(null);
                              setResolutionText("");
                            }}
                            className="px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isPending}
                            className="px-3.5 py-1 text-[12px] font-medium text-white bg-signal-green hover:bg-emerald-700 rounded transition-colors cursor-pointer"
                          >
                            {isPending ? "Resolving..." : "Mark as Resolved"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(obj.id);
                          setResolutionText("");
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-signal-green hover:bg-emerald-700 text-white text-[12px] font-medium rounded-md transition-colors cursor-pointer"
                      >
                        Resolve Objection
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
