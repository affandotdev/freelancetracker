import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ProjectDetailClient from "./ProjectDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect("/login");
  }

  // Only Super Admin manages whole projects and financials
  if (session.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;
  const isSuperAdmin = session.role === "SUPER_ADMIN";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      attachments: {
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          objections: {
            where: { status: "Open" },
            select: { id: true },
          },
        },
      },
      issues: {
        where: isSuperAdmin
          ? undefined
          : {
              OR: [
                { assignedToId: session.userId },
                { raisedById: session.userId },
              ],
            },
        orderBy: [{ createdAt: "desc" }],
        include: {
          raisedBy: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Fetch meetings and team members
  const [rawTeamMembers, rawMeetings] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    (prisma as any).meeting
      ? (prisma as any).meeting.findMany({
          where: { projectId: id },
          orderBy: [{ scheduledAt: "desc" }],
          include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
            createdBy: { select: { id: true, name: true, email: true, role: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const attachments = (project.attachments || []).map((att) => ({
    id: att.id,
    name: att.name,
    category: att.category,
    mimeType: att.mimeType,
    size: att.size,
    fileData: att.fileData,
    isLink: att.isLink,
    createdAt: att.createdAt.toISOString(),
  }));

  const tasks = (project.tasks || []).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    progress: task.progress,
    deadline: task.deadline ? task.deadline.toISOString() : null,
    assignedTo: task.assignedTo
      ? {
          id: task.assignedTo.id,
          name: task.assignedTo.name,
          email: task.assignedTo.email,
        }
      : null,
    openObjectionsCount: task.objections.length,
  }));

  const issues = ((project as any).issues || []).map((issue: any) => ({
    id: issue.id,
    projectId: issue.projectId,
    projectName: project.name,
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

  const meetings = (rawMeetings || []).map((m: any) => ({
    id: m.id,
    projectId: m.projectId,
    projectName: project.name,
    projectClient: project.client || null,
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

  return (
    <ProjectDetailClient
      project={{
        id: project.id,
        name: project.name,
        client: project.client,
        clientEmail: project.clientEmail,
        category: project.category,
        priority: project.priority,
        status: project.status,
        progress: project.progress,
        totalAmount: project.totalAmount,
        receivedAmount: project.receivedAmount,
        deadline: project.deadline ? project.deadline.toISOString() : null,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      }}
      initialAttachments={attachments}
      initialTasks={tasks}
      initialIssues={issues}
      initialMeetings={meetings}
      teamMembers={rawTeamMembers}
      currentUserId={session.userId}
    />
  );
}
