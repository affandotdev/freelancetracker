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
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all"); // 'all' | 'unassigned' | memberId
  const [statusFilter, setStatusFilter] = useState<string>("all"); // 'all' | 'In Progress' | 'Overdue' | 'To Do' | 'Done' | 'Blocked'
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

    // Search query
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

    // Member filter
    if (selectedMemberId === "unassigned") {
      list = list.filter((t) => !t.assignedTo);
    } else if (selectedMemberId !== "all") {
      list = list.filter((t) => t.assignedTo?.id === selectedMemberId);
    }

    // Project filter
    if (selectedProjectId !== "all") {
      list = list.filter((t) => t.projectId === selectedProjectId);
    }

    // Status filter
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

  // Handle inline quick reassignment
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

  // Handle inline quick status update
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

  // Handle inline quick progress update
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
      {/* 1. Header & Quick KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>⚡ Assigned Works & Deliverables Monitor</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              {stats.total} total
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time control room to monitor worker deliverables, progress, deadlines, roadblocks, and reassign tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "cards" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ⊞ Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ☰ Table
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Works</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across all projects</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "In Progress" ? "all" : "In Progress")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "In Progress"
              ? "bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">In Progress</div>
          <div className="text-xl font-black text-blue-700 mt-0.5">{stats.inProgress}</div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">Currently active</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Overdue" ? "all" : "Overdue")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "Overdue"
              ? "bg-rose-50 border-rose-400 ring-2 ring-rose-500/20 shadow-2xs"
              : stats.overdue > 0
              ? "bg-rose-50/40 border-rose-200/80 hover:bg-rose-50"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Overdue</span>
            {stats.overdue > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          </div>
          <div className={`text-xl font-black mt-0.5 ${stats.overdue > 0 ? "text-rose-700" : "text-slate-900"}`}>
            {stats.overdue}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
            {stats.overdue > 0 ? "Needs deadline action" : "All on schedule"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Blocked" ? "all" : "Blocked")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "Blocked"
              ? "bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 shadow-2xs"
              : stats.withBlockers > 0
              ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Roadblocks</div>
          <div className={`text-xl font-black mt-0.5 ${stats.withBlockers > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {stats.withBlockers}
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">
            {stats.withBlockers > 0 ? "Open worker objections" : "Zero blockers"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "To Do" ? "all" : "To Do")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "To Do"
              ? "bg-slate-100 border-slate-300 ring-2 ring-slate-400/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To Do / Queued</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{stats.todo}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Pending start</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Done" ? "all" : "Done")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "Done"
              ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs"
              : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</div>
          <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.done}</div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">{stats.avgProgress}% Avg progress</div>
        </button>
      </div>

      {/* 2. LIVE WORKER WORKLOAD MONITOR (Clickable Avatar Bar) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>👥 Filter Workload by Assigned Member</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any teammate below to isolate and monitor only their assigned deliverables.
            </p>
          </div>
          {selectedMemberId !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedMemberId("all")}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 self-start sm:self-auto cursor-pointer"
            >
              Reset to All Workers ✕
            </button>
          )}
        </div>

        {/* Worker Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* All Workers Chip */}
          <button
            type="button"
            onClick={() => setSelectedMemberId("all")}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedMemberId === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>All Members</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedMemberId === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {tasks.length}
            </span>
          </button>

          {/* Individual Members */}
          {teamMembers.map((member) => {
            const isSelected = selectedMemberId === member.id;
            const load = memberWorkloads.map.get(member.id) || { total: 0, inProgress: 0, overdue: 0 };
            const initial = member.name.slice(0, 1).toUpperCase();

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={`px-3 py-1.5 rounded-2xl border text-xs transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "bg-blue-50 border-blue-400 text-blue-950 font-black ring-2 ring-blue-500/20 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-xl flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    isSelected ? "bg-blue-600 text-white" : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {initial}
                </div>
                <div className="text-left">
                  <span className="font-bold truncate">{member.name.split(" ")[0]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? "bg-blue-200 text-blue-900" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {load.total}
                  </span>
                  {load.overdue > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                      title={`${load.overdue} overdue task(s)`}
                    />
                  )}
                </div>
              </button>
            );
          })}

          {/* Unassigned Chip */}
          <button
            type="button"
            onClick={() => setSelectedMemberId("unassigned")}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedMemberId === "unassigned"
                ? "bg-amber-100 border-amber-400 text-amber-950 ring-2 ring-amber-500/20 shadow-2xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>⚠️ Unassigned</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900 font-bold">
              {memberWorkloads.unassignedCount}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, projects, workers..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
          <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Project Dropdown Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">📁 All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.client ? `(${p.client})` : ""}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 shrink-0 font-medium">
            Showing <strong>{filteredTasks.length}</strong> of {tasks.length}
          </span>
        </div>
      </div>

      {/* 4. MAIN DELIVERABLES MONITORING LIST */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
          <span className="text-3xl">🎯</span>
          <h4 className="text-sm font-bold text-slate-800">No deliverables match your filter</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try clearing search keywords or switching member/status filters to see all assigned works.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedMemberId("all");
              setStatusFilter("all");
              setSelectedProjectId("all");
            }}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Reset All Filters
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
                className={`bg-white p-5 rounded-3xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                  task.openObjectionsCount > 0
                    ? "border-amber-300 ring-2 ring-amber-400/20"
                    : duration.statusType === "overdue" && task.status !== "Done"
                    ? "border-rose-300 ring-2 ring-rose-400/20"
                    : "border-slate-200/90 hover:border-blue-300"
                }`}
              >
                {/* Card Top */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-blue-600 truncate block"
                      >
                        📁 {task.projectName}
                      </Link>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-sm font-extrabold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 block"
                      >
                        {task.title}
                      </Link>
                    </div>

                    {/* Status Pill with 1-click status cycle */}
                    <div className="shrink-0 flex items-center gap-1">
                      <select
                        value={task.status}
                        disabled={isPending}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-xl border cursor-pointer focus:outline-none ${
                          task.status === "Done"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : task.status === "In Progress"
                            ? "bg-blue-50 text-blue-800 border-blue-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-slate-50/60 p-2 rounded-xl">
                      {task.description}
                    </p>
                  )}

                  {/* Progress Slider / Quick Controls */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">Progress</span>
                      <span className="font-black text-blue-600">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          task.status === "Done"
                            ? "bg-emerald-500"
                            : task.progress > 60
                            ? "bg-blue-600"
                            : "bg-blue-400"
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    {/* Quick progress jump buttons for Super Admin */}
                    <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px]">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleProgressChange(task.id, p)}
                          className={`px-2 py-0.5 rounded-md border font-bold transition-colors cursor-pointer ${
                            task.progress === p
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Latest Worker Update Snippet (Monitoring transparency) */}
                  {task.latestUpdate && (
                    <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-blue-800 font-bold">
                        <span>💬 Latest Worker Update:</span>
                        <span className="text-[10px] text-blue-500 font-normal">
                          {new Date(task.latestUpdate.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-slate-700 italic line-clamp-2">"{task.latestUpdate.text}"</p>
                    </div>
                  )}

                  {/* Roadblocks Warning */}
                  {task.openObjectionsCount > 0 && (
                    <Link
                      href="/objections"
                      className="bg-amber-50 p-2 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-bold flex items-center justify-between hover:bg-amber-100 transition-colors block"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>{task.openObjectionsCount} Roadblock reported by worker</span>
                      </span>
                      <span>Review →</span>
                    </Link>
                  )}
                </div>

                {/* Card Bottom / Footer Actions */}
                <div className="pt-3 mt-3 border-t border-slate-100 space-y-2.5">
                  {/* Assignee Strip + Quick Reassign */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Worker:</span>
                      {task.assignedTo ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[10px]">
                            {task.assignedTo.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800 truncate">{task.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                          Unassigned
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setReassigningTaskId(isReassigning ? null : task.id)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {isReassigning ? "Cancel" : "Reassign ⇄"}
                    </button>
                  </div>

                  {/* Inline Reassignment Picker */}
                  {isReassigning && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-fade-in">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Transfer Deliverable To:
                      </label>
                      <select
                        defaultValue={task.assignedTo?.id || "unassigned"}
                        onChange={(e) => handleReassign(task.id, e.target.value)}
                        disabled={isPending}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="unassigned">-- Keep Unassigned --</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            👤 {m.name} ({m.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Card Meta & Bottom Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                    {/* Deadline urgency */}
                    {task.deadline ? (
                      <span
                        className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] flex items-center gap-1 ${
                          duration.statusType === "overdue" && task.status !== "Done"
                            ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
                            : duration.statusType === "today"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span>⏱️</span>
                        <span>{duration.label}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">No deadline</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBugTargetTask(task);
                          setBugModalOpen(true);
                        }}
                        className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Report bug against this deliverable"
                      >
                        <span>🐛</span>
                        <span>Report Bug</span>
                      </button>

                      <Link
                        href={`/tasks/${task.id}`}
                        className="px-2 py-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      >
                        Room →
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
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Deliverable & Project</th>
                  <th className="py-3.5 px-4">Assigned Worker</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Progress</th>
                  <th className="py-3.5 px-4">Deadline</th>
                  <th className="py-3.5 px-4">Blockers / Updates</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const duration = getProjectDuration(task.deadline, task.status);

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 space-y-0.5">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 block text-xs"
                        >
                          {task.title}
                        </Link>
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 block"
                        >
                          📁 {task.projectName}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={task.assignedTo?.id || "unassigned"}
                          onChange={(e) => handleReassign(task.id, e.target.value)}
                          disabled={isPending}
                          className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="unassigned">-- Unassigned --</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={task.status}
                          disabled={isPending}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border cursor-pointer ${
                            task.status === "Done"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : task.status === "In Progress"
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 text-[11px]">{task.progress}%</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {task.deadline ? (
                          <span
                            className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] ${
                              duration.statusType === "overdue" && task.status !== "Done"
                                ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {duration.label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">None</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {task.openObjectionsCount > 0 ? (
                          <Link
                            href="/objections"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                          >
                            <span>⚠️ {task.openObjectionsCount} roadblock</span>
                          </Link>
                        ) : task.latestUpdate ? (
                          <span className="text-[11px] text-slate-500 truncate max-w-[160px] block">
                            💬 "{task.latestUpdate.text}"
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setBugTargetTask(task);
                            setBugModalOpen(true);
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          🐛 Bug
                        </button>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                        >
                          View →
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
