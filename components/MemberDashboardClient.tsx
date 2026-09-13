"use client";

import React, { useState } from "react";
import TaskCard, { TaskCardData } from "./TaskCard";

interface MemberDashboardClientProps {
  memberName: string;
  tasks: TaskCardData[];
}

export default function MemberDashboardClient({
  memberName,
  tasks,
}: MemberDashboardClientProps) {
  const [filter, setFilter] = useState<string>("All");

  const todoTasks = tasks.filter((t) => t.status === "To Do");
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress");
  const inReviewTasks = tasks.filter((t) => t.status === "In Review");
  const doneTasks = tasks.filter((t) => t.status === "Done");
  const blockedTasks = tasks.filter((t) => t.status === "Blocked");

  const filteredTasks = tasks.filter((t) => {
    if (filter === "All") return true;
    return t.status === filter;
  });

  const totalTasks = tasks.length;
  const completedTasks = doneTasks.length;
  const activeTasks = totalTasks - completedTasks;
  const totalBlockers = tasks.reduce(
    (acc, t) => acc + (t.openObjectionsCount || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white p-6 sm:p-8 rounded-3xl shadow-md shadow-blue-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
            Worker Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {memberName}!
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl">
            Here are the deliverables and tasks assigned to you. Click any task to update progress, post work logs, or raise an objection.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center shrink-0 min-w-[140px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
            Overall Completion
          </span>
          <span className="text-2xl font-black">
            {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
          </span>
          <span className="text-[10px] text-blue-100 block">
            {completedTasks} of {totalTasks} tasks done
          </span>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Assigned Tasks
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalTasks}
          </div>
          <span className="text-[11px] text-slate-500">Total assigned to you</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            In Progress
          </span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {inProgressTasks.length}
          </div>
          <span className="text-[11px] text-slate-500">Actively underway</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Roadblocks
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {blockedTasks.length}
          </div>
          <span className="text-[11px] text-slate-500">
            {totalBlockers} open objection{totalBlockers !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Completed
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {completedTasks}
          </div>
          <span className="text-[11px] text-slate-500">Successfully shipped</span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl max-w-xl text-xs font-bold flex-wrap">
        {[
          { key: "All", label: `All (${totalTasks})` },
          { key: "To Do", label: `To Do (${todoTasks.length})` },
          { key: "In Progress", label: `In Progress (${inProgressTasks.length})` },
          { key: "In Review", label: `In Review (${inReviewTasks.length})` },
          { key: "Done", label: `Done (${doneTasks.length})` },
          { key: "Blocked", label: `Blocked (${blockedTasks.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filter === tab.key
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white p-12 border border-slate-200/80 rounded-3xl text-center space-y-2 shadow-2xs">
          <span className="text-3xl">☕</span>
          <h3 className="text-sm font-bold text-slate-800">
            {filter === "All"
              ? "You have no assigned tasks yet."
              : `No tasks found with status "${filter}".`}
          </h3>
          <p className="text-xs text-slate-400">
            Your team lead will assign deliverables to you as project milestones are defined.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} showProject={true} />
          ))}
        </div>
      )}
    </div>
  );
}
