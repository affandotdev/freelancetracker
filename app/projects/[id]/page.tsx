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

  // Fetch team members for task assignment dropdown
  const rawTeamMembers = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

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

  return (
    <ProjectDetailClient
      project={{
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        deadline: project.deadline ? project.deadline.toISOString() : null,
      }}
      initialAttachments={attachments}
      initialTasks={tasks}
      initialIssues={issues}
      teamMembers={rawTeamMembers}
    />
  );
}
