import React from "react";

interface TaskStatusBadgeProps {
  status: string;
  className?: string;
}

export default function TaskStatusBadge({
  status,
  className = "",
}: TaskStatusBadgeProps) {
  let badgeStyles = "bg-gray-50 text-gray-700 border-border";
  let dotColor = "bg-gray-400";

  switch (status) {
    case "To Do":
    case "Todo":
      badgeStyles = "bg-gray-50 text-gray-700 border-border";
      dotColor = "bg-gray-400";
      break;
    case "In Progress":
      badgeStyles = "bg-blue-50 text-accent border-blue-200";
      dotColor = "bg-accent";
      break;
    case "In Review":
      badgeStyles = "bg-purple-50 text-purple-700 border-purple-200";
      dotColor = "bg-purple-600";
      break;
    case "Done":
    case "Completed":
      badgeStyles = "bg-emerald-50 text-signal-green border-emerald-200";
      dotColor = "bg-signal-green";
      break;
    case "Blocked":
      badgeStyles = "bg-rose-50 text-signal-red border-rose-200";
      dotColor = "bg-signal-red";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badgeStyles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
}
