import React from "react";

interface TaskStatusBadgeProps {
  status: string;
  className?: string;
}

export default function TaskStatusBadge({
  status,
  className = "",
}: TaskStatusBadgeProps) {
  let badgeStyles = "bg-slate-100 text-slate-700 border-slate-200";
  let dotColor = "bg-slate-400";

  switch (status) {
    case "To Do":
      badgeStyles = "bg-slate-100 text-slate-700 border-slate-200/80";
      dotColor = "bg-slate-400";
      break;
    case "In Progress":
      badgeStyles = "bg-blue-50 text-blue-700 border-blue-200/80";
      dotColor = "bg-blue-500 animate-pulse";
      break;
    case "In Review":
      badgeStyles = "bg-purple-50 text-purple-700 border-purple-200/80";
      dotColor = "bg-purple-500";
      break;
    case "Done":
      badgeStyles = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      dotColor = "bg-emerald-500";
      break;
    case "Blocked":
      badgeStyles = "bg-rose-50 text-rose-700 border-rose-200/80 font-bold";
      dotColor = "bg-rose-500 animate-ping";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeStyles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
}
