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
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <BackButton fallbackHref="/" label="Back to Dashboard" />
      </div>

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            Team Management
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Manage your freelance workers, credentials, and task distribution.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-3.5 py-1.5 bg-accent hover:bg-blue-700 text-white text-[13px] font-medium rounded-md transition-colors cursor-pointer self-start sm:self-auto"
        >
          + Add Team Member
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Total team
          </p>
          <div className="text-2xl font-semibold text-ink tracking-tight tabular-nums">
            {totalMembers}
          </div>
          <p className="text-[12px] text-gray-400 mt-1 tabular-nums">
            {workers.length} freelance worker{workers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Active tasks assigned
          </p>
          <div className="text-2xl font-semibold text-accent tracking-tight tabular-nums">
            {totalActiveTasks}
          </div>
          <p className="text-[12px] text-gray-400 mt-1">
            Across all project deliverables
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-border">
          <p className="text-[12px] font-medium text-gray-500 mb-1">
            Role isolation
          </p>
          <div className="text-[14px] font-medium text-ink mt-1">
            Admin & Member
          </div>
          <p className="text-[12px] text-gray-400 mt-1">
            Members see only their assigned work
          </p>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-surface border-b border-border">
          <h2 className="text-[12px] font-medium text-gray-600">
            Team Accounts ({members.length})
          </h2>
        </div>

        <div className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            const isSuperAdmin = member.role === "SUPER_ADMIN";

            return (
              <div
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/team/${member.id}`}
                  className="flex items-center gap-3.5 min-w-0 flex-1 group"
                >
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center font-semibold text-[13px] shrink-0 border border-border ${
                      isSuperAdmin
                        ? "bg-amber-50 text-amber-900 border-amber-200"
                        : "bg-blue-50 text-accent border-blue-200"
                    }`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-medium text-ink group-hover:text-accent transition-colors truncate">
                        {member.name}
                      </h3>
                      {isSelf && (
                        <span className="text-[10px] font-medium text-accent bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          You
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                          isSuperAdmin
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-gray-50 text-gray-700 border-border"
                        }`}
                      >
                        {isSuperAdmin ? "Admin" : "Member"}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-400 truncate mt-0.5">
                      {member.email}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto">
                  <div className="text-right mr-2 hidden sm:block">
                    <span className="text-[11px] text-gray-400 block">
                      Active Tasks
                    </span>
                    <span className="text-[12px] font-medium text-ink tabular-nums">
                      {member.activeTasksCount} active ({member.completedTasksCount} done)
                    </span>
                  </div>

                  <Link
                    href={`/team/${member.id}`}
                    className="px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-blue-50 border border-border rounded-md transition-colors"
                  >
                    View & Assign
                  </Link>

                  {!isSelf && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemoveMember(member.id, member.name)}
                      className="px-2.5 py-1 text-[12px] font-medium text-gray-500 hover:text-signal-red hover:bg-rose-50 border border-border rounded-md transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white max-w-md w-full p-6 rounded-lg border border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">
                Add Team Member
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-signal-red text-[12px] font-medium rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Full Name <span className="text-signal-red">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Work Email <span className="text-signal-red">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="alex@example.com"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Temporary Password <span className="text-signal-red">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-[13px] bg-white border border-border rounded-md text-ink"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  The member will use this email and password to log in.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isPending ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
