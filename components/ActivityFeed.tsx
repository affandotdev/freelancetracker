import React from "react";
import Link from "next/link";

export interface ActivityItem {
  id: string;
  type: "update" | "objection" | "meeting";
  title: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  meetingId?: string;
  meetingTitle?: string;
  clientName?: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  createdAt: string;
  status?: string; // for objections: Open | Resolved; for meetings: Scheduled | Completed
  resolution?: string | null;
  outcome?: string | null;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="bg-white p-6 border border-border rounded-lg text-center shadow-xs">
        <p className="text-xs text-slate-400 font-medium">
          No team activity yet. Updates, meetings, and objections raised by team members will appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg divide-y divide-border overflow-hidden shadow-xs">
      <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Recent Team Activity & Client Updates
        </h2>
        <span className="text-[11px] font-medium text-slate-400 tabular-nums">
          Latest {activities.length} events
        </span>
      </div>

      <div className="divide-y divide-border max-h-[380px] overflow-y-auto">
        {activities.map((item) => (
          <div
            key={item.id}
            className="p-4 hover:bg-surface transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.type === "objection"
                      ? item.status === "Resolved"
                        ? "bg-signal-green"
                        : "bg-signal-red"
                      : item.type === "meeting"
                      ? "bg-purple-600"
                      : "bg-accent"
                  }`}
                />
                <span className="text-xs font-semibold text-ink truncate">
                  {item.authorName}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {item.type === "objection"
                    ? item.status === "Resolved"
                      ? "resolved an objection on"
                      : "raised an objection on"
                    : item.type === "meeting"
                    ? "logged client meeting notes on"
                    : "posted a task update on"}
                </span>
              </div>

              <span className="text-[11px] text-slate-400 shrink-0 font-medium tabular-nums">
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="pl-4">
              {item.type === "meeting" ? (
                <Link
                  href="/meetings"
                  className="text-xs font-medium text-accent hover:underline line-clamp-1"
                >
                  {item.meetingTitle} {item.clientName && `(Client: ${item.clientName})`}
                </Link>
              ) : item.taskId ? (
                <Link
                  href={`/tasks/${item.taskId}`}
                  className="text-xs font-medium text-accent hover:underline line-clamp-1"
                >
                  {item.taskTitle} {item.projectName && `(${item.projectName})`}
                </Link>
              ) : null}

              <p className="text-xs text-slate-600 mt-1 bg-surface p-2.5 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                {item.content}
              </p>

              {item.type === "meeting" && item.outcome && (
                <div className="mt-1 text-[11px] text-blue-800 bg-blue-50 p-2 rounded-lg border border-blue-200">
                  <span className="font-semibold">Outcome:</span> {item.outcome}
                </div>
              )}

              {item.type === "objection" && item.resolution && (
                <div className="mt-1 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <span className="font-semibold">Resolution:</span> {item.resolution}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
