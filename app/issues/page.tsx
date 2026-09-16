import React from "react";
import { requireAuth } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import IssuesClient from "./IssuesClient";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const session = await requireAuth();

  let rawIssues: any[] = [];
  let rawProjects: any[] = [];
  let rawTeamMembers: any[] = [];

  try {
    const [issues, projects, teamMembers] = await Promise.all([
      (prisma as any).issue.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: {
          project: {
            select: { id: true, name: true, client: true },
          },
          raisedBy: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.project.findMany({
        select: { id: true, name: true, client: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    rawIssues = issues;
    rawProjects = projects;
    rawTeamMembers = teamMembers;
  } catch (err) {
    console.error("Error fetching issues:", err);
  }

  const formattedIssues = rawIssues.map((issue) => ({
    id: issue.id,
    projectId: issue.projectId,
    projectName: issue.project?.name || "General Project",
    clientName: issue.project?.client || null,
    title: issue.title,
    description: issue.description,
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

  return (
    <IssuesClient
      issues={formattedIssues}
      projects={rawProjects}
      teamMembers={rawTeamMembers}
      currentUser={{
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      }}
    />
  );
}
