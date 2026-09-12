export type DurationStatusType =
  | "overdue"
  | "today"
  | "urgent"
  | "normal"
  | "planning"
  | "completed"
  | "none";

export interface DurationInfo {
  days: number;
  label: string;
  statusType: DurationStatusType;
}

/**
 * Calculates days remaining from today to the project deadline.
 * Fully hydration-safe: passes `mounted` flag or returns neutral SSR fallback.
 */
export function getProjectDuration(
  deadlineStr: string | null | undefined,
  status: string,
  mounted: boolean = true
): DurationInfo {
  if (status === "Completed") {
    return { days: 0, label: "Completed", statusType: "completed" };
  }

  if (!deadlineStr) {
    return { days: 0, label: "No deadline", statusType: "none" };
  }

  // SSR hydration safeguard: provide neutral text during SSR
  if (!mounted) {
    return { days: 0, label: "Calculating...", statusType: "normal" };
  }

  const isPlanning = status === "Planning" || status === "Upcoming";

  // Parse target date and current local date
  const target = new Date(deadlineStr);
  const now = new Date();

  // Normalize both dates to midnight UTC to compare complete calendar days
  const targetMidnight = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const nowMidnight = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const diffMs = targetMidnight - nowMidnight;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      days: diffDays,
      label: overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`,
      statusType: isPlanning ? "urgent" : "overdue",
    };
  }

  if (diffDays === 0) {
    return {
      days: 0,
      label: isPlanning ? "Kickoff today" : "Due today",
      statusType: "today",
    };
  }

  if (diffDays === 1) {
    return {
      days: 1,
      label: isPlanning ? "Starts tomorrow" : "1 day left",
      statusType: isPlanning ? "planning" : "urgent",
    };
  }

  if (isPlanning) {
    return {
      days: diffDays,
      label: `Starts in ${diffDays} days`,
      statusType: "planning",
    };
  }

  if (diffDays <= 3) {
    return {
      days: diffDays,
      label: `${diffDays} days left`,
      statusType: "urgent",
    };
  }

  return {
    days: diffDays,
    label: `${diffDays} days left`,
    statusType: "normal",
  };
}

/**
 * Returns a clean formatted date string (e.g. "Apr 15, 2026")
 */
export function formatDeadlineDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "No date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Calculates a YYYY-MM-DD date string by adding a number of days to today (or to a base date).
 */
export function addDaysToDate(days: number, fromDate?: string | null): string {
  const base = fromDate ? new Date(fromDate + "T00:00:00") : new Date();
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the number of calendar days from today to a target date string (YYYY-MM-DD).
 */
export function getDaysDifference(targetDateStr: string | null | undefined): number | null {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr.split("T")[0] + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

