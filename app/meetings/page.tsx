import React from "react";
import { requireAuth } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import MeetingsClient from "./MeetingsClient";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const session = await requireAuth();

  let rawMeetings: any[] = [];
  let rawProjects: any[] = [];
  let rawTeamMembers: any[] = [];

  try {
    const meetingWhere = session.role === "SUPER_ADMIN"
      ? {}
      : {
          OR: [
            { assignedToId: session.userId },
            { createdById: session.userId },
          ],
        };

    const [meetings, projects, teamMembers] = await Promise.all([
      (prisma as any).meeting
        ? (prisma as any).meeting.findMany({
            where: meetingWhere,
            orderBy: [{ scheduledAt: "desc" }],
            include: {
              project: {
                select: { id: true, name: true, client: true },
              },
              assignedTo: {
                select: { id: true, name: true, email: true, role: true },
              },
              createdBy: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          })
        : Promise.resolve([]),
      prisma.project.findMany({
        select: { id: true, name: true, client: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    rawMeetings = meetings;
    rawProjects = projects;
    rawTeamMembers = teamMembers;
  } catch (err) {
    console.error("Error fetching meetings:", err);
  }

  const formattedMeetings = rawMeetings.map((m) => ({
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
    updatedAt: m.updatedAt.toISOString(),
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
    <MeetingsClient
      meetings={formattedMeetings}
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
