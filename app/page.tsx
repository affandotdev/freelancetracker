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
    let memberMeetings: any[] = [];
    let projects: any[] = [];
    let teamMembers: any[] = [];

    try {
      const [rawTasks, rawIssues, rawMeetings, rawProjects, rawUsers] = await Promise.all([
        prisma.task.findMany({
          where: { assignedToId: session.userId },
          orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
          include: {
            project: { select: { id: true, name: true } },
            objections: { where: { status: "Open" } },
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        }),
        (prisma as any).issue
          ? (prisma as any).issue.findMany({
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
            })
          : Promise.resolve([]),
        (prisma as any).meeting
          ? (prisma as any).meeting.findMany({
              where: {
                OR: [
                  { assignedToId: session.userId },
                  { createdById: session.userId },
                ],
              },
              orderBy: [{ scheduledAt: "asc" }],
              include: {
                project: { select: { id: true, name: true, client: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
              },
            })
          : Promise.resolve([]),
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
        deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
        projectId: t.projectId,
        projectName: t.project?.name || "General Project",
        assignedTo: t.assignedTo,
        openObjectionsCount: t.objections?.length || 0,
      }));

      memberIssues = rawIssues.map((issue: any) => ({
        id: issue.id,
        projectId: issue.projectId,
        projectName: issue.project?.name || "General Project",
        title: issue.title,
        description: issue.description,
        path: issue.path || null,
        module: issue.module || "User Side",
        priority: issue.priority,
        status: issue.status,
        resolution: issue.resolution,
        attachmentUrl: issue.attachmentUrl || null,
        attachmentName: issue.attachmentName || null,
        attachmentType: issue.attachmentType || null,
        createdAt: issue.createdAt ? new Date(issue.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: issue.updatedAt ? new Date(issue.updatedAt).toISOString() : new Date().toISOString(),
        resolvedAt: issue.resolvedAt ? new Date(issue.resolvedAt).toISOString() : null,
        raisedBy: {
          id: issue.raisedBy?.id || session.userId,
          name: issue.raisedBy?.name || session.name || "Member",
          email: issue.raisedBy?.email || session.email || "",
        },
        assignedTo: issue.assignedTo
          ? {
              id: issue.assignedTo.id,
              name: issue.assignedTo.name,
              email: issue.assignedTo.email,
            }
          : null,
      }));

      memberMeetings = (rawMeetings || []).map((m: any) => ({
        id: m.id,
        projectId: m.projectId,
        projectName: m.project?.name || null,
        projectClient: m.project?.client || null,
        clientName: m.clientName,
        clientEmail: m.clientEmail || null,
        clientPhone: m.clientPhone || null,
        title: m.title,
        type: m.type,
        platform: m.platform,
        meetingLink: m.meetingLink || null,
        scheduledAt: m.scheduledAt ? new Date(m.scheduledAt).toISOString() : new Date().toISOString(),
        durationMinutes: m.durationMinutes,
        status: m.status,
        agenda: m.agenda || null,
        notes: m.notes || null,
        actionItems: m.actionItems || null,
        outcome: m.outcome || null,
        nextFollowUpDate: m.nextFollowUpDate ? new Date(m.nextFollowUpDate).toISOString() : null,
        completedAt: m.completedAt ? new Date(m.completedAt).toISOString() : null,
        assignedTo: m.assignedTo
          ? {
              id: m.assignedTo.id,
              name: m.assignedTo.name,
              email: m.assignedTo.email,
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
        meetings={memberMeetings}
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

  // Recent Team Activity: Task Updates + Objections + Meeting Logs (wrapped safely)
  let activityItems: ActivityItem[] = [];
  try {
    const [recentUpdates, recentObjections, recentMeetings] = await Promise.all([
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
      (prisma as any).meeting
        ? (prisma as any).meeting.findMany({
            take: 6,
            where: {
              OR: [
                { notes: { not: null } },
                { outcome: { not: null } },
                { status: "Completed" },
              ],
            },
            orderBy: { updatedAt: "desc" },
            include: {
              project: { select: { name: true } },
              assignedTo: { select: { name: true, email: true } },
              createdBy: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve([]),
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
      ...(recentMeetings || []).map((m: any) => ({
        id: `meeting-${m.id}`,
        type: "meeting" as const,
        title: "Meeting Update",
        meetingId: m.id,
        meetingTitle: m.title,
        clientName: m.clientName,
        projectName: m.project?.name,
        authorName: m.assignedTo?.name || m.createdBy?.name || "Team Member",
        authorEmail: m.assignedTo?.email || m.createdBy?.email,
        content: m.notes || `Meeting status updated to ${m.status}. Outcome: ${m.outcome || "Not specified"}`,
        status: m.status,
        outcome: m.outcome,
        createdAt: m.updatedAt.toISOString(),
      })),
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.warn("Could not load recent activity from database:", err);
  }

  // Super Admin Assigned Works (Tasks) + Assigned Bugs (Issues) + Meetings + Team Members
  let allTasks: any[] = [];
  let allIssues: any[] = [];
  let allMeetings: any[] = [];
  let teamMembers: any[] = [];

  try {
    const [rawTasks, rawIssues, rawMeetings, rawUsers] = await Promise.all([
      prisma.task.findMany({
        orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
        include: {
          project: { select: { id: true, name: true, client: true } },
          assignedTo: { select: { id: true, name: true, email: true, role: true } },
          objections: { where: { status: "Open" } },
          updates: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { id: true, text: true, createdAt: true },
          },
        },
      }),
      (prisma as any).issue
        ? (prisma as any).issue.findMany({
            orderBy: [{ createdAt: "desc" }],
            include: {
              project: { select: { id: true, name: true, client: true } },
              raisedBy: { select: { id: true, name: true, email: true } },
              assignedTo: { select: { id: true, name: true, email: true, role: true } },
            },
          })
        : Promise.resolve([]),
      (prisma as any).meeting
        ? (prisma as any).meeting.findMany({
            orderBy: [{ scheduledAt: "desc" }],
            include: {
              project: { select: { id: true, name: true, client: true } },
              assignedTo: { select: { id: true, name: true, email: true, role: true } },
              createdBy: { select: { id: true, name: true, email: true, role: true } },
            },
          })
        : Promise.resolve([]),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    allTasks = rawTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      progress: t.progress,
      deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
      projectId: t.projectId,
      projectName: t.project?.name || "General Project",
      projectClient: t.project?.client || null,
      assignedTo: t.assignedTo,
      openObjectionsCount: t.objections?.length || 0,
      latestUpdate: t.updates?.[0]
        ? {
            id: t.updates[0].id,
            text: t.updates[0].text,
            createdAt: t.updates[0].createdAt ? new Date(t.updates[0].createdAt).toISOString() : new Date().toISOString(),
          }
        : null,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
    }));

    allIssues = rawIssues.map((issue: any) => ({
      id: issue.id,
      projectId: issue.projectId,
      projectName: issue.project?.name || "General Project",
      title: issue.title,
      description: issue.description,
      path: issue.path || null,
      module: issue.module || "User Side",
      priority: issue.priority,
      status: issue.status,
      resolution: issue.resolution,
      attachmentUrl: issue.attachmentUrl || null,
      attachmentName: issue.attachmentName || null,
      attachmentType: issue.attachmentType || null,
      createdAt: issue.createdAt ? new Date(issue.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: issue.updatedAt ? new Date(issue.updatedAt).toISOString() : new Date().toISOString(),
      resolvedAt: issue.resolvedAt ? new Date(issue.resolvedAt).toISOString() : null,
      raisedBy: {
        id: issue.raisedBy?.id || "",
        name: issue.raisedBy?.name || "Unknown",
        email: issue.raisedBy?.email || "",
      },
      assignedTo: issue.assignedTo
        ? {
            id: issue.assignedTo.id,
            name: issue.assignedTo.name,
            email: issue.assignedTo.email,
            role: issue.assignedTo.role,
          }
        : null,
    }));

    allMeetings = (rawMeetings || []).map((m: any) => ({
      id: m.id,
      projectId: m.projectId,
      projectName: m.project?.name || null,
      projectClient: m.project?.client || null,
      clientName: m.clientName,
      clientEmail: m.clientEmail || null,
      clientPhone: m.clientPhone || null,
      title: m.title,
      type: m.type,
      platform: m.platform,
      meetingLink: m.meetingLink || null,
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt).toISOString() : new Date().toISOString(),
      durationMinutes: m.durationMinutes,
      status: m.status,
      agenda: m.agenda || null,
      notes: m.notes || null,
      actionItems: m.actionItems || null,
      outcome: m.outcome || null,
      nextFollowUpDate: m.nextFollowUpDate ? new Date(m.nextFollowUpDate).toISOString() : null,
      completedAt: m.completedAt ? new Date(m.completedAt).toISOString() : null,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
      assignedTo: m.assignedTo
        ? {
            id: m.assignedTo.id,
            name: m.assignedTo.name,
            email: m.assignedTo.email,
            role: m.assignedTo.role,
          }
        : null,
      createdBy: m.createdBy
        ? {
            id: m.createdBy.id,
            name: m.createdBy.name,
            email: m.createdBy.email,
            role: m.createdBy.role,
          }
        : null,
    }));

    teamMembers = rawUsers;
  } catch (err) {
    console.warn("Could not load all tasks / issues / meetings for super admin:", err);
  }

  return (
    <DashboardClient
      initialProjects={projects}
      teamStats={teamStats}
      recentActivity={activityItems}
      allTasks={allTasks}
      allIssues={allIssues}
      allMeetings={allMeetings}
      teamMembers={teamMembers}
    />
  );
}
