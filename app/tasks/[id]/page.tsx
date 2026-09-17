import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/roles";
import TaskDetailClient, { TaskDetailData } from "./TaskDetailClient";

export const dynamic = "force-dynamic";

interface TaskPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function TaskDetailPage({ params }: TaskPageProps) {
  const session = await requireAuth();
  const resolvedParams = await params;
  const { id } = resolvedParams;

  let task: any = null;
  let teamMembers: any[] = [];
  let rawMeetings: any[] = [];

  try {
    task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, client: true, clientEmail: true, deadline: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        updates: {
          orderBy: { createdAt: "desc" },
        },
        objections: {
          orderBy: { createdAt: "desc" },
          include: {
            raisedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (task) {
      const [users, meetings] = await Promise.all([
        prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        }),
        (prisma as any).meeting
          ? (prisma as any).meeting.findMany({
              where: {
                OR: [
                  { projectId: task.projectId },
                  { assignedToId: task.assignedToId || undefined },
                ],
              },
              orderBy: [{ scheduledAt: "desc" }],
              include: {
                project: { select: { id: true, name: true, client: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true, email: true } },
              },
            })
          : Promise.resolve([]),
      ]);

      teamMembers = users;
      rawMeetings = meetings || [];
    }
  } catch (err) {
    console.warn("Database query error on task details (reconnecting):", err);
  }

  if (!task) {
    notFound();
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssigned = task.assignedToId === session.userId;

  // Enforce server-side access control: only Super Admin or assigned member can view
  if (!isSuperAdmin && !isAssigned) {
    redirect("/");
  }

  const formattedTask: TaskDetailData = {
    id: task.id,
    projectId: task.projectId,
    projectName: task.project.name,
    projectClient: task.project.client || null,
    projectDeadline: task.project.deadline ? task.project.deadline.toISOString() : null,
    title: task.title,
    description: task.description,
    status: task.status,
    progress: task.progress,
    deadline: task.deadline ? task.deadline.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    assignedTo: task.assignedTo
      ? {
          id: task.assignedTo.id,
          name: task.assignedTo.name,
          email: task.assignedTo.email,
        }
      : null,
    updates: (task.updates || []).map((u: any) => ({
      id: u.id,
      text: u.text,
      createdAt: u.createdAt.toISOString(),
    })),
    objections: (task.objections || []).map((o: any) => ({
      id: o.id,
      message: o.message,
      status: o.status,
      resolution: o.resolution,
      createdAt: o.createdAt.toISOString(),
      resolvedAt: o.resolvedAt ? o.resolvedAt.toISOString() : null,
      raisedBy: {
        id: o.raisedBy.id,
        name: o.raisedBy.name,
        email: o.raisedBy.email,
      },
    })),
  };

  const formattedMeetings = rawMeetings.map((m: any) => ({
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
    scheduledAt: m.scheduledAt.toISOString(),
    durationMinutes: m.durationMinutes,
    status: m.status,
    agenda: m.agenda || null,
    notes: m.notes || null,
    actionItems: m.actionItems || null,
    outcome: m.outcome || null,
    nextFollowUpDate: m.nextFollowUpDate ? m.nextFollowUpDate.toISOString() : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    assignedTo: m.assignedTo
      ? {
          id: m.assignedTo.id,
          name: m.assignedTo.name,
          email: m.assignedTo.email,
        }
      : null,
    createdBy: m.createdBy
      ? {
          id: m.createdBy.id,
          name: m.createdBy.name,
          email: m.createdBy.email,
        }
      : null,
  }));

  return (
    <TaskDetailClient
      task={formattedTask}
      isSuperAdmin={isSuperAdmin}
      currentUserId={session.userId}
      teamMembers={teamMembers}
      initialMeetings={formattedMeetings}
    />
  );
}
