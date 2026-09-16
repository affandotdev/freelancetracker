"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { updateIssueStatusAction, deleteIssueAction } from "@/lib/actions";
import ReportBugModal from "@/components/ReportBugModal";

export interface ProjectIssueItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  raisedBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ProjectIssuesSectionProps {
  projectId: string;
  projectName: string;
  initialIssues?: ProjectIssueItem[];
  teamMembers?: { id: string; name: string; email: string }[];
}

export default function ProjectIssuesSection({
  projectId,
  projectName,
  initialIssues = [],
  teamMembers = [],
}: ProjectIssuesSectionProps) {
  const [issues, setIssues] = useState<ProjectIssueItem[]>(initialIssues);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberToReport, setSelectedMemberToReport] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  // Inline resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const handleUpdateStatus = (issueId: string, status: string, resolution?: string) => {
    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("status", status);
    if (resolution !== undefined) {
      formData.append("resolution", resolution);
    }

    startTransition(async () => {
      try {
        await updateIssueStatusAction(formData);
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issueId
              ? {
                  ...i,
                  status,
                  resolution: resolution !== undefined ? resolution : i.resolution,
                  resolvedAt: status === "Resolved" || status === "Closed" ? new Date().toISOString() : null,
                }
              : i
          )
        );
        setResolvingId(null);
        setResolutionText("");
      } catch (err: any) {
        alert(err?.message || "Failed to update status.");
      }
    });
  };

  const handleDeleteIssue = (issueId: string) => {
    if (!confirm("Are you sure you want to delete this issue?")) return;

    startTransition(async () => {
      try {
        await deleteIssueAction(issueId);
        setIssues((prev) => prev.filter((i) => i.id !== issueId));
      } catch (err: any) {
        alert(err?.message || "Failed to delete issue.");
      }
    });
  };

  const openIssuesCount = issues.filter((i) => i.status === "Open").length;

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Medium":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case "Open":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "In Progress":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🐛 Issues & Bug Tracker</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {issues.length}
            </span>
            {openIssuesCount > 0 && (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                {openIssuesCount} Open
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log quality defects, assign them to members, and track resolution steps on this project.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/issues"
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            View All Issues ↗
          </Link>
          <button
            type="button"
            onClick={() => {
              setSelectedMemberToReport(undefined);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer"
          >
            <span>🐛 + Report Bug</span>
          </button>
        </div>
      </div>

      {/* Quick Bug Report Against Teammates */}
      {teamMembers.length > 0 && (
        <div className="bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>⚡ Quick Bug Report Against Teammates:</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Click any teammate below to immediately report a defect on this project against them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {teamMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMemberToReport(m.id);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-bold text-slate-700 hover:text-rose-700 shadow-2xs transition-all cursor-pointer group"
                title={`Report bug against ${m.name}`}
              >
                <div className="w-5 h-5 rounded-md bg-indigo-100 group-hover:bg-rose-100 text-indigo-700 group-hover:text-rose-700 flex items-center justify-center text-[10px] font-black">
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <span>{m.name.split(" ")[0]}</span>
                <span className="text-[10px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  🐛
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Issues List */}
      {issues.length === 0 ? (
        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
          <span className="text-2xl">✨</span>
          <p className="text-xs font-bold text-slate-700">No bugs or defects reported on this project yet.</p>
          <p className="text-xs text-slate-400">Click "+ Report Bug" anytime an issue is discovered.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const isOpen = issue.status === "Open";
            const isInProgress = issue.status === "In Progress";
            const isResolved = issue.status === "Resolved" || issue.status === "Closed";

            return (
              <div
                key={issue.id}
                className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2.5 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(
                        issue.priority
                      )}`}
                    >
                      {issue.priority} Priority
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                        issue.status
                      )}`}
                    >
                      {issue.status}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{issue.title}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    <span>
                      {new Date(issue.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteIssue(issue.id)}
                      disabled={isPending}
                      title="Delete issue"
                      className="p-1 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {issue.description && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed bg-white/70 p-2.5 rounded-xl border border-slate-100">
                    {issue.description}
                  </p>
                )}

                {issue.resolution && (
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                    <span className="font-bold block">✓ Resolution:</span>
                    <p className="whitespace-pre-wrap">{issue.resolution}</p>
                  </div>
                )}

                {/* Inline Resolve Box */}
                {resolvingId === issue.id && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <textarea
                      rows={2}
                      required
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Explain how this bug was resolved..."
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setResolutionText("");
                        }}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !resolutionText.trim()}
                        onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        Confirm Resolution
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div className="flex items-center gap-3 text-slate-500">
                    <span>
                      Raised by: <strong className="text-slate-700">{issue.raisedBy.name}</strong>
                    </span>
                    <span>
                      Assigned to:{" "}
                      <strong className="text-slate-700">
                        {issue.assignedTo ? issue.assignedTo.name : "Unassigned"}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOpen && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                        className="px-2.5 py-0.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Start Work →
                      </button>
                    )}
                    {!isResolved && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setResolvingId(issue.id);
                          setResolutionText("");
                        }}
                        className="px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                      >
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Visual Report Bug Modal */}
      <ReportBugModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMemberToReport(undefined);
        }}
        projects={[{ id: projectId, name: projectName }]}
        teamMembers={teamMembers}
        defaultProjectId={projectId}
        defaultAssignedToId={selectedMemberToReport || ""}
        onSuccess={(created) => {
          if (created) {
            const assignedMember = teamMembers.find((m) => m.id === created.assignedToId) || null;
            setIssues((prev) => [
              {
                id: created.id,
                projectId: created.projectId,
                projectName,
                title: created.title,
                description: created.description,
                priority: created.priority,
                status: created.status,
                resolution: created.resolution,
                createdAt: new Date(created.createdAt).toISOString(),
                updatedAt: new Date(created.updatedAt).toISOString(),
                resolvedAt: created.resolvedAt ? new Date(created.resolvedAt).toISOString() : null,
                raisedBy: {
                  id: created.raisedBy?.id || "",
                  name: created.raisedBy?.name || "Member",
                  email: created.raisedBy?.email || "",
                },
                assignedTo: assignedMember
                  ? { id: assignedMember.id, name: assignedMember.name, email: assignedMember.email }
                  : created.assignedTo
                  ? { id: created.assignedTo.id, name: created.assignedTo.name, email: created.assignedTo.email }
                  : null,
              },
              ...prev,
            ]);
          }
        }}
      />
    </div>
  );
}
