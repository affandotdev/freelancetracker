"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { deleteProjectAction, updateProjectAction } from "@/lib/actions";
import {
  getProjectDuration,
  formatDeadlineDate,
  DurationInfo,
} from "@/lib/dateUtils";

interface Project {
  id: string;
  name: string;
  client: string | null;
  clientEmail: string | null;
  category: string | null;
  priority: string;
  status: string;
  progress: number;
  totalAmount: number;
  receivedAmount: number;
  deadline: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentCount?: number;
}

import ActivityFeed, { ActivityItem } from "./ActivityFeed";
import AdminWorksMonitor, { TaskMonitoringItem } from "./AdminWorksMonitor";
import AdminBugsMonitor, { IssueMonitoringItem } from "./AdminBugsMonitor";
import AdminMeetingsMonitor, { MeetingMonitoringItem } from "./AdminMeetingsMonitor";

export interface TeamStats {
  totalMembers: number;
  openObjections: number;
  tasksInProgress: number;
  tasksOverdue: number;
}

interface DashboardClientProps {
  initialProjects: Project[];
  teamStats?: TeamStats;
  recentActivity?: ActivityItem[];
  allTasks?: TaskMonitoringItem[];
  allIssues?: IssueMonitoringItem[];
  allMeetings?: MeetingMonitoringItem[];
  teamMembers?: { id: string; name: string; email: string; role?: string }[];
}

type ViewMode = "grid" | "kanban" | "table";

export default function DashboardClient({
  initialProjects,
  teamStats,
  recentActivity = [],
  allTasks = [],
  allIssues = [],
  allMeetings = [],
  teamMembers = [],
}: DashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<"projects" | "works" | "bugs" | "meetings">("projects");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updated-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Deletion modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("workplan_view_mode") as ViewMode | null;
    if (saved && (saved === "grid" || saved === "kanban" || saved === "table")) {
      setViewMode(saved);
    }
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("workplan_view_mode", mode);
    }
  };

  // Financial & Pipeline Calculations
  const totalRevenue = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [projects]);

  const totalReceived = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.receivedAmount || 0), 0);
  }, [projects]);

  const totalPending = useMemo(() => {
    return Math.max(0, totalRevenue - totalReceived);
  }, [totalRevenue, totalReceived]);

  const collectionRate = useMemo(() => {
    return totalRevenue > 0 ? Math.round((totalReceived / totalRevenue) * 100) : 0;
  }, [totalRevenue, totalReceived]);

  // Counts by status
  const activeCount = useMemo(() => {
    return projects.filter((p) => p.status === "In Progress").length;
  }, [projects]);

  const upcomingCount = useMemo(() => {
    return projects.filter((p) => p.status === "Planning" || p.status === "Upcoming").length;
  }, [projects]);

  const enquiryCount = useMemo(() => {
    return projects.filter((p) => p.status === "Enquiry" || p.status === "Enquired").length;
  }, [projects]);

  const completedCount = useMemo(() => {
    return projects.filter((p) => p.status === "Completed").length;
  }, [projects]);

  const overdueCount = useMemo(() => {
    if (!mounted) return 0;
    return projects.filter((p) => {
      if (!p.deadline || p.status === "Completed") return false;
      const duration = getProjectDuration(p.deadline, p.status, mounted);
      return duration.statusType === "overdue";
    }).length;
  }, [projects, mounted]);

  const dueSoonCount = useMemo(() => {
    if (!mounted) return 0;
    return projects.filter((p) => {
      if (!p.deadline || p.status === "Completed") return false;
      const duration = getProjectDuration(p.deadline, p.status, mounted);
      return duration.statusType === "urgent" || duration.statusType === "today";
    }).length;
  }, [projects, mounted]);

  const criticalBugsCount = useMemo(() => {
    return allIssues.filter(
      (i) => i.priority === "Critical" && i.status !== "Resolved" && i.status !== "Closed"
    ).length;
  }, [allIssues]);

  const tasksOverdueCount = useMemo(() => {
    if (!mounted) return 0;
    return allTasks.filter((t) => {
      if (!t.deadline || t.status === "Done" || t.status === "Completed") return false;
      const d = getProjectDuration(t.deadline, t.status, mounted);
      return d.statusType === "overdue";
    }).length;
  }, [allTasks, mounted]);

  // Filtering & Sorting
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.client && p.client.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    if (activeTab !== "all") {
      if (activeTab === "Enquiry") {
        list = list.filter((p) => p.status === "Enquiry" || p.status === "Enquired");
      } else if (activeTab === "Planning") {
        list = list.filter((p) => p.status === "Planning" || p.status === "Upcoming");
      } else {
        list = list.filter((p) => p.status === activeTab);
      }
    }

    if (paymentFilter !== "All") {
      list = list.filter((p) => {
        const total = p.totalAmount || 0;
        const rec = p.receivedAmount || 0;
        if (paymentFilter === "Paid") return total > 0 && rec >= total;
        if (paymentFilter === "Partially Paid") return rec > 0 && rec < total;
        if (paymentFilter === "Unpaid") return total > 0 && rec === 0;
        return true;
      });
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case "amount-desc":
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case "progress-desc":
          return b.progress - a.progress;
        case "deadline-asc": {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return list;
  }, [projects, searchQuery, activeTab, paymentFilter, sortBy]);

  // Quick inline status advance
  const handleQuickStatusChange = async (projectId: string, newStatus: string) => {
    setUpdatingId(projectId);
    try {
      const nextProgress = newStatus === "Completed" ? 100 : undefined;
      await updateProjectAction(projectId, {
        status: newStatus,
        progress: nextProgress,
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                status: newStatus,
                progress: nextProgress !== undefined ? nextProgress : p.progress,
              }
            : p
        )
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);

    try {
      await deleteProjectAction(projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "CL";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (name: string | null) => {
    const colors = [
      "bg-blue-100 text-blue-700",
      "bg-purple-100 text-purple-700",
      "bg-emerald-100 text-emerald-700",
      "bg-amber-100 text-amber-700",
      "bg-rose-100 text-rose-700",
      "bg-cyan-100 text-cyan-700",
      "bg-indigo-100 text-indigo-700",
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  const getPriorityBadge = (priority: string) => {
    const base = "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full";
    switch (priority) {
      case "Urgent":
        return (
          <span className={`${base} bg-red-50 text-signal-red border border-red-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-signal-red" />
            Urgent
          </span>
        );
      case "High":
        return (
          <span className={`${base} bg-amber-50 text-signal-amber border border-amber-200`}>
            High
          </span>
        );
      case "Low":
        return (
          <span className={`${base} bg-gray-50 text-gray-500 border border-gray-200`}>
            Low
          </span>
        );
      default:
        return (
          <span className={`${base} bg-blue-50 text-accent border border-blue-200`}>
            Medium
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full";
    switch (status) {
      case "Completed":
        return (
          <span className={`${base} bg-green-50 text-signal-green border border-green-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
            Completed
          </span>
        );
      case "Planning":
      case "Upcoming":
        return (
          <span className={`${base} bg-cyan-50 text-cyan-700 border border-cyan-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Upcoming
          </span>
        );
      case "Enquiry":
      case "Enquired":
        return (
          <span className={`${base} bg-purple-50 text-purple-700 border border-purple-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Enquiry
          </span>
        );
      case "In Progress":
        return (
          <span className={`${base} bg-blue-50 text-accent border border-blue-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            In Progress
          </span>
        );
      case "On Hold":
        return (
          <span className={`${base} bg-amber-50 text-signal-amber border border-amber-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-signal-amber" />
            On Hold
          </span>
        );
      default:
        return (
          <span className={`${base} bg-gray-50 text-gray-600 border border-gray-200`}>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Not Started
          </span>
        );
    }
  };

  const getDurationBadge = (duration: DurationInfo, status: string) => {
    const base = "inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full text-[10px]";

    if (status === "Completed") {
      return (
        <span className={`${base} bg-green-50 text-signal-green border border-green-200`}>
          Completed
        </span>
      );
    }

    if (duration.statusType === "none") {
      return (
        <span className={`${base} bg-gray-50 text-gray-400 border border-gray-200`}>
          No deadline
        </span>
      );
    }

    switch (duration.statusType) {
      case "overdue":
        return (
          <span className={`${base} bg-red-50 text-signal-red border border-red-200`}>
            {duration.label}
          </span>
        );
      case "today":
        return (
          <span className={`${base} bg-amber-50 text-signal-amber border border-amber-200`}>
            {duration.label}
          </span>
        );
      case "urgent":
        return (
          <span className={`${base} bg-amber-50 text-signal-amber border border-amber-200`}>
            {duration.label}
          </span>
        );
      case "planning":
        return (
          <span className={`${base} bg-cyan-50 text-cyan-700 border border-cyan-200`}>
            {duration.label}
          </span>
        );
      default:
        return (
          <span className={`${base} bg-blue-50 text-accent border border-blue-100`}>
            {duration.label}
          </span>
        );
    }
  };

  const getPaymentBadge = (total: number, rec: number) => {
    const base = "text-[10px] font-medium px-2 py-0.5 rounded-full";
    if (total === 0) return null;
    if (rec >= total) {
      return (
        <span className={`${base} bg-green-50 text-signal-green border border-green-200`}>
          Paid in Full
        </span>
      );
    }
    if (rec > 0) {
      return (
        <span className={`${base} bg-amber-50 text-signal-amber border border-amber-200`}>
          Partially Paid
        </span>
      );
    }
    return (
      <span className={`${base} bg-red-50 text-signal-red border border-red-200`}>
        Unpaid
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: "projects" as const, label: "Projects & Pipeline", count: projects.length },
            { id: "works" as const, label: "Works Monitor", count: allTasks.length, alert: tasksOverdueCount },
            { id: "bugs" as const, label: "Bugs Monitor", count: allIssues.length, alert: criticalBugsCount },
            { id: "meetings" as const, label: "Meetings & Follow-ups", count: allMeetings.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] transition-all cursor-pointer border-b-2 ${
                activeSection === tab.id
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-gray-500 hover:text-ink font-medium"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  activeSection === tab.id ? "bg-blue-100 text-accent" : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
              {tab.alert && tab.alert > 0 && (
                <span className="w-2 h-2 rounded-full bg-signal-red" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {activeSection === "projects" && (
            <Link
              href="/projects/new"
              className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors"
            >
              + Add Project
            </Link>
          )}
          {activeSection === "works" && (
            <Link
              href="/team"
              className="px-3.5 py-1.5 bg-ink hover:bg-black text-white text-[13px] font-medium rounded-md transition-colors"
            >
              Manage Team
            </Link>
          )}
          {activeSection === "bugs" && (
            <Link
              href="/issues"
              className="px-3.5 py-1.5 bg-signal-red hover:bg-red-700 text-white text-[13px] font-medium rounded-md transition-colors"
            >
              Issues Hub
            </Link>
          )}
          {activeSection === "meetings" && (
            <Link
              href="/meetings"
              className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors"
            >
              Full Meetings Hub ↗
            </Link>
          )}
        </div>
      </div>

      {/* SECTION: WORKS MONITOR */}
      {activeSection === "works" && (
        <AdminWorksMonitor
          initialTasks={allTasks}
          teamMembers={teamMembers}
          projects={projects.map((p) => ({ id: p.id, name: p.name, client: p.client }))}
        />
      )}

      {/* SECTION: BUGS MONITOR */}
      {activeSection === "bugs" && (
        <AdminBugsMonitor
          initialIssues={allIssues}
          teamMembers={teamMembers}
          projects={projects.map((p) => ({ id: p.id, name: p.name, client: p.client }))}
        />
      )}

      {/* SECTION: MEETINGS MONITOR */}
      {activeSection === "meetings" && (
        <AdminMeetingsMonitor
          initialMeetings={allMeetings}
          teamMembers={teamMembers}
          projects={projects.map((p) => ({ id: p.id, name: p.name, client: p.client }))}
        />
      )}

      {/* SECTION: PROJECTS & CASHFLOW */}
      {activeSection === "projects" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-ink tracking-tight">
                Projects & Cashflow
              </h1>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Client deliverables, agreed fees, deadlines, and collected revenue
              </p>
            </div>
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors"
            >
              + Add New Project
            </Link>
          </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline */}
        <Link
          href="/accounts"
          className="block p-4 bg-white rounded-lg border border-border hover:border-accent transition-colors group"
        >
          <span className="text-[12px] text-gray-500 font-medium">
            Total pipeline
          </span>
          <p
            suppressHydrationWarning
            className="text-xl font-semibold text-ink mt-1 tabular-nums"
          >
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
            <span>{projects.length} project{projects.length === 1 ? "" : "s"}</span>
            <span className="text-accent font-medium group-hover:underline">View accounts →</span>
          </p>
        </Link>

        {/* Cash Received */}
        <button
          type="button"
          onClick={() => {
            setPaymentFilter(paymentFilter === "Paid" ? "All" : "Paid");
          }}
          className={`text-left p-4 bg-white rounded-lg border transition-colors cursor-pointer ${
            paymentFilter === "Paid"
              ? "border-signal-green"
              : "border-border hover:border-signal-green"
          }`}
        >
          <span className="text-[12px] text-gray-500 font-medium">
            Cash collected
          </span>
          <p
            suppressHydrationWarning
            className="text-xl font-semibold text-signal-green mt-1 tabular-nums"
          >
            {formatCurrency(totalReceived)}
          </p>
          <div className="mt-2 space-y-1">
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-signal-green rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 flex justify-between">
              <span>{collectionRate}% collected</span>
              <span className="font-medium">Filter paid →</span>
            </p>
          </div>
        </button>

        {/* Pending */}
        <button
          type="button"
          onClick={() => {
            setPaymentFilter(paymentFilter === "Unpaid" ? "All" : "Unpaid");
          }}
          className={`text-left p-4 bg-white rounded-lg border transition-colors cursor-pointer ${
            paymentFilter === "Unpaid" || paymentFilter === "Partially Paid"
              ? "border-signal-amber"
              : "border-border hover:border-signal-amber"
          }`}
        >
          <span className="text-[12px] text-gray-500 font-medium">
            Pending balance
          </span>
          <p
            suppressHydrationWarning
            className="text-xl font-semibold text-signal-amber mt-1 tabular-nums"
          >
            {formatCurrency(totalPending)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
            <span>Outstanding revenue</span>
            <span className="font-medium">Filter unpaid →</span>
          </p>
        </button>

        {/* Active Deliverables */}
        <button
          type="button"
          onClick={() => {
            setActiveTab(activeTab === "In Progress" ? "all" : "In Progress");
          }}
          className={`text-left p-4 bg-white rounded-lg border transition-colors cursor-pointer ${
            activeTab === "In Progress"
              ? "border-accent"
              : "border-border hover:border-accent"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500 font-medium">
              Active deliverables
            </span>
            {mounted && overdueCount > 0 && (
              <span
                suppressHydrationWarning
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-signal-red border border-red-200"
              >
                {overdueCount} overdue
              </span>
            )}
          </div>
          <p className="text-xl font-semibold text-accent mt-1">
            {activeCount}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
            <span>Currently in progress</span>
            {mounted && dueSoonCount > 0 ? (
              <span className="font-medium text-signal-amber">
                {dueSoonCount} due soon
              </span>
            ) : (
              <span className="font-medium">Filter active →</span>
            )}
          </p>
        </button>
      </div>

      {/* Team Stats Row */}
      {teamStats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Link
              href="/team"
              className="group bg-white p-4 rounded-lg border border-border hover:border-accent transition-colors"
            >
              <span className="text-[12px] text-gray-500 font-medium">
                Team members
              </span>
              <div className="text-xl font-semibold text-ink mt-1">
                {teamStats.totalMembers}
              </div>
              <span className="text-[11px] text-accent font-medium group-hover:underline mt-0.5 block">
                Manage →
              </span>
            </Link>

            <Link
              href="/objections"
              className={`group bg-white p-4 rounded-lg border transition-colors ${
                teamStats.openObjections > 0
                  ? "border-red-200 hover:border-signal-red"
                  : "border-border hover:border-accent"
              }`}
            >
              <span className="text-[12px] text-gray-500 font-medium">
                Open objections
              </span>
              <div
                className={`text-xl font-semibold mt-1 ${
                  teamStats.openObjections > 0 ? "text-signal-red" : "text-ink"
                }`}
              >
                {teamStats.openObjections}
              </div>
              <span
                className={`text-[11px] font-medium group-hover:underline mt-0.5 block ${
                  teamStats.openObjections > 0 ? "text-signal-red" : "text-gray-400"
                }`}
              >
                {teamStats.openObjections > 0 ? "Needs review →" : "All resolved"}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setActiveSection("works")}
              className="text-left group bg-white p-4 rounded-lg border border-border hover:border-accent transition-colors cursor-pointer"
            >
              <span className="text-[12px] text-gray-500 font-medium">
                Tasks in progress
              </span>
              <div className="text-xl font-semibold text-accent mt-1">
                {teamStats.tasksInProgress}
              </div>
              <span className="text-[11px] text-accent font-medium group-hover:underline mt-0.5 block">
                Monitor works →
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("works")}
              className="text-left group bg-white p-4 rounded-lg border border-border hover:border-red-200 transition-colors cursor-pointer"
            >
              <span className="text-[12px] text-gray-500 font-medium">
                Tasks overdue
              </span>
              <div
                className={`text-xl font-semibold mt-1 ${
                  teamStats.tasksOverdue > 0 ? "text-signal-red" : "text-signal-green"
                }`}
              >
                {teamStats.tasksOverdue}
              </div>
              <span
                className={`text-[11px] font-medium group-hover:underline mt-0.5 block ${
                  teamStats.tasksOverdue > 0 ? "text-signal-red" : "text-signal-green"
                }`}
              >
                {teamStats.tasksOverdue > 0 ? "Review deadlines →" : "All on track"}
              </span>
            </button>

            {/* Bugs Card */}
            <button
              type="button"
              onClick={() => setActiveSection("bugs")}
              className="text-left group bg-white p-4 rounded-lg border border-border hover:border-red-200 transition-colors cursor-pointer"
            >
              <span className="text-[12px] text-gray-500 font-medium">
                Assigned bugs
              </span>
              <div className="text-xl font-semibold text-ink mt-1 flex items-center gap-2">
                <span>{allIssues.length}</span>
                {criticalBugsCount > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-signal-red border border-red-200">
                    {criticalBugsCount} critical
                  </span>
                )}
              </div>
              <span className="text-[11px] text-signal-red font-medium group-hover:underline mt-0.5 block">
                Monitor bugs →
              </span>
            </button>
          </div>

          {/* Monitoring Summary */}
          <div className="p-4 bg-white rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium text-ink flex items-center gap-2">
                <span>Monitoring suite</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-accent border border-blue-200 font-medium">
                  {allTasks.length} works · {allIssues.length} bugs
                </span>
              </p>
              <p className="text-[12px] text-gray-500">
                Worker workloads, progress, deadline alerts, and task reassignment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection("works")}
                className="px-3 py-1.5 bg-accent hover:bg-blue-700 text-white text-[12px] font-medium rounded-md transition-colors cursor-pointer"
              >
                Monitor Works
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("bugs")}
                className="px-3 py-1.5 bg-signal-red hover:bg-red-700 text-white text-[12px] font-medium rounded-md transition-colors cursor-pointer"
              >
                Monitor Bugs
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          {recentActivity && recentActivity.length > 0 && (
            <ActivityFeed activities={recentActivity} />
          )}
        </div>
      )}

      {/* Enquiry Notification */}
      {enquiryCount > 0 && activeTab !== "Enquiry" && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-purple-900">
              {enquiryCount} prospective enquiry{enquiryCount === 1 ? "" : "s"}
            </p>
            <p className="text-[12px] text-purple-700 mt-0.5">
              Leads waiting for onboarding and contract commitment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("Enquiry")}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-medium rounded-md transition-colors cursor-pointer"
          >
            Review Enquiries ({enquiryCount})
          </button>
        </div>
      )}

      {/* Controls: Tabs, Search, Filters, View Modes */}
      <div className="space-y-3">
        {/* Workflow Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
          {[
            { id: "all", label: "All Projects", count: projects.length },
            { id: "In Progress", label: "In Progress", count: activeCount },
            { id: "Enquiry", label: "Leads & Enquiries", count: enquiryCount },
            { id: "Planning", label: "Upcoming", count: upcomingCount },
            { id: "Completed", label: "Completed", count: completedCount },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] transition-all whitespace-nowrap cursor-pointer border-b-2 -mb-[1px] ${
                  isActive
                    ? "border-accent text-accent font-semibold"
                    : "border-transparent text-gray-500 hover:text-ink font-medium"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-blue-100 text-accent" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Filter, View Switcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by project, client, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-[13px] bg-white border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 text-[12px] font-medium bg-white border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer text-gray-600"
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid in Full</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-[12px] font-medium bg-white border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer text-gray-600"
            >
              <option value="updated-desc">Recently Updated</option>
              <option value="deadline-asc">Deadline: Earliest</option>
              <option value="amount-desc">Highest Value</option>
              <option value="progress-desc">Most Completed</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center border border-border rounded-md bg-white">
              {(["grid", "kanban", "table"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleViewChange(mode)}
                  className={`px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer capitalize ${
                    viewMode === mode
                      ? "bg-gray-100 text-ink"
                      : "text-gray-400 hover:text-ink"
                  }`}
                >
                  {mode === "grid" ? "Cards" : mode === "kanban" ? "Kanban" : "Table"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project Content */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <h3 className="text-[14px] font-medium text-ink">
            {projects.length === 0 ? "No projects yet" : "No matches found"}
          </h3>
          <p className="text-[12px] text-gray-400 max-w-sm mx-auto mt-1 mb-4">
            {projects.length === 0
              ? "Create your first project to start tracking deadlines, milestones, and cashflow."
              : "No projects match your current filters or search query."}
          </p>
          {projects.length === 0 ? (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors"
            >
              + Create First Project
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
                setPaymentFilter("All");
              }}
              className="px-3 py-1.5 text-[12px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ==================== VIEW 1: GRID CARDS ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const isEnquiry = p.status === "Enquiry" || p.status === "Enquired";
            const isUpcoming = p.status === "Planning" || p.status === "Upcoming";
            const pending = Math.max(0, (p.totalAmount || 0) - (p.receivedAmount || 0));
            const paymentPct =
              p.totalAmount > 0
                ? Math.min(100, Math.round(((p.receivedAmount || 0) / p.totalAmount) * 100))
                : 0;

            const duration = getProjectDuration(p.deadline, p.status, mounted);
            const isOverdue = duration.statusType === "overdue";

            return (
              <div
                key={p.id}
                className={`group relative bg-white rounded-lg p-4 flex flex-col justify-between border transition-colors ${
                  isOverdue
                    ? "border-red-200 hover:border-signal-red"
                    : "border-border hover:border-accent"
                }`}
              >
                {/* Top: Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.client && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] font-medium text-gray-600">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold ${getAvatarColor(p.client)}`}
                          >
                            {getInitials(p.client)}
                          </span>
                          <span className="truncate max-w-[80px]">{p.client}</span>
                        </div>
                      )}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
                        {p.category || "General"}
                      </span>
                      {getPriorityBadge(p.priority)}
                      {getStatusBadge(p.status)}
                      {isOverdue && (
                        <span
                          suppressHydrationWarning
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-signal-red border border-red-200"
                        >
                          Overdue
                        </span>
                      )}
                      {p.attachmentCount && p.attachmentCount > 0 ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
                          {p.attachmentCount} file{p.attachmentCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(p);
                      }}
                      title="Delete project"
                      className="p-1 text-gray-300 hover:text-signal-red rounded transition-colors cursor-pointer text-[13px]"
                    >
                      ×
                    </button>
                  </div>

                  {/* Title */}
                  <Link href={`/projects/${p.id}`} className="block hover:underline">
                    <h2 className="text-[14px] font-semibold text-ink leading-snug">
                      {p.name}
                    </h2>
                  </Link>

                  {p.description && (
                    <p className="text-[12px] text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Bottom: Progress & Financials */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
                  {isEnquiry ? (
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-md flex items-center justify-between">
                      <div>
                        <span className="text-[12px] font-medium text-purple-900 block">
                          Prospective enquiry
                        </span>
                        <span className="text-[11px] text-purple-700 block mt-0.5">
                          Awaiting client confirmation
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(p.id, "In Progress")}
                        disabled={updatingId === p.id}
                        className="text-[11px] font-medium px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors cursor-pointer"
                      >
                        {updatingId === p.id ? "..." : "Onboard →"}
                      </button>
                    </div>
                  ) : isUpcoming ? (
                    <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-md flex items-center justify-between">
                      <div>
                        <span className="text-[12px] font-medium text-cyan-900 block">
                          Upcoming phase
                        </span>
                        <span className="text-[11px] text-cyan-700 block mt-0.5">
                          Ready for kickoff
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(p.id, "In Progress")}
                        disabled={updatingId === p.id}
                        className="text-[11px] font-medium px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors cursor-pointer"
                      >
                        {updatingId === p.id ? "..." : "Kickoff →"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center text-[11px] text-gray-500 mb-1">
                        <span>Work completion</span>
                        <span className="text-ink font-medium tabular-nums">{p.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            p.status === "Completed" ? "bg-signal-green" : "bg-accent"
                          }`}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Financial Breakdown */}
                  {p.totalAmount > 0 && (
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 font-medium">
                          {isEnquiry ? "Quoted budget" : isUpcoming ? "Agreed amount" : "Contract value"}
                        </span>
                        <div>{getPaymentBadge(p.totalAmount, p.receivedAmount || 0)}</div>
                      </div>

                      <div className="flex items-baseline justify-between gap-1">
                        <div suppressHydrationWarning className="text-[13px] font-semibold text-ink tabular-nums">
                          {formatCurrency(p.totalAmount)}
                        </div>
                        {!isEnquiry && (
                          <div suppressHydrationWarning className="text-[11px] text-gray-500 tabular-nums">
                            <span className="text-signal-green font-medium">
                              {formatCurrency(p.receivedAmount || 0)}
                            </span>
                            <span> / </span>
                            <span className="text-signal-amber font-medium">
                              {formatCurrency(pending)} pending
                            </span>
                          </div>
                        )}
                      </div>

                      {!isEnquiry && p.totalAmount > 0 && (
                        <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden flex">
                          <div
                            className="bg-signal-green h-full transition-all duration-300"
                            style={{ width: `${paymentPct}%` }}
                          />
                          <div
                            className="bg-signal-amber h-full transition-all duration-300"
                            style={{ width: `${100 - paymentPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Deadline & Link */}
                  <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.deadline ? (
                        <>
                          <span
                            suppressHydrationWarning
                            className="text-gray-500 font-medium"
                          >
                            {formatDeadlineDate(p.deadline)}
                          </span>
                          <span suppressHydrationWarning>
                            {getDurationBadge(duration, p.status)}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">No deadline set</span>
                      )}
                    </div>
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {isEnquiry ? "Review →" : isUpcoming ? "Plan →" : "Details →"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "kanban" ? (
        /* ==================== VIEW 2: KANBAN ==================== */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
          {[
            { id: "Enquiry", title: "Enquiries", filterFn: (p: Project) => p.status === "Enquiry" || p.status === "Enquired", headerBg: "bg-purple-50 text-purple-900 border-purple-200", nextStatus: "Planning", nextLabel: "Plan" },
            { id: "Planning", title: "Upcoming", filterFn: (p: Project) => p.status === "Planning" || p.status === "Upcoming", headerBg: "bg-cyan-50 text-cyan-900 border-cyan-200", nextStatus: "In Progress", nextLabel: "Kickoff" },
            { id: "In Progress", title: "In Progress", filterFn: (p: Project) => p.status === "In Progress", headerBg: "bg-blue-50 text-blue-900 border-blue-200", nextStatus: "Completed", nextLabel: "Complete" },
            { id: "On Hold", title: "On Hold", filterFn: (p: Project) => p.status === "On Hold", headerBg: "bg-amber-50 text-amber-900 border-amber-200", nextStatus: "In Progress", nextLabel: "Resume" },
            { id: "Completed", title: "Completed", filterFn: (p: Project) => p.status === "Completed", headerBg: "bg-green-50 text-green-900 border-green-200", nextStatus: null as string | null, nextLabel: null as string | null },
          ].map((col) => {
            const colProjects = filteredProjects.filter(col.filterFn);
            const colValue = colProjects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

            return (
              <div
                key={col.id}
                className="bg-gray-50 rounded-lg p-3 border border-border flex flex-col gap-3 min-h-[400px]"
              >
                <div className={`p-3 rounded-md border flex items-center justify-between ${col.headerBg}`}>
                  <div>
                    <h3 className="text-[12px] font-semibold">{col.title}</h3>
                    <span suppressHydrationWarning className="text-[10px] font-medium opacity-75 block tabular-nums">
                      {formatCurrency(colValue)}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white/80">
                    {colProjects.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  {colProjects.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-gray-400 italic">
                      No projects
                    </div>
                  ) : (
                    colProjects.map((p) => {
                      const duration = getProjectDuration(p.deadline, p.status, mounted);
                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-md p-3 border border-border hover:border-accent transition-colors space-y-2 group"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 truncate max-w-[100px]">
                              {p.client || p.category || "General"}
                            </span>
                            <div className="flex items-center gap-1">
                              {p.attachmentCount && p.attachmentCount > 0 ? (
                                <span className="text-[9px] font-medium text-gray-400 bg-gray-50 px-1 py-0.5 rounded">
                                  {p.attachmentCount}
                                </span>
                              ) : null}
                              {getPriorityBadge(p.priority)}
                            </div>
                          </div>

                          <Link
                            href={`/projects/${p.id}`}
                            className="block text-[12px] font-medium text-ink hover:text-accent line-clamp-2 leading-snug"
                          >
                            {p.name}
                          </Link>

                          {p.totalAmount > 0 && (
                            <div suppressHydrationWarning className="text-[12px] font-semibold text-ink flex items-center justify-between tabular-nums">
                              <span>{formatCurrency(p.totalAmount)}</span>
                              {p.receivedAmount > 0 && (
                                <span className="text-[10px] text-signal-green font-medium">
                                  {Math.round((p.receivedAmount / p.totalAmount) * 100)}% paid
                                </span>
                              )}
                            </div>
                          )}

                          {col.id === "In Progress" && (
                            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-accent h-full rounded-full" style={{ width: `${p.progress}%` }} />
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px]">
                            <span suppressHydrationWarning>
                              {getDurationBadge(duration, p.status)}
                            </span>
                            {col.nextStatus && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(p.id, col.nextStatus!)}
                                disabled={updatingId === p.id}
                                className="text-[10px] font-medium text-accent hover:underline cursor-pointer"
                              >
                                {col.nextLabel} →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== VIEW 3: TABLE ==================== */
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] table-zebra">
              <thead className="bg-gray-50 border-b border-border text-gray-500 font-medium text-[11px]">
                <tr>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4 text-right">Contract</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((p) => {
                  const duration = getProjectDuration(p.deadline, p.status, mounted);
                  const pending = Math.max(0, (p.totalAmount || 0) - (p.receivedAmount || 0));

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 transition-colors group cursor-pointer"
                      onClick={() => (window.location.href = `/projects/${p.id}`)}
                    >
                      <td className="py-3 px-4 font-medium text-ink">
                        <Link
                          href={`/projects/${p.id}`}
                          className="hover:text-accent hover:underline block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.name}
                        </Link>
                        <span className="text-[10px] text-gray-400 font-normal block">
                          {p.category || "General"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-gray-600">
                        {p.client ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold ${getAvatarColor(p.client)}`}>
                              {getInitials(p.client)}
                            </span>
                            <span>{p.client}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                      <td className="py-3 px-4">{getPriorityBadge(p.priority)}</td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 max-w-[120px]">
                          <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-accent h-full rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-600 tabular-nums">
                            {p.progress}%
                          </span>
                        </div>
                      </td>

                      <td suppressHydrationWarning className="py-3 px-4 text-right font-semibold text-ink tabular-nums">
                        {formatCurrency(p.totalAmount)}
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          {getPaymentBadge(p.totalAmount, p.receivedAmount || 0)}
                          {pending > 0 && (
                            <span suppressHydrationWarning className="text-[10px] text-gray-400 block mt-0.5 tabular-nums">
                              {formatCurrency(pending)} pend.
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span suppressHydrationWarning className="text-gray-500 text-[11px] block">
                            {formatDeadlineDate(p.deadline)}
                          </span>
                          <span suppressHydrationWarning>
                            {getDurationBadge(duration, p.status)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/projects/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[12px] font-medium text-accent hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(p);
                            }}
                            className="text-gray-300 hover:text-signal-red p-1 text-[13px]"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full border border-border shadow-lg space-y-4">
            <h3 className="text-[16px] font-semibold text-ink">Delete Project?</h3>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-ink font-semibold">"{projectToDelete.name}"</strong>?
              All recorded financial milestones and logs will be permanently erased.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-[13px] font-medium text-white bg-signal-red hover:bg-red-700 rounded-md transition-colors cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
