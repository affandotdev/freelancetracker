import React from "react";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  let projects: any[] = [];

  try {
    const rawProjects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    });

    projects = rawProjects.map((p) => ({
      ...p,
      deadline: p.deadline ? p.deadline.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  } catch (error: any) {
    console.error("Database query error:", error);
  }

  return <DashboardClient initialProjects={projects} />;
}
