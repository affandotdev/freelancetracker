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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Objections & Blockers Inbox
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Review and resolve roadblocks, questions, and blockers raised by your freelance workers.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Open Roadblocks
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {openCount}
          </div>
          <span className="text-[11px] text-slate-500">
            Tasks currently paused or blocked
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Resolved Issues
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {resolvedCount}
          </div>
          <span className="text-[11px] text-slate-500">
            Past objections addressed
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Objections
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {objections.length}
          </div>
          <span className="text-[11px] text-slate-500">
            Lifetime team feedback
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-2xl max-w-sm text-xs font-bold">
        <button
          type="button"
          onClick={() => setFilter("Open")}
          className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
            filter === "Open"
              ? "bg-white text-rose-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Open Blockers ({openCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("Resolved")}
          className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
            filter === "Resolved"
              ? "bg-white text-emerald-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Resolved ({resolvedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("All")}
          className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
            filter === "All"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All ({objections.length})
        </button>
      </div>

      {/* Objections List */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 border border-slate-200/80 rounded-3xl text-center space-y-2">
          <span className="text-3xl">🎉</span>
          <h3 className="text-sm font-bold text-slate-800">
            {filter === "Open"
              ? "No open blockers right now!"
              : "No objections found in this view."}
          </h3>
          <p className="text-xs text-slate-400">
            Your team is working smoothly without any active roadblocks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((obj) => {
            const isOpen = obj.status === "Open";

            return (
              <div
                key={obj.id}
                className={`bg-white p-6 rounded-2xl border transition-all shadow-2xs ${
                  isOpen
                    ? "border-rose-200/90 hover:border-rose-300"
                    : "border-slate-200/80"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isOpen
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOpen ? "⚠️ Open Blocker" : "✅ Resolved"}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        📁 {obj.projectName}
                      </span>
                    </div>

                    <Link
                      href={`/tasks/${obj.taskId}`}
                      className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                    >
                      {obj.taskTitle} →
                    </Link>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-slate-700 block">
                      Raised by {obj.raisedByName}
                    </span>
                    <span className="text-[11px] text-slate-400">
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
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Worker's Message:
                  </span>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {obj.message}
                  </p>
                </div>

                {/* Resolution note if already resolved */}
                {!isOpen && obj.resolution && (
                  <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800">
                        Resolution Note:
                      </span>
                      {obj.resolvedAt && (
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          Resolved on {new Date(obj.resolvedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{obj.resolution}</p>
                  </div>
                )}

                {/* Super Admin Action: Resolve */}
                {isOpen && (
                  <div className="pt-2">
                    {resolvingId === obj.id ? (
                      <form
                        onSubmit={(e) => handleResolveSubmit(e, obj.id)}
                        className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                      >
                        <label className="block text-xs font-bold text-slate-700">
                          Add Resolution Note (Shared with worker):
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="e.g. Sent client credentials via Slack. You are unblocked!"
                          className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingId(null);
                              setResolutionText("");
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isPending}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                      >
                        <span>✓ Resolve This Objection</span>
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
