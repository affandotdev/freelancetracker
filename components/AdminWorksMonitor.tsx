"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { updateTaskAction } from "@/lib/actions";
import { getProjectDuration } from "@/lib/dateUtils";
import ReportBugModal from "./ReportBugModal";

export interface TaskMonitoringItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  deadline: string | null;
  projectId: string;
  projectName: string;
  projectClient?: string | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
  openObjectionsCount: number;
  latestUpdate?: {
    id: string;
    text: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamMemberOption {
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

interface AdminWorksMonitorProps {
  initialTasks: TaskMonitoringItem[];
  teamMembers: TeamMemberOption[];
  projects: ProjectOption[];
}

export default function AdminWorksMonitor({
  initialTasks,
  teamMembers,
  projects,
}: AdminWorksMonitorProps) {
  const [tasks, setTasks] = useState<TaskMonitoringItem[]>(initialTasks);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Reassign modal/dropdown state
  const [reassigningTaskId, setReassigningTaskId] = useState<string | null>(null);

  // Bug reporting modal state
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [bugTargetTask, setBugTargetTask] = useState<TaskMonitoringItem | null>(null);

  // Compute Task KPIs
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const todo = tasks.filter((t) => t.status === "To Do" || t.status === "Todo").length;
    const done = tasks.filter((t) => t.status === "Done" || t.status === "Completed").length;
    const withBlockers = tasks.filter((t) => t.openObjectionsCount > 0).length;

    const overdue = tasks.filter((t) => {
      if (!t.deadline || t.status === "Done" || t.status === "Completed") return false;
      const d = getProjectDuration(t.deadline, t.status);
      return d.statusType === "overdue";
    }).length;

    const avgProgress =
      total > 0 ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / total) : 0;

    return { total, inProgress, todo, done, withBlockers, overdue, avgProgress };
  }, [tasks]);

  // Worker workload counts
  const memberWorkloads = useMemo(() => {
    const map = new Map<string, { total: number; inProgress: number; overdue: number }>();
    let unassignedCount = 0;

    tasks.forEach((t) => {
      if (!t.assignedTo) {
        unassignedCount++;
        return;
      }
      const existing = map.get(t.assignedTo.id) || { total: 0, inProgress: 0, overdue: 0 };
      existing.total++;
      if (t.status === "In Progress") existing.inProgress++;
      if (t.deadline && t.status !== "Done") {
        const d = getProjectDuration(t.deadline, t.status);
        if (d.statusType === "overdue") existing.overdue++;
      }
      map.set(t.assignedTo.id, existing);
    });

    return { map, unassignedCount };
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.projectName.toLowerCase().includes(q) ||
          (t.assignedTo && t.assignedTo.name.toLowerCase().includes(q))
      );
    }

    if (selectedMemberId === "unassigned") {
      list = list.filter((t) => !t.assignedTo);
    } else if (selectedMemberId !== "all") {
      list = list.filter((t) => t.assignedTo?.id === selectedMemberId);
    }

    if (selectedProjectId !== "all") {
      list = list.filter((t) => t.projectId === selectedProjectId);
    }

    if (statusFilter === "Overdue") {
      list = list.filter((t) => {
        if (!t.deadline || t.status === "Done") return false;
        const d = getProjectDuration(t.deadline, t.status);
        return d.statusType === "overdue";
      });
    } else if (statusFilter === "Blocked") {
      list = list.filter((t) => t.openObjectionsCount > 0 || t.status === "Blocked");
    } else if (statusFilter === "In Progress") {
      list = list.filter((t) => t.status === "In Progress");
    } else if (statusFilter === "To Do") {
      list = list.filter((t) => t.status === "To Do" || t.status === "Todo");
    } else if (statusFilter === "Done") {
      list = list.filter((t) => t.status === "Done" || t.status === "Completed");
    }

    return list;
  }, [tasks, searchQuery, selectedMemberId, selectedProjectId, statusFilter]);

  const handleReassign = (taskId: string, newMemberId: string) => {
    startTransition(async () => {
      try {
        const targetUserId = newMemberId === "unassigned" ? null : newMemberId;
        await updateTaskAction(taskId, { assignedToId: targetUserId });

        const newMember = teamMembers.find((m) => m.id === newMemberId) || null;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assignedTo: newMember
                    ? { id: newMember.id, name: newMember.name, email: newMember.email, role: newMember.role }
                    : null,
                }
              : t
          )
        );
        setReassigningTaskId(null);
      } catch (err: any) {
        alert(err?.message || "Failed to reassign task.");
      }
    });
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    startTransition(async () => {
      try {
        const newProgress = newStatus === "Done" ? 100 : newStatus === "To Do" ? 0 : undefined;
        await updateTaskAction(taskId, { status: newStatus, progress: newProgress });

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: newStatus,
                  progress: newProgress !== undefined ? newProgress : t.progress,
                }
              : t
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to update task status.");
      }
    });
  };

  const handleProgressChange = (taskId: string, newProgress: number) => {
    startTransition(async () => {
      try {
        const nextStatus = newProgress === 100 ? "Done" : newProgress > 0 ? "In Progress" : "To Do";
        await updateTaskAction(taskId, { progress: newProgress, status: nextStatus });

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress: newProgress,
                  status: nextStatus,
                }
              : t
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to update task progress.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-ink tracking-tight">
              Assigned Works & Deliverables
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-border">
              {stats.total} total
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-1">
            Real-time monitor for worker deliverables, progress, deadlines, roadblocks, and reassignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center p-0.5 bg-surface rounded-md border border-border text-[12px] font-medium">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === "cards" ? "bg-white text-ink shadow-xs" : "text-gray-500 hover:text-ink"
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === "table" ? "bg-white text-ink shadow-xs" : "text-gray-500 hover:text-ink"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
            statusFilter === "all"
              ? "bg-surface border-accent"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-medium text-gray-500">Total</div>
          <div className="text-xl font-semibold text-ink mt-0.5 tabular-nums">{stats.total}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Across projects</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "In Progress" ? "all" : "In Progress")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
            statusFilter === "In Progress"
              ? "bg-blue-50 border-accent"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-medium text-accent">In progress</div>
          <div className="text-xl font-semibold text-accent mt-0.5 tabular-nums">{stats.inProgress}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Currently active</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Overdue" ? "all" : "Overdue")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
            statusFilter === "Overdue"
              ? "bg-rose-50 border-rose-300"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-medium text-signal-red">Overdue</div>
          <div className={`text-xl font-semibold mt-0.5 tabular-nums ${stats.overdue > 0 ? "text-signal-red" : "text-ink"}`}>
            {stats.overdue}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {stats.overdue > 0 ? "Needs action" : "On schedule"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Blocked" ? "all" : "Blocked")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
            statusFilter === "Blocked"
              ? "bg-amber-50 border-amber-300"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-medium text-signal-amber">Roadblocks</div>
          <div className={`text-xl font-semibold mt-0.5 tabular-nums ${stats.withBlockers > 0 ? "text-signal-amber" : "text-ink"}`}>
            {stats.withBlockers}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {stats.withBlockers > 0 ? "Open objections" : "Zero blockers"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "To Do" ? "all" : "To Do")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
            statusFilter === "To Do"
              ? "bg-surface border-ink"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-medium text-gray-500">To do</div>
          <div className="text-xl font-semibold text-ink mt-0.5 tabular-nums">{stats.todo}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Pending start</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Done" ? "all" : "Done")}
          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
            statusFilter === "Done"
              ? "bg-emerald-50 border-emerald-300"
              : "bg-white border-border hover:bg-surface"
          }`}
        >
          <div className="text-[11px] font-medium text-signal-green">Completed</div>
          <div className="text-xl font-semibold text-signal-green mt-0.5 tabular-nums">{stats.done}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{stats.avgProgress}% avg progress</div>
        </button>
      </div>

      {/* 2. Worker Workload Chips */}
      <div className="bg-white p-4 rounded-lg border border-border space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-[12px] font-medium text-ink">
            Filter by Assigned Member
          </h3>
          {selectedMemberId !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedMemberId("all")}
              className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              Reset to all
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId("all")}
            className={`px-2.5 py-1 rounded-md border text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedMemberId === "all"
                ? "bg-ink text-white border-ink"
                : "bg-surface text-gray-700 border-border hover:bg-gray-100"
            }`}
          >
            <span>All Members</span>
            <span className="text-[10px] tabular-nums">({tasks.length})</span>
          </button>

          {teamMembers.map((member) => {
            const isSelected = selectedMemberId === member.id;
            const load = memberWorkloads.map.get(member.id) || { total: 0, inProgress: 0, overdue: 0 };

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={`px-2.5 py-1 rounded-md border text-[12px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-50 border-accent text-accent font-medium"
                    : "bg-white border-border text-gray-700 hover:bg-surface"
                }`}
              >
                <span>{member.name.split(" ")[0]}</span>
                <span className="text-[10px] tabular-nums text-gray-400">({load.total})</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedMemberId("unassigned")}
            className={`px-2.5 py-1 rounded-md border text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedMemberId === "unassigned"
                ? "bg-amber-50 border-amber-300 text-signal-amber"
                : "bg-surface text-gray-600 border-border hover:bg-gray-100"
            }`}
          >
            <span>Unassigned</span>
            <span className="text-[10px] tabular-nums">({memberWorkloads.unassignedCount})</span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, projects, workers..."
            className="w-full px-3 py-1.5 text-[12px] bg-white border border-border rounded-md focus:outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1 text-[12px] bg-white border border-border rounded-md font-medium text-gray-700 cursor-pointer focus:outline-none"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.client ? `(${p.client})` : ""}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
            {filteredTasks.length} of {tasks.length}
          </span>
        </div>
      </div>

      {/* 4. MAIN DELIVERABLES MONITORING LIST */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 bg-white rounded-lg border border-dashed border-border text-center space-y-2">
          <h4 className="text-[13px] font-medium text-ink">No deliverables match your filter</h4>
          <p className="text-[12px] text-gray-400 max-w-sm mx-auto">
            Try clearing search keywords or switching filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedMemberId("all");
              setStatusFilter("all");
              setSelectedProjectId("all");
            }}
            className="px-3 py-1 bg-surface hover:bg-gray-100 text-ink text-[12px] font-medium rounded-md border border-border transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* CARD MONITORING VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const duration = getProjectDuration(task.deadline, task.status);
            const isReassigning = reassigningTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`bg-white p-5 rounded-lg border transition-colors flex flex-col justify-between space-y-4 ${
                  task.openObjectionsCount > 0
                    ? "border-amber-300"
                    : duration.statusType === "overdue" && task.status !== "Done"
                    ? "border-rose-300"
                    : "border-border hover:border-gray-300"
                }`}
              >
                {/* Card Top */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-[11px] font-medium text-gray-400 hover:text-accent truncate block"
                      >
                        {task.projectName}
                      </Link>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-[14px] font-semibold text-ink hover:text-accent transition-colors line-clamp-1 block"
                      >
                        {task.title}
                      </Link>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      <select
                        value={task.status}
                        disabled={isPending}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded border cursor-pointer focus:outline-none ${
                          task.status === "Done"
                            ? "bg-emerald-50 text-signal-green border-emerald-200"
                            : task.status === "In Progress"
                            ? "bg-blue-50 text-accent border-blue-200"
                            : "bg-surface text-gray-700 border-border"
                        }`}
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-[12px] text-gray-600 line-clamp-2 leading-relaxed bg-surface p-2.5 rounded-md border border-border">
                      {task.description}
                    </p>
                  )}

                  {/* Progress Slider */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-semibold text-ink tabular-nums">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px]">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleProgressChange(task.id, p)}
                          className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer tabular-nums ${
                            task.progress === p
                              ? "bg-ink text-white border-ink font-medium"
                              : "bg-surface text-gray-600 border-border hover:bg-gray-100"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Latest Update */}
                  {task.latestUpdate && (
                    <div className="bg-surface p-2.5 rounded-md border border-border text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-gray-600 font-medium">
                        <span>Latest Update:</span>
                        <span className="text-[10px] text-gray-400 tabular-nums">
                          {new Date(task.latestUpdate.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 italic line-clamp-2">"{task.latestUpdate.text}"</p>
                    </div>
                  )}

                  {/* Roadblocks Warning */}
                  {task.openObjectionsCount > 0 && (
                    <Link
                      href="/objections"
                      className="bg-amber-50 p-2 rounded-md border border-amber-200 text-[11px] text-signal-amber font-medium flex items-center justify-between hover:bg-amber-100 transition-colors block"
                    >
                      <span>{task.openObjectionsCount} Roadblock reported</span>
                      <span>Review →</span>
                    </Link>
                  )}
                </div>

                {/* Card Bottom / Footer Actions */}
                <div className="pt-2.5 border-t border-border space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-gray-400 text-[11px]">Worker:</span>
                      {task.assignedTo ? (
                        <span className="font-medium text-ink truncate">{task.assignedTo.name}</span>
                      ) : (
                        <span className="text-signal-amber font-medium text-[11px]">
                          Unassigned
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setReassigningTaskId(isReassigning ? null : task.id)}
                      className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                    >
                      {isReassigning ? "Cancel" : "Reassign"}
                    </button>
                  </div>

                  {isReassigning && (
                    <div className="p-2 bg-surface rounded border border-border space-y-1">
                      <select
                        defaultValue={task.assignedTo?.id || "unassigned"}
                        onChange={(e) => handleReassign(task.id, e.target.value)}
                        disabled={isPending}
                        className="w-full px-2 py-1 text-[12px] bg-white border border-border rounded focus:outline-none cursor-pointer"
                      >
                        <option value="unassigned">-- Unassigned --</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                    {task.deadline ? (
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-medium tabular-nums ${
                          duration.statusType === "overdue" && task.status !== "Done"
                            ? "bg-rose-50 text-signal-red border-rose-200"
                            : duration.statusType === "today"
                            ? "bg-amber-50 text-signal-amber border-amber-200"
                            : "bg-surface text-gray-600 border-border"
                        }`}
                      >
                        {duration.label}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">No deadline</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setBugTargetTask(task);
                          setBugModalOpen(true);
                        }}
                        className="px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:text-signal-red bg-surface hover:bg-gray-100 border border-border rounded transition-colors cursor-pointer"
                      >
                        Report Bug
                      </button>

                      <Link
                        href={`/tasks/${task.id}`}
                        className="px-2 py-0.5 text-[11px] font-medium text-accent bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE MONITORING VIEW */
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse table-zebra">
              <thead>
                <tr className="bg-surface border-b border-border text-gray-500 font-medium text-[11px]">
                  <th className="py-2.5 px-4">Deliverable & Project</th>
                  <th className="py-2.5 px-4">Assigned Worker</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Progress</th>
                  <th className="py-2.5 px-4">Deadline</th>
                  <th className="py-2.5 px-4">Blockers / Updates</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((task) => {
                  const duration = getProjectDuration(task.deadline, task.status);

                  return (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 space-y-0.5">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-medium text-ink hover:text-accent block"
                        >
                          {task.title}
                        </Link>
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="text-[11px] text-gray-400 hover:underline block"
                        >
                          {task.projectName}
                        </Link>
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={task.assignedTo?.id || "unassigned"}
                          onChange={(e) => handleReassign(task.id, e.target.value)}
                          disabled={isPending}
                          className="px-2 py-0.5 text-[12px] bg-white border border-border rounded font-medium text-ink cursor-pointer focus:outline-none"
                        >
                          <option value="unassigned">-- Unassigned --</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={task.status}
                          disabled={isPending}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded border cursor-pointer ${
                            task.status === "Done"
                              ? "bg-emerald-50 text-signal-green border-emerald-200"
                              : task.status === "In Progress"
                              ? "bg-blue-50 text-accent border-blue-200"
                              : "bg-surface text-gray-700 border-border"
                          }`}
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 min-w-[110px]">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="text-gray-700 text-[11px] tabular-nums font-medium">{task.progress}%</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {task.deadline ? (
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-medium tabular-nums ${
                              duration.statusType === "overdue" && task.status !== "Done"
                                ? "bg-rose-50 text-signal-red border-rose-200"
                                : "bg-surface text-gray-600 border-border"
                            }`}
                          >
                            {duration.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {task.openObjectionsCount > 0 ? (
                          <Link
                            href="/objections"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-signal-amber bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                          >
                            {task.openObjectionsCount} roadblock
                          </Link>
                        ) : task.latestUpdate ? (
                          <span className="text-[11px] text-gray-500 truncate max-w-[160px] block">
                            "{task.latestUpdate.text}"
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setBugTargetTask(task);
                            setBugModalOpen(true);
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:text-signal-red bg-surface hover:bg-gray-100 border border-border rounded transition-colors cursor-pointer"
                        >
                          Bug
                        </button>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="px-2 py-0.5 text-[11px] font-medium text-accent bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report Bug Modal */}
      {bugModalOpen && (
        <ReportBugModal
          isOpen={bugModalOpen}
          onClose={() => {
            setBugModalOpen(false);
            setBugTargetTask(null);
          }}
          projects={projects}
          teamMembers={teamMembers}
          defaultProjectId={bugTargetTask?.projectId || ""}
          defaultAssignedToId={bugTargetTask?.assignedTo?.id || ""}
          defaultTitle={bugTargetTask ? `Defect on "${bugTargetTask.title}": ` : ""}
          onSuccess={() => {
            alert("Bug successfully reported!");
          }}
        />
      )}
    </div>
  );
}
