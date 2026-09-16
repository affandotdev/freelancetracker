"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createIssueAction } from "@/lib/actions";

interface TeamMemberOption {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client?: string | null;
}

interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  teamMembers: TeamMemberOption[];
  defaultProjectId?: string;
  defaultAssignedToId?: string;
  defaultTitle?: string;
  onSuccess?: (createdIssue: any) => void;
}

export default function ReportBugModal({
  isOpen,
  onClose,
  projects,
  teamMembers,
  defaultProjectId = "",
  defaultAssignedToId = "",
  defaultTitle = "",
  onSuccess,
}: ReportBugModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(
    defaultProjectId || projects[0]?.id || ""
  );
  const [selectedMemberId, setSelectedMemberId] = useState(defaultAssignedToId || "");
  const [title, setTitle] = useState(defaultTitle || "");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [description, setDescription] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Keep state in sync with incoming default props when opened
  useEffect(() => {
    if (isOpen) {
      if (defaultProjectId) setSelectedProjectId(defaultProjectId);
      else if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);

      if (defaultAssignedToId !== undefined) setSelectedMemberId(defaultAssignedToId);
      if (defaultTitle) setTitle(defaultTitle);
    }
  }, [isOpen, defaultProjectId, defaultAssignedToId, defaultTitle, projects]);

  if (!isOpen) return null;

  const filteredMembers = teamMembers.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const selectedMember = teamMembers.find((m) => m.id === selectedMemberId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const quickTags = [
    "Mobile layout broken",
    "Button not responding",
    "API 500 error",
    "Form validation error",
    "Data not saving",
    "UI alignment glitch",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) return;

    const formData = new FormData();
    formData.append("projectId", selectedProjectId);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("priority", priority);
    formData.append("assignedToId", selectedMemberId || "none");

    startTransition(async () => {
      try {
        const created = await createIssueAction(formData);
        if (onSuccess) {
          onSuccess(created);
        }
        onClose();
        setTitle("");
        setDescription("");
        setMemberSearch("");
      } catch (err: any) {
        alert(err?.message || "Failed to submit bug report.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="bg-white max-w-xl w-full my-8 rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐛</span>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                Report Bug Against Member & Project
              </h3>
            </div>
            <p className="text-xs text-rose-100">
              Quickly report a defect, link it to the project, and assign it to the responsible team member.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* STEP 1: SELECT RESPONSIBLE MEMBER */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Select Member to Report Against <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {selectedMember ? (
                  <strong className="text-rose-600 font-bold">Selected: {selectedMember.name}</strong>
                ) : (
                  "General / Unassigned"
                )}
              </span>
            </div>

            {/* Quick search if > 4 members */}
            {teamMembers.length > 4 && (
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member by name or email..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            )}

            {/* Member Selection Chips / Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedMemberId("")}
                className={`p-2 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                  selectedMemberId === ""
                    ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 text-rose-900 font-bold shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="w-7 h-7 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                  👥
                </div>
                <div className="min-w-0">
                  <p className="text-xs truncate font-bold">Unassigned</p>
                  <p className="text-[10px] text-slate-400 truncate">General project issue</p>
                </div>
              </button>

              {filteredMembers.map((member) => {
                const isSelected = selectedMemberId === member.id;
                const initials = member.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`p-2 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 text-rose-950 font-bold shadow-2xs"
                        : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100/90"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isSelected ? "bg-rose-600 text-white" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs truncate font-bold">{member.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT PROJECT */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Select Target Project <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.name} {p.client ? `(Client: ${p.client})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* STEP 3: ISSUE TITLE & QUICK TAGS */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              3. Issue Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Header dropdown closes unexpectedly on mobile"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            />

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-semibold">Quick Ideas:</span>
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTitle(tag)}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer text-slate-600"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 4: PRIORITY SELECTOR (1-CLICK PILLS) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              4. Bug Severity & Priority
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: "Critical",
                  label: "🔴 Critical",
                  desc: "Blocker / Crash",
                  active: "bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-500/20 font-bold",
                },
                {
                  id: "High",
                  label: "🟠 High",
                  desc: "Major feature broken",
                  active: "bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-500/20 font-bold",
                },
                {
                  id: "Medium",
                  label: "🔵 Medium",
                  desc: "Normal defect",
                  active: "bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-500/20 font-bold",
                },
                {
                  id: "Low",
                  label: "⚪ Low",
                  desc: "Cosmetic / Small",
                  active: "bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-400/20 font-bold",
                },
              ].map((p) => {
                const isSelected = priority === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? p.active
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <p className="text-xs font-extrabold">{p.label}</p>
                    <p className="text-[10px] opacity-75">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 5: DESCRIPTION / STEPS */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              5. Steps to Reproduce & Details (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1. Open product page&#10;2. Click checkout button&#10;3. Notice error dialog appears"
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium leading-relaxed resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              <span>Assignee: </span>
              <strong className="text-slate-800 font-bold">
                {selectedMember ? selectedMember.name : "Unassigned"}
              </strong>
              {selectedProject && (
                <span className="text-slate-400 ml-1">
                  • Project: <strong>{selectedProject.name}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !title.trim() || !selectedProjectId}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-extrabold rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Submitting Bug Report...</span>
                  </>
                ) : (
                  <>
                    <span>🐛</span>
                    <span>
                      Report Bug
                      {selectedMember ? ` Against ${selectedMember.name.split(" ")[0]}` : ""}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
