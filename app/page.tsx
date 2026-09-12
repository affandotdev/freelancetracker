import React from "react";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  let projects: any[] = [];

  try {
    let rawProjects: any[] = [];
    try {
      rawProjects = await (prisma as any).project.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          _count: {
            select: { attachments: true },
          },
        },
      });
    } catch (err) {
      console.warn("Could not include attachments count, falling back:", err);
      rawProjects = await prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
      });
    }

    projects = rawProjects.map((p) => ({
      ...p,
      deadline: p.deadline ? p.deadline.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      attachmentCount: p._count?.attachments || 0,
    }));
  } catch (error: any) {
    console.error("Database query error:", error);
  }

  return <DashboardClient initialProjects={projects} />;
}
