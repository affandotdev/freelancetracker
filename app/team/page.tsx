import React from "react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireRole("SUPER_ADMIN");

  let members: any[] = [];

  try {
    const rawMembers = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        tasksAssigned: {
          select: { id: true, status: true },
        },
      },
    });

    members = rawMembers.map((m) => {
      const activeTasks = m.tasksAssigned.filter((t) => t.status !== "Done").length;
      const completedTasks = m.tasksAssigned.filter((t) => t.status === "Done").length;

      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        activeTasksCount: activeTasks,
        completedTasksCount: completedTasks,
      };
    });
  } catch (err) {
    console.warn("Could not query team members (database reconnecting):", err);
    // Fallback: show at least the current super admin
    members = [
      {
        id: session.userId,
        name: session.name || "Super Admin",
        email: session.email,
        role: session.role,
        createdAt: new Date().toISOString(),
        activeTasksCount: 0,
        completedTasksCount: 0,
      },
    ];
  }

  return <TeamClient members={members} currentUserId={session.userId} />;
}
