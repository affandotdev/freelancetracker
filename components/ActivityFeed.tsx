import React from "react";
import Link from "next/link";

export interface ActivityItem {
  id: string;
  type: "update" | "objection";
  title: string;
  projectName?: string;
  taskId: string;
  taskTitle: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  createdAt: string;
  status?: string; // for objections: Open | Resolved
  resolution?: string | null;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="bg-white p-6 border border-slate-200/80 rounded-2xl text-center">
        <p className="text-xs text-slate-400 font-medium">
          No team activity yet. Updates and objections raised by team members will appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚡</span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Recent Team Activity
          </h2>
        </div>
        <span className="text-[10px] font-bold text-slate-400">
          Latest {activities.length} events
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
        {activities.map((item) => (
          <div
            key={item.id}
            className="p-4 hover:bg-slate-50/60 transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.type === "objection"
                      ? item.status === "Resolved"
                        ? "bg-emerald-500"
                        : "bg-rose-500 animate-ping"
                      : "bg-blue-500"
                  }`}
                />
                <span className="text-xs font-bold text-slate-800 truncate">
                  {item.authorName}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {item.type === "objection"
                    ? item.status === "Resolved"
                      ? "resolved an objection on"
                      : "raised an objection on"
                    : "posted a task update on"}
                </span>
              </div>

              <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="pl-4">
              <Link
                href={`/tasks/${item.taskId}`}
                className="text-xs font-semibold text-blue-600 hover:underline hover:text-blue-800 line-clamp-1"
              >
                {item.taskTitle} {item.projectName && `(${item.projectName})`}
              </Link>
              <p className="text-xs text-slate-600 mt-1 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100/80 whitespace-pre-wrap leading-relaxed">
                {item.content}
              </p>
              {item.type === "objection" && item.resolution && (
                <div className="mt-1 text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200/60">
                  <span className="font-bold">Resolution:</span> {item.resolution}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
