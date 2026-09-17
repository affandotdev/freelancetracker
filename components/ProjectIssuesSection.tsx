"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { updateIssueStatusAction, deleteIssueAction } from "@/lib/actions";
import ReportBugModal from "./ReportBugModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";

export interface ProjectIssueItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  resolution?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
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

  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  const assignableMembers = teamMembers.filter(
    (m) =>
      !m.name.toLowerCase().includes("super admin") &&
      !m.email.toLowerCase().includes("admin@")
  );

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const toggleRowExpansion = (id: string) => {
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
        return "bg-red-50 text-signal-red border-red-200";
      case "High":
        return "bg-amber-50 text-signal-amber border-amber-200";
      case "Medium":
        return "bg-blue-50 text-accent border-blue-200";
      default:
        return "bg-surface text-slate-700 border-border";
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case "Open":
        return "bg-red-50 text-signal-red border-red-200";
      case "In Progress":
        return "bg-blue-50 text-accent border-blue-200";
      case "Resolved":
        return "bg-emerald-50 text-signal-green border-emerald-200";
      default:
        return "bg-surface text-slate-700 border-border";
    }
  };

  return (
    <div className="bg-white p-6 sm:p-7 rounded-lg border border-border shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink tracking-tight">
              Issues & Bug Tracker
            </h2>
            <span className="text-xs font-semibold text-slate-600 bg-surface px-2 py-0.5 rounded border border-border tabular-nums">
              {issues.length}
            </span>
            {openIssuesCount > 0 && (
              <span className="text-xs font-semibold text-signal-red bg-red-50 px-2 py-0.5 rounded border border-red-200 tabular-nums">
                {openIssuesCount} Open
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Log quality defects, assign them to members, and track resolution steps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/issues"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-ink bg-white hover:bg-surface rounded-lg border border-border transition-colors"
          >
            All Issues
          </Link>
          <button
            type="button"
            onClick={() => {
              setSelectedMemberToReport(undefined);
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            + Report Bug
          </button>
        </div>
      </div>

      {/* Quick Bug Report Against Teammates */}
      {assignableMembers.length > 0 && (
        <div className="bg-surface p-3 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-slate-600 font-medium">
            Quick report against:
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {assignableMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMemberToReport(m.id);
                  setIsModalOpen(true);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-border rounded text-xs font-medium text-ink transition-colors cursor-pointer"
              >
                {m.name} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Issues Table */}
      {issues.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-lg text-center space-y-1 bg-surface/50">
          <p className="text-xs font-semibold text-slate-700">No bugs or defects reported on this project yet.</p>
          <p className="text-xs text-slate-500">Click &quot;+ Report Bug&quot; anytime an issue is discovered.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface border-b border-border text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4 min-w-[220px]">Issue / Defect</th>
                  <th className="py-3 px-4 w-28">Priority</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 min-w-[140px]">Assigned Member</th>
                  <th className="py-3 px-4 min-w-[130px]">Reported By</th>
                  <th className="py-3 px-4 min-w-[140px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {issues.map((issue) => {
                  const isOpen = issue.status === "Open";
                  const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                  const isExpanded = expandedIssueIds.has(issue.id);

                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        className={`hover:bg-surface/70 transition-colors group ${
                          isExpanded ? "bg-surface/50" : ""
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium tabular-nums">
                          <button
                            type="button"
                            onClick={() => toggleRowExpansion(issue.id)}
                            className="hover:text-ink cursor-pointer p-0.5"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        </td>

                        {/* Title & snippet */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(issue.id)}
                              className="font-semibold text-ink hover:text-accent transition-colors text-left block"
                            >
                              {issue.title}
                            </button>
                            {issue.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 max-w-md">
                                {issue.description}
                              </p>
                            )}
                            {(issue.attachmentUrl || issue.attachmentName) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                <span>Evidence attached</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                              issue.priority
                            )}`}
                          >
                            {issue.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeClass(
                              issue.status
                            )}`}
                          >
                            {issue.status}
                          </span>
                        </td>

                        {/* Assigned Member */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-800">
                            {issue.assignedTo ? issue.assignedTo.name : <span className="text-slate-400 italic">Unassigned</span>}
                          </span>
                        </td>

                        {/* Reported By & Date */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-700 block truncate">
                            {issue.raisedBy.name}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {new Date(issue.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOpen && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                className="px-2 py-1 bg-surface hover:bg-slate-100 text-accent border border-border font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Start
                              </button>
                            )}

                            {!isResolved && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  toggleRowExpansion(issue.id);
                                  setResolvingId(issue.id);
                                  setResolutionText("");
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-signal-green border border-emerald-200 font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteIssue(issue.id)}
                              disabled={isPending}
                              title="Delete issue"
                              className="text-slate-400 hover:text-signal-red p-1 transition-colors cursor-pointer text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-surface/70 border-b border-border">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="space-y-4 max-w-4xl mx-auto bg-white p-4 rounded-lg border border-border">
                              {/* Full description */}
                              {issue.description ? (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Description & Steps to Reproduce
                                  </span>
                                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-surface p-3 rounded-md border border-border">
                                    {issue.description}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No extra description provided.</p>
                              )}

                              {/* Evidence / Attachments */}
                              {(issue.attachmentUrl || issue.attachmentName) && (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Attached Screenshot / Screen Recording
                                  </span>
                                  <IssueAttachmentViewer
                                    attachmentUrl={issue.attachmentUrl}
                                    attachmentName={issue.attachmentName}
                                    attachmentType={issue.attachmentType}
                                    compact
                                  />
                                </div>
                              )}

                              {/* Resolution Note if resolved */}
                              {issue.resolution && (
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-signal-green space-y-0.5">
                                  <span className="font-semibold block">Resolution Note:</span>
                                  <p className="whitespace-pre-wrap leading-relaxed text-emerald-950">{issue.resolution}</p>
                                </div>
                              )}

                              {/* Inline Resolve Box */}
                              {resolvingId === issue.id && (
                                <div className="bg-surface p-3.5 rounded-lg border border-border space-y-2">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    Explain How This Bug Was Resolved:
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    placeholder="Explain how this bug was resolved..."
                                    className="w-full p-2.5 text-xs bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink placeholder:text-slate-400"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingId(null);
                                        setResolutionText("");
                                      }}
                                      className="px-3 py-1 text-xs text-slate-600 bg-white hover:bg-surface border border-border rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isPending || !resolutionText.trim()}
                                      onClick={() => handleUpdateStatus(issue.id, "Resolved", resolutionText)}
                                      className="px-3.5 py-1 bg-signal-green hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                                    >
                                      Confirm Resolution
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        teamMembers={assignableMembers}
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
