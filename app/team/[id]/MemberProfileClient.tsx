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
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between gap-4">
        <BackButton fallbackHref="/team" label="Back to Team" />
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsAssignModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer"
        >
          <span>+ Assign Work to {member.name.split(" ")[0]}</span>
        </button>
      </div>

      {/* Member Profile Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-indigo-500/20 ring-4 ring-indigo-50">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {member.name}
              </h1>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                  member.role === "SUPER_ADMIN"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-indigo-100 text-indigo-800"
                }`}
              >
                {member.role === "SUPER_ADMIN" ? "Super Admin" : "Freelance Worker"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{member.email}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Member since {new Date(member.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
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
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>💼 New Deliverable</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Deliverables
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalTasks}</div>
          <span className="text-[11px] text-slate-500">Assigned works</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            In Progress
          </span>
          <div className="text-2xl font-black text-blue-600 mt-1">{inProgressTasks}</div>
          <span className="text-[11px] text-slate-500">Currently active</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Completed
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{doneTasks}</div>
          <span className="text-[11px] text-slate-500">Finished deliverables</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Blockers / Objections
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">{blockedTasks}</div>
          <span className="text-[11px] text-slate-500">Requires attention</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(["All", "In Progress", "Done", "Blocked"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterTab(tab)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterTab === tab
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            {tab} {tab === "All" ? `(${tasks.length})` : ""}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-2xs text-slate-400">
            <span className="text-3xl block mb-2">📋</span>
            <p className="text-sm font-bold text-slate-700">No deliverables found</p>
            <p className="text-xs mt-1">
              Click &quot;+ Assign Work to {member.name.split(" ")[0]}&quot; to assign a project task.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isUpdating = updatingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {task.title}
                      </Link>
                      <TaskStatusBadge status={task.status} />
                      {task.openObjectionsCount > 0 && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          ⚠️ {task.openObjectionsCount} Blocker
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        📁 {task.projectName}
                      </span>
                      {task.clientName && (
                        <>
                          <span>•</span>
                          <span>Client: {task.clientName}</span>
                        </>
                      )}
                      {task.deadline && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">
                            Due: {new Date(task.deadline).toLocaleDateString("en-IN")}
                          </span>
                        </>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-600 pt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Actions & Links */}
                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                    >
                      Open Task View ↗
                    </Link>
                  </div>
                </div>

                {/* Progress & Live Controls */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">
                        Status:
                      </span>
                      <select
                        value={task.status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="text-xs font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="In Review">In Review</option>
                        <option value="Done">Done</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">
                        Progress: <span className="text-blue-600">{task.progress}%</span>
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
                        className="w-28 sm:w-36 accent-blue-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Latest Update */}
                  {task.latestUpdate && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                      <span className="truncate max-w-md">
                        💬 Latest update: &quot;{task.latestUpdate.text}&quot;
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Assign Work to {member.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a project deliverable and assign deadline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select Project <span className="text-rose-500">*</span>
                </label>
                <select
                  name="projectId"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Task / Deliverable Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Design Landing Page Mockups"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Description / Instructions
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Brief details about what needs to be accomplished..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Initial Status
                  </label>
                  <select
                    name="status"
                    defaultValue="To Do"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Deadline
                  </label>
                  <input
                    type="date"
                    name="deadline"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
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
