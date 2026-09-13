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

  try {
    task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
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

    if (session.role === "SUPER_ADMIN") {
      teamMembers = await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
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

  return (
    <TaskDetailClient
      task={formattedTask}
      isSuperAdmin={isSuperAdmin}
      currentUserId={session.userId}
      teamMembers={teamMembers}
    />
  );
}
