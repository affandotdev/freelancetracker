import React from "react";
import Link from "next/link";
import TaskStatusBadge from "./TaskStatusBadge";
import { getProjectDuration } from "@/lib/dateUtils";

export interface TaskCardData {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  deadline?: string | null;
  projectId?: string;
  projectName?: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  openObjectionsCount?: number;
  updatesCount?: number;
}

interface TaskCardProps {
  task: TaskCardData;
  showProject?: boolean;
}

export default function TaskCard({ task, showProject = true }: TaskCardProps) {
  const duration = getProjectDuration(task.deadline, task.status);

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group block bg-white p-5 border border-slate-200/90 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="space-y-1 min-w-0">
          {showProject && task.projectName && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
              📁 {task.projectName}
            </span>
          )}
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {task.title}
          </h3>
        </div>
        <TaskStatusBadge status={task.status} className="shrink-0" />
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress Bar */}
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-[10px] font-bold text-slate-500">
          <span>Progress</span>
          <span className="text-blue-600">{task.progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              task.status === "Done"
                ? "bg-emerald-500"
                : task.status === "Blocked"
                ? "bg-rose-500"
                : "bg-gradient-to-r from-blue-500 to-indigo-600"
            }`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* Meta Footer: Assignee, Deadline & Objections */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.assignedTo ? (
            <div className="flex items-center gap-1.5 text-slate-600 truncate">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {task.assignedTo.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-[11px] font-semibold truncate">
                {task.assignedTo.name}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Unassigned</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {task.openObjectionsCount && task.openObjectionsCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
              ⚠️ {task.openObjectionsCount} blocker{task.openObjectionsCount > 1 ? "s" : ""}
            </span>
          ) : null}

          {task.deadline && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                duration.statusType === "overdue"
                  ? "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                  : duration.statusType === "today"
                  ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                  : duration.statusType === "urgent"
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              ⏱️ {duration.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
