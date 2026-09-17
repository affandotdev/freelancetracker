"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import TaskStatusBadge from "@/components/TaskStatusBadge";
import { assignTaskToMemberAction, updateTaskAction } from "@/lib/actions";

export interface MemberTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  deadline: string | null;
  projectId: string;
  projectName: string;
  clientName: string | null;
  openObjectionsCount: number;
  latestUpdate: { text: string; createdAt: string } | null;
  updatedAt: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client: string | null;
}

interface MemberProfileClientProps {
  member: MemberInfo;
  initialTasks: MemberTask[];
  projects: ProjectOption[];
}

export default function MemberProfileClient({
  member,
  initialTasks,
  projects,
}: MemberProfileClientProps) {
  const [tasks, setTasks] = useState<MemberTask[]>(initialTasks);
  const [filterTab, setFilterTab] = useState<string>("All");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Active task update state
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Stats
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress").length;
  const doneTasks = tasks.filter((t) => t.status === "Done").length;
  const blockedTasks = tasks.filter(
    (t) => t.status === "Blocked" || t.openObjectionsCount > 0
  ).length;

  const filteredTasks = useMemo(() => {
    if (filterTab === "All") return tasks;
    if (filterTab === "In Progress") return tasks.filter((t) => t.status === "In Progress");
    if (filterTab === "Done") return tasks.filter((t) => t.status === "Done");
    if (filterTab === "Blocked")
      return tasks.filter((t) => t.status === "Blocked" || t.openObjectionsCount > 0);
    return tasks.filter((t) => t.status === filterTab);
  }, [tasks, filterTab]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    startTransition(async () => {
      try {
        const nextProgress = newStatus === "Done" ? 100 : undefined;
        await updateTaskAction(taskId, { status: newStatus, progress: nextProgress });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: newStatus,
                  progress: nextProgress !== undefined ? nextProgress : t.progress,
                }
              : t
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to update status.");
      } finally {
        setUpdatingTaskId(null);
      }
    });
  };

  const handleProgressChange = async (taskId: string, newProgress: number) => {
    setUpdatingTaskId(taskId);
    startTransition(async () => {
      try {
        const nextStatus = newProgress === 100 ? "Done" : undefined;
        await updateTaskAction(taskId, { progress: newProgress, status: nextStatus });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress: newProgress,
                  status: nextStatus || (t.status === "Done" && newProgress < 100 ? "In Progress" : t.status),
                }
              : t
          )
        );
      } catch (err: any) {
        alert(err?.message || "Failed to update progress.");
      } finally {
        setUpdatingTaskId(null);
      }
    });
  };

  const handleAssignTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(e.currentTarget);
    formData.set("memberId", member.id);

    startTransition(async () => {
      try {
        const created = await assignTaskToMemberAction(formData);
        const linkedProj = projects.find((p) => p.id === created.projectId);

        setTasks((prev) => [
          {
            id: created.id,
            title: created.title,
            description: created.description,
            status: created.status,
            progress: created.progress,
            deadline: created.deadline ? created.deadline.toISOString() : null,
            projectId: created.projectId,
            projectName: linkedProj?.name || "Assigned Project",
            clientName: linkedProj?.client || null,
            openObjectionsCount: 0,
            latestUpdate: null,
            updatedAt: created.updatedAt.toISOString(),
          },
          ...prev,
        ]);
        setIsAssignModalOpen(false);
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to assign task.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <BackButton fallbackHref="/team" label="Back to Team" />
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsAssignModalOpen(true);
          }}
          className="inline-flex items-center px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors cursor-pointer"
        >
          + Assign Work
        </button>
      </div>

      {/* Member Profile Header */}
      <div className="bg-white p-6 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-surface border border-border text-ink flex items-center justify-center font-semibold text-lg">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">
                {member.name}
              </h1>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                  member.role === "SUPER_ADMIN"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-gray-50 text-gray-700 border-border"
                }`}
              >
                {member.role === "SUPER_ADMIN" ? "Admin" : "Member"}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">{member.email}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Joined {new Date(member.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setIsAssignModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors cursor-pointer"
          >
            + Assign Deliverable
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Total deliverables
          </p>
          <div className="text-2xl font-semibold text-ink tracking-tight tabular-nums">{totalTasks}</div>
          <p className="text-[12px] text-gray-400 mt-1">Assigned works</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            In progress
          </p>
          <div className="text-2xl font-semibold text-accent tracking-tight tabular-nums">{inProgressTasks}</div>
          <p className="text-[12px] text-gray-400 mt-1">Currently active</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Completed
          </p>
          <div className="text-2xl font-semibold text-signal-green tracking-tight tabular-nums">{doneTasks}</div>
          <p className="text-[12px] text-gray-400 mt-1">Finished deliverables</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Blockers
          </p>
          <div className="text-2xl font-semibold text-signal-red tracking-tight tabular-nums">{blockedTasks}</div>
          <p className="text-[12px] text-gray-400 mt-1">Requires attention</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {(["All", "In Progress", "Done", "Blocked"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterTab(tab)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              filterTab === tab
                ? "bg-ink text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab} {tab === "All" ? `(${tasks.length})` : ""}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-lg border border-dashed border-border text-gray-400 text-[13px]">
            <p className="font-medium text-ink">No deliverables found</p>
            <p className="text-[12px] mt-0.5 text-gray-400">
              Click &quot;+ Assign Work&quot; to assign a project task.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isUpdating = updatingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="bg-white p-5 rounded-lg border border-border space-y-3"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-[14px] font-medium text-ink hover:text-accent transition-colors"
                      >
                        {task.title}
                      </Link>
                      <TaskStatusBadge status={task.status} />
                      {task.openObjectionsCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-signal-red border border-rose-200">
                          {task.openObjectionsCount} Blocker{task.openObjectionsCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-gray-500">
                      <span className="font-medium text-ink">
                        {task.projectName}
                      </span>
                      {task.clientName && (
                        <>
                          <span>·</span>
                          <span>Client: {task.clientName}</span>
                        </>
                      )}
                      {task.deadline && (
                        <>
                          <span>·</span>
                          <span className="text-gray-600 tabular-nums">
                            Due: {new Date(task.deadline).toLocaleDateString("en-IN")}
                          </span>
                        </>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-[12px] text-gray-600 pt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-blue-50 border border-border rounded-md transition-colors"
                    >
                      Open Task
                    </Link>
                  </div>
                </div>

                {/* Progress & Controls */}
                <div className="bg-surface p-3 rounded-md border border-border space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-gray-600">
                        Status:
                      </span>
                      <select
                        value={task.status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="text-[12px] font-medium px-2 py-1 bg-white border border-border rounded-md focus:outline-none cursor-pointer"
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="In Review">In Review</option>
                        <option value="Done">Done</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-gray-600 tabular-nums">
                        Progress: <span className="text-ink">{task.progress}%</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={task.progress}
                        disabled={isUpdating}
                        onChange={(e) =>
                          handleProgressChange(task.id, parseInt(e.target.value))
                        }
                        className="w-24 sm:w-32 accent-accent cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Latest Update */}
                  {task.latestUpdate && (
                    <div className="text-[11px] text-gray-500 pt-1 border-t border-border flex items-center justify-between">
                      <span className="truncate max-w-md">
                        Update: &quot;{task.latestUpdate.text}&quot;
                      </span>
                      <span className="shrink-0 text-[10px] text-gray-400 tabular-nums">
                        {new Date(task.latestUpdate.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assign Task Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white max-w-md w-full p-6 rounded-lg border border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Assign Work to {member.name}
                </h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Select a project deliverable and assign deadline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-gray-400 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-signal-red text-[12px] font-medium rounded-md">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Select Project <span className="text-signal-red">*</span>
                </label>
                <select
                  name="projectId"
                  required
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink cursor-pointer"
                >
                  <option value="">-- Choose a project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.client ? `(${p.client})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Task / Deliverable Title <span className="text-signal-red">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Design Landing Page Mockups"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Brief details about what needs to be accomplished..."
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    name="status"
                    defaultValue="To Do"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink cursor-pointer"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    name="deadline"
                    className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isPending ? "Assigning..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
