import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import MemberProfileClient from "./MemberProfileClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;

  let member: any = null;
  let tasks: any[] = [];
  let projects: any[] = [];

  try {
    const [rawMember, rawProjects] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: {
          tasksAssigned: {
            orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
            include: {
              project: {
                select: { id: true, name: true, client: true },
              },
              objections: {
                where: { status: "Open" },
                select: { id: true, message: true, status: true },
              },
              updates: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { text: true, createdAt: true },
              },
            },
          },
        },
      }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, client: true },
      }),
    ]);

    if (!rawMember) {
      redirect("/team");
    }

    member = {
      id: rawMember.id,
      name: rawMember.name,
      email: rawMember.email,
      role: rawMember.role,
      createdAt: rawMember.createdAt.toISOString(),
    };

    tasks = rawMember.tasksAssigned.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      progress: t.progress,
      deadline: t.deadline ? t.deadline.toISOString() : null,
      projectId: t.projectId,
      projectName: t.project?.name || "General Project",
      clientName: t.project?.client || null,
      openObjectionsCount: t.objections.length,
      latestUpdate: t.updates[0]
        ? {
            text: t.updates[0].text,
            createdAt: t.updates[0].createdAt.toISOString(),
          }
        : null,
      updatedAt: t.updatedAt.toISOString(),
    }));

    projects = rawProjects.map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
    }));
  } catch (err) {
    console.error("Failed to load member profile:", err);
    redirect("/team");
  }

  return (
    <MemberProfileClient
      member={member}
      initialTasks={tasks}
      projects={projects}
    />
  );
}
