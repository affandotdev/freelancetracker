"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { createTeamMemberAction, removeTeamMemberAction } from "@/lib/actions";

interface TeamMemberData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  activeTasksCount: number;
  completedTasksCount: number;
}

interface TeamClientProps {
  members: TeamMemberData[];
  currentUserId: string;
}

export default function TeamClient({ members, currentUserId }: TeamClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createTeamMemberAction(formData);
        setIsModalOpen(false);
      } catch (err: any) {
        setError(err?.message || "Failed to create team member.");
      }
    });
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName}? Any tasks assigned to them will become unassigned.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await removeTeamMemberAction(memberId);
      } catch (err: any) {
        alert(err?.message || "Failed to remove member.");
      }
    });
  };

  const totalMembers = members.length;
  const workers = members.filter((m) => m.role === "MEMBER");
  const totalActiveTasks = members.reduce((acc, m) => acc + m.activeTasksCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <BackButton fallbackHref="/" label="Back to Dashboard" />
      </div>

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Team Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your freelance workers, credentials, and task distribution.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer self-start sm:self-auto"
        >
          <span>+ Add Team Member</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Team
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalMembers}
          </div>
          <span className="text-[11px] text-slate-500">
            {workers.length} active freelance worker{workers.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Tasks Assigned
          </span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {totalActiveTasks}
          </div>
          <span className="text-[11px] text-slate-500">
            Across all project deliverables
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Access Role Model
          </span>
          <div className="text-base font-bold text-indigo-600 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Super Admin + Member Isolation
          </div>
          <span className="text-[11px] text-slate-500">
            Workers see only their own tasks
          </span>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 bg-slate-50/70 border-b border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            All Team Accounts ({members.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            const isSuperAdmin = member.role === "SUPER_ADMIN";

            return (
              <div
                key={member.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <Link
                  href={`/team/${member.id}`}
                  className="flex items-center gap-3.5 min-w-0 flex-1 group"
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm shadow-2xs shrink-0 group-hover:scale-105 transition-transform ${
                      isSuperAdmin
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    }`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {member.name}
                      </h3>
                      {isSelf && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          You
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isSuperAdmin
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isSuperAdmin ? "Super Admin" : "Member"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {member.email}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto">
                  <div className="text-right mr-2 hidden sm:block">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Active Tasks
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {member.activeTasksCount} active ({member.completedTasksCount} done)
                    </span>
                  </div>

                  <Link
                    href={`/team/${member.id}`}
                    className="px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Work & Assign</span>
                    <span>→</span>
                  </Link>

                  {!isSelf && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemoveMember(member.id, member.name)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200/90 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Add New Team Member
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Work Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="alex@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Temporary Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The member will use this email and password to log in.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Creating Account..." : "Create Member Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
