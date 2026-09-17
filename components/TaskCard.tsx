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
  onReportBug?: (task: TaskCardData) => void;
  onLogMeeting?: (task: TaskCardData) => void;
  onEditTask?: (task: TaskCardData) => void;
}

export default function TaskCard({
  task,
  showProject = true,
  onReportBug,
  onLogMeeting,
  onEditTask,
}: TaskCardProps) {
  const duration = getProjectDuration(task.deadline, task.status);

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group block bg-white p-4 border border-border rounded-lg hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-0.5 min-w-0">
          {showProject && task.projectName && (
            <span className="text-[11px] font-medium text-gray-400 block truncate">
              {task.projectName}
            </span>
          )}
          <h3 className="text-[13px] font-medium text-ink group-hover:text-accent transition-colors line-clamp-1">
            {task.title}
          </h3>
        </div>
        <TaskStatusBadge status={task.status} className="shrink-0" />
      </div>

      {task.description && (
        <p className="text-[12px] text-gray-500 line-clamp-2 mb-2.5 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress Bar */}
      <div className="space-y-1 mb-2.5">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Progress</span>
          <span className="tabular-nums font-medium text-ink">{task.progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              task.status === "Done"
                ? "bg-signal-green"
                : task.status === "Blocked"
                ? "bg-signal-red"
                : "bg-accent"
            }`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* Meta Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border text-[12px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.assignedTo ? (
            <span className="text-[11px] text-gray-700 truncate">
              {task.assignedTo.name}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 italic">Unassigned</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onEditTask && (
            <button
              type="button"
              title="Edit task details, progress, or status"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditTask(task);
              }}
              className="px-2 py-0.5 text-[11px] font-medium text-accent hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}

          {onLogMeeting && (
            <button
              type="button"
              title="Log client meeting or discussion update for this task"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLogMeeting(task);
              }}
              className="px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition-colors cursor-pointer"
            >
              Log Call
            </button>
          )}

          {onReportBug && (
            <button
              type="button"
              title="Report issue against this task"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReportBug(task);
              }}
              className="px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:text-signal-red bg-surface hover:bg-gray-100 border border-border rounded transition-colors cursor-pointer"
            >
              Report
            </button>
          )}

          {task.openObjectionsCount && task.openObjectionsCount > 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-50 text-signal-red text-[10px] font-medium border border-rose-200">
              {task.openObjectionsCount} blocker{task.openObjectionsCount > 1 ? "s" : ""}
            </span>
          ) : null}

          {task.deadline && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border tabular-nums ${
                duration.statusType === "overdue"
                  ? "bg-rose-50 text-signal-red border-rose-200"
                  : duration.statusType === "today"
                  ? "bg-amber-50 text-signal-amber border-amber-200"
                  : "bg-surface text-gray-600 border-border"
              }`}
            >
              {duration.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
