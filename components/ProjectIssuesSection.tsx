"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { updateIssueStatusAction, deleteIssueAction } from "@/lib/actions";
import ReportBugModal from "./ReportBugModal";
import EditIssueModal from "./EditIssueModal";
import IssueAttachmentViewer from "./IssueAttachmentViewer";

export interface ProjectIssueItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string | null;
  path?: string | null;
  module?: string | null;
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
  const [editingIssue, setEditingIssue] = useState<ProjectIssueItem | null>(null);
  const [selectedMemberToReport, setSelectedMemberToReport] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());
  const [isTableMaximized, setIsTableMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");

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
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved" || i.status === "Closed").length;

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (statusFilter !== "ALL" && issue.status !== statusFilter) return false;
      if (moduleFilter !== "ALL" && (issue.module || "User Side") !== moduleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = issue.title.toLowerCase().includes(q);
        const descMatch = (issue.description || "").toLowerCase().includes(q);
        const pathMatch = (issue.path || "").toLowerCase().includes(q);
        const reporterMatch = issue.raisedBy.name.toLowerCase().includes(q);
        const assigneeMatch = (issue.assignedTo?.name || "").toLowerCase().includes(q);
        const moduleMatch = (issue.module || "").toLowerCase().includes(q);
        return titleMatch || descMatch || pathMatch || reporterMatch || assigneeMatch || moduleMatch;
      }
      return true;
    });
  }, [issues, statusFilter, moduleFilter, searchQuery]);

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case "Critical":
        return "bg-red-50 text-signal-red dark:bg-red-950/40 dark:text-rose-300 border-red-200 dark:border-red-800";
      case "High":
        return "bg-amber-50 text-signal-amber dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Medium":
        return "bg-blue-50 text-accent dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-surface text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-border dark:border-neutral-700";
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case "Open":
        return "bg-red-50 text-signal-red dark:bg-red-950/40 dark:text-rose-300 border-red-200 dark:border-red-800";
      case "In Progress":
        return "bg-blue-50 text-accent dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Resolved":
        return "bg-emerald-50 text-signal-green dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-surface text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-border dark:border-neutral-700";
    }
  };

  const getModuleBadgeClass = (m?: string | null) => {
    switch (m) {
      case "Admin Side":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "User Side":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Client Portal":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "API / Backend":
        return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
      case "Public / Landing":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-slate-300 border-slate-200 dark:border-neutral-700";
    }
  };

  return (
    <div
      className={`bg-white dark:bg-[#111111] p-6 sm:p-7 rounded-xl border border-border dark:border-[#262626] shadow-xs space-y-5 transition-all ${
        isTableMaximized
          ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-2xl shadow-2xl border border-border dark:border-[#262626] overflow-hidden flex flex-col"
          : ""
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink dark:text-white tracking-tight">
              Issues & Bug Tracker
            </h2>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-surface dark:bg-neutral-800 px-2 py-0.5 rounded-md border border-border dark:border-neutral-700 tabular-nums">
              {issues.length}
            </span>
            {openIssuesCount > 0 && (
              <span className="text-xs font-semibold text-signal-red dark:text-rose-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800 tabular-nums">
                {openIssuesCount} Open
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Log quality defects, assign them to members, specify route/module, and track resolution steps.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsTableMaximized(!isTableMaximized)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white bg-white dark:bg-neutral-800 hover:bg-surface dark:hover:bg-neutral-700 rounded-lg border border-border dark:border-neutral-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title={isTableMaximized ? "Exit Maximize" : "Maximize Table to full screen"}
          >
            <span>{isTableMaximized ? "🗗" : "⛶"}</span>
            <span>{isTableMaximized ? "Exit Fullscreen" : "Maximize Table"}</span>
          </button>

          <Link
            href="/issues"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-ink dark:hover:text-white bg-white dark:bg-neutral-800 hover:bg-surface dark:hover:bg-neutral-700 rounded-lg border border-border dark:border-neutral-700 transition-colors"
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
      {!isTableMaximized && assignableMembers.length > 0 && (
        <div className="bg-surface dark:bg-[#161616] p-3 rounded-xl border border-border dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-slate-600 dark:text-neutral-400 font-medium">
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
                className="px-2.5 py-1 bg-white dark:bg-[#202020] hover:bg-slate-100 dark:hover:bg-neutral-700 border border-border dark:border-neutral-700 rounded-lg text-xs font-medium text-ink dark:text-white transition-colors cursor-pointer"
              >
                {m.name} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/50 dark:bg-[#141414] p-2.5 rounded-xl border border-border dark:border-[#262626]">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search issues, path, module, member..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-[#0d0d0d] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-ink dark:hover:text-white cursor-pointer text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter pills */}
          <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-border dark:border-[#262626] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-white"
              }`}
            >
              All ({issues.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Open")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "Open"
                  ? "bg-red-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-signal-red"
              }`}
            >
              Open ({openIssuesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("In Progress")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "In Progress"
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-accent"
              }`}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Resolved")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === "Resolved"
                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-signal-green"
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          {/* Module selector */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#0a0a0a] border border-border dark:border-[#262626] rounded-lg font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
          >
            <option value="ALL">All Modules</option>
            <option value="Admin Side">Admin Side</option>
            <option value="User Side">User Side</option>
            <option value="Client Portal">Client Portal</option>
            <option value="API / Backend">API / Backend</option>
            <option value="Public / Landing">Public / Landing</option>
          </select>
        </div>
      </div>

      {/* Issues Table Container with Table-Only Scrolling & Sticky Actions */}
      {filteredIssues.length === 0 ? (
        <div className="p-8 border border-dashed border-border dark:border-neutral-800 rounded-xl text-center space-y-2 bg-surface/50 dark:bg-neutral-900/40">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {issues.length === 0
              ? "No bugs or defects reported on this project yet."
              : "No issues match your active search and filter criteria."}
          </p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {issues.length === 0
              ? 'Click "+ Report Bug" anytime an issue is discovered.'
              : "Try clearing search keywords or switching filters."}
          </p>
        </div>
      ) : (
        <div className={`flex flex-col ${isTableMaximized ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-2xl shadow-2xl border border-border dark:border-[#262626] overflow-hidden" : ""}`}>
          <div className={`overflow-y-auto overflow-x-hidden ${isTableMaximized ? "flex-1 min-h-0" : "min-h-[520px] max-h-[76vh]"}`}>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-surface/95 dark:bg-[#161616]/95 backdrop-blur border-b border-border dark:border-[#262626]">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  <th className="py-2.5 px-2 w-7 text-center">#</th>
                  <th className="py-2.5 px-2 w-28">Module</th>
                  <th className="py-2.5 px-2">Issue / Defect</th>
                  <th className="py-2.5 px-2 w-36">Route / Path</th>
                  <th className="py-2.5 px-1.5 w-20">Priority</th>
                  <th className="py-2.5 px-1.5 w-20">Status</th>
                  <th className="py-2.5 px-2 w-28">Assigned Member</th>
                  <th className="py-2.5 px-2 w-24">Reported By</th>
                  <th className="py-2.5 px-2 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 dark:divide-[#262626]/60">
                {filteredIssues.map((issue) => {
                  const isOpen = issue.status === "Open";
                  const isResolved = issue.status === "Resolved" || issue.status === "Closed";
                  const isExpanded = expandedIssueIds.has(issue.id);

                  return (
                    <React.Fragment key={issue.id}>
                      <tr
                        className={`hover:bg-surface/70 dark:hover:bg-neutral-800/50 transition-colors group ${
                          isExpanded ? "bg-surface/50 dark:bg-neutral-900/60" : ""
                        }`}
                      >
                        {/* Expand Icon */}
                        <td className="py-2.5 px-2 text-center text-slate-400 dark:text-neutral-500 font-medium tabular-nums">
                          <button
                            type="button"
                            onClick={() => toggleRowExpansion(issue.id)}
                            className="hover:text-ink dark:hover:text-white cursor-pointer p-0.5"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        </td>

                        {/* Module */}
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getModuleBadgeClass(
                              issue.module
                            )}`}
                          >
                            {issue.module === "Admin Side" && "🛡️"}
                            {issue.module === "User Side" && "👤"}
                            {issue.module === "Client Portal" && "🏢"}
                            {issue.module === "API / Backend" && "⚡"}
                            {issue.module === "Public / Landing" && "🌐"}
                            {!["Admin Side", "User Side", "Client Portal", "API / Backend", "Public / Landing"].includes(issue.module || "") && "📦"}
                            <span>{issue.module || "User Side"}</span>
                          </span>
                        </td>

                        {/* Title & snippet */}
                        <td className="py-2.5 px-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => toggleRowExpansion(issue.id)}
                                className="font-semibold text-ink dark:text-white hover:text-accent dark:hover:text-blue-400 transition-colors text-left"
                              >
                                {issue.title}
                              </button>
                            </div>
                            {issue.description && (
                              <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-1 max-w-md">
                                {issue.description}
                              </p>
                            )}
                            {(issue.attachmentUrl || issue.attachmentName) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-900">
                                <span>📎 Evidence</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Route / Path Column */}
                        <td className="py-2.5 px-2">
                          {issue.path ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-200 dark:border-neutral-700 truncate max-w-[130px] sm:max-w-[160px]"
                              title={`Route / Path: ${issue.path}`}
                            >
                              <span>📍</span>
                              <span className="truncate">{issue.path}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-neutral-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-2.5 px-1.5">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getPriorityBadgeClass(
                              issue.priority
                            )}`}
                          >
                            {issue.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-1.5">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getStatusBadgeClass(
                              issue.status
                            )}`}
                          >
                            {issue.status}
                          </span>
                        </td>

                        {/* Assigned Member */}
                        <td className="py-2.5 px-2">
                          <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[100px]">
                            {issue.assignedTo ? issue.assignedTo.name : <span className="text-slate-400 dark:text-neutral-500 italic">Unassigned</span>}
                          </span>
                        </td>

                        {/* Reported By & Date */}
                        <td className="py-2.5 px-2">
                          <span className="font-medium text-slate-700 dark:text-slate-300 block truncate max-w-[90px] sm:max-w-[100px]">
                            {issue.raisedBy.name}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums">
                            {new Date(issue.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingIssue(issue)}
                              title="Edit issue details"
                              className="px-2 py-0.5 bg-blue-50 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-neutral-700 text-accent dark:text-white border border-blue-200 dark:border-neutral-700 font-semibold rounded text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>

                            {isOpen && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "In Progress")}
                                className="px-2 py-0.5 bg-surface dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-accent dark:text-blue-300 border border-border dark:border-neutral-700 font-medium rounded text-[11px] transition-colors cursor-pointer"
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
                                className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-signal-green dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}

                            {isResolved && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUpdateStatus(issue.id, "Open")}
                                className="px-2 py-0.5 text-slate-600 dark:text-slate-300 hover:text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-neutral-800 border border-border dark:border-[#262626] rounded text-[11px] transition-colors cursor-pointer"
                              >
                                Reopen
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteIssue(issue.id)}
                              disabled={isPending}
                              title="Delete issue"
                              className="text-slate-400 hover:text-signal-red dark:hover:text-rose-400 p-1 transition-colors cursor-pointer text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-surface/70 dark:bg-[#161616] border-b border-border dark:border-[#262626]">
                          <td colSpan={9} className="p-4 sm:p-5">
                            <div className="space-y-4 max-w-4xl mx-auto bg-white dark:bg-[#111111] p-4 rounded-xl border border-border dark:border-[#262626]">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Target Module */}
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                    Target Module / Side
                                  </span>
                                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-surface dark:bg-[#161616] p-2.5 rounded-lg border border-border dark:border-[#262626] flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getModuleBadgeClass(
                                        issue.module
                                      )}`}
                                    >
                                      {issue.module || "User Side"}
                                    </span>
                                  </div>
                                </div>

                                {/* Route / Screen / File Path */}
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                    📍 Route / Screen / File Path
                                  </span>
                                  <div className="text-xs font-mono bg-surface dark:bg-[#161616] p-2.5 rounded-lg border border-border dark:border-[#262626] text-slate-800 dark:text-slate-200 font-semibold select-all truncate">
                                    {issue.path || "Not specified"}
                                  </div>
                                </div>
                              </div>

                              {/* Full description */}
                              {issue.description ? (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
                                    Description & Steps to Reproduce
                                  </span>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-surface dark:bg-[#161616] p-3 rounded-lg border border-border dark:border-[#262626]">
                                    {issue.description}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 dark:text-neutral-500 italic">No extra description provided.</p>
                              )}

                              {/* Evidence / Attachments */}
                              {(issue.attachmentUrl || issue.attachmentName) && (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
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
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-signal-green dark:text-emerald-300 space-y-0.5">
                                  <span className="font-semibold block">Resolution Note:</span>
                                  <p className="whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-200">{issue.resolution}</p>
                                </div>
                              )}

                              {/* Inline Resolve Box */}
                              {resolvingId === issue.id && (
                                <div className="bg-surface dark:bg-[#161616] p-3.5 rounded-xl border border-border dark:border-[#262626] space-y-2">
                                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Explain How This Bug Was Resolved:
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    placeholder="Explain how this bug was resolved..."
                                    className="w-full p-2.5 text-xs bg-white dark:bg-[#111111] border border-border dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-ink dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingId(null);
                                        setResolutionText("");
                                      }}
                                      className="px-3 py-1 text-xs text-slate-600 dark:text-neutral-400 bg-white dark:bg-[#202020] hover:bg-surface dark:hover:bg-neutral-700 border border-border dark:border-neutral-700 rounded-lg"
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

          {/* Table Summary Footer */}
          <div className="px-4 py-2.5 bg-surface/80 dark:bg-[#141414] border-t border-border dark:border-[#262626] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-ink dark:text-white">{filteredIssues.length}</strong> of{" "}
              <strong className="text-ink dark:text-white">{issues.length}</strong> issues
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-signal-red"></span>
                <span>{openIssuesCount} Open</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-signal-green"></span>
                <span>{resolvedCount} Resolved</span>
              </span>
            </div>
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
                path: created.path || null,
                module: created.module || "User Side",
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

      {/* Edit Issue Modal */}
      <EditIssueModal
        isOpen={Boolean(editingIssue)}
        onClose={() => setEditingIssue(null)}
        issue={editingIssue}
        projects={[{ id: projectId, name: projectName }]}
        teamMembers={teamMembers}
        isSuperAdmin={true}
        onSuccess={(updated) => {
          setIssues((prev) =>
            prev.map((i) =>
              i.id === updated.id
                ? {
                    ...i,
                    title: updated.title,
                    description: updated.description,
                    path: updated.path !== undefined ? updated.path : i.path,
                    module: updated.module !== undefined ? updated.module : i.module,
                    priority: updated.priority,
                    status: updated.status,
                    resolution: updated.resolution,
                    assignedTo: updated.assignedTo
                      ? {
                          id: updated.assignedTo.id,
                          name: updated.assignedTo.name,
                          email: updated.assignedTo.email,
                        }
                      : null,
                    resolvedAt: updated.resolvedAt
                      ? new Date(updated.resolvedAt).toISOString()
                      : null,
                  }
                : i
            )
          );
        }}
        onDelete={(deletedId) => {
          setIssues((prev) => prev.filter((i) => i.id !== deletedId));
        }}
      />
    </div>
  );
}
