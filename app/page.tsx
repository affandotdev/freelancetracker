import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import DashboardClient, { TeamStats } from "@/components/DashboardClient";
import MemberDashboardClient from "@/components/MemberDashboardClient";
import { ActivityItem } from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session || !session.userId) {
    redirect("/login");
  }

  // -------------------------------------------------------------
  // 1. MEMBER DASHBOARD VIEW (Isolated worker view)
  // -------------------------------------------------------------
  if (session.role === "MEMBER") {
    let memberTasks: any[] = [];
    let memberIssues: any[] = [];
    let projects: any[] = [];
    let teamMembers: any[] = [];

    try {
      const [rawTasks, rawIssues, rawProjects, rawUsers] = await Promise.all([
        prisma.task.findMany({
          where: { assignedToId: session.userId },
          orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
          include: {
            project: { select: { id: true, name: true } },
            objections: { where: { status: "Open" } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        }),
        (prisma as any).issue.findMany({
          where: {
            OR: [
              { assignedToId: session.userId },
              { raisedById: session.userId },
            ],
          },
          orderBy: [{ createdAt: "desc" }],
          include: {
            project: { select: { id: true, name: true } },
            raisedBy: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.project.findMany({
          select: { id: true, name: true, client: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
      ]);

      memberTasks = rawTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        progress: t.progress,
        deadline: t.deadline ? t.deadline.toISOString() : null,
        projectId: t.projectId,
        projectName: t.project.name,
        assignedTo: t.assignedTo,
        openObjectionsCount: t.objections.length,
      }));

      memberIssues = rawIssues.map((issue: any) => ({
        id: issue.id,
        projectId: issue.projectId,
        projectName: issue.project?.name || "General Project",
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        status: issue.status,
        resolution: issue.resolution,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        resolvedAt: issue.resolvedAt ? issue.resolvedAt.toISOString() : null,
        raisedBy: {
          id: issue.raisedBy.id,
          name: issue.raisedBy.name,
          email: issue.raisedBy.email,
        },
        assignedTo: issue.assignedTo
          ? {
              id: issue.assignedTo.id,
              name: issue.assignedTo.name,
              email: issue.assignedTo.email,
            }
          : null,
      }));

      projects = rawProjects;
      teamMembers = rawUsers;
    } catch (err) {
      console.warn("Could not load member data, retrying with fallback:", err);
    }

    return (
      <MemberDashboardClient
        memberName={session.name || session.email}
        currentUserId={session.userId}
        tasks={memberTasks}
        issues={memberIssues}
        projects={projects}
        teamMembers={teamMembers}
      />
    );
  }

  // -------------------------------------------------------------
  // 2. SUPER ADMIN DASHBOARD VIEW (Business owner view)
  // -------------------------------------------------------------
  let projects: any[] = [];
  try {
    const rawProjects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { attachments: true },
        },
      },
    });

    projects = rawProjects.map((p) => ({
      ...p,
      deadline: p.deadline ? p.deadline.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      attachmentCount: p._count?.attachments || 0,
    }));
  } catch (error: any) {
    console.error("Database query error for projects:", error);
  }

  // Super Admin Team Metrics (wrapped safely)
  let teamStats: TeamStats = {
    totalMembers: 1,
    openObjections: 0,
    tasksInProgress: 0,
    tasksOverdue: 0,
  };

  try {
    const [totalMembers, openObjections, tasksInProgress, tasksOverdue] =
      await Promise.all([
        prisma.user.count(),
        prisma.objection.count({ where: { status: "Open" } }),
        prisma.task.count({ where: { status: "In Progress" } }),
        prisma.task.count({
          where: {
            deadline: { lt: new Date() },
            status: { not: "Done" },
          },
        }),
      ]);

    teamStats = {
      totalMembers,
      openObjections,
      tasksInProgress,
      tasksOverdue,
    };
  } catch (err) {
    console.warn("Could not load team metrics from database:", err);
  }

  // Recent Team Activity: Task Updates + Objections (wrapped safely)
  let activityItems: ActivityItem[] = [];
  try {
    const [recentUpdates, recentObjections] = await Promise.all([
      prisma.taskUpdate.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          task: {
            include: {
              project: { select: { name: true } },
              assignedTo: { select: { name: true, email: true } },
            },
          },
        },
      }),
      prisma.objection.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          raisedBy: { select: { name: true, email: true } },
          task: {
            include: {
              project: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    activityItems = [
      ...recentUpdates.map((u) => ({
        id: `update-${u.id}`,
        type: "update" as const,
        title: "Task Update",
        taskId: u.taskId,
        taskTitle: u.task.title,
        projectName: u.task.project?.name,
        authorName: u.task.assignedTo?.name || "Worker",
        authorEmail: u.task.assignedTo?.email,
        content: u.text,
        createdAt: u.createdAt.toISOString(),
      })),
      ...recentObjections.map((o) => ({
        id: `obj-${o.id}`,
        type: "objection" as const,
        title: "Objection",
        taskId: o.taskId,
        taskTitle: o.task.title,
        projectName: o.task.project?.name,
        authorName: o.raisedBy.name,
        authorEmail: o.raisedBy.email,
        content: o.message,
        status: o.status,
        resolution: o.resolution,
        createdAt: o.createdAt.toISOString(),
      })),
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.warn("Could not load recent activity from database:", err);
  }

  return (
    <DashboardClient
      initialProjects={projects}
      teamStats={teamStats}
      recentActivity={activityItems}
    />
  );
}
