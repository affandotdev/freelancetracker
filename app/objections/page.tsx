import React from "react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import ObjectionsClient, { ObjectionData } from "./ObjectionsClient";

export const dynamic = "force-dynamic";

export default async function ObjectionsPage() {
  await requireRole("SUPER_ADMIN");

  let objections: ObjectionData[] = [];

  try {
    const rawObjections = await prisma.objection.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        task: {
          include: {
            project: {
              select: { id: true, name: true },
            },
          },
        },
        raisedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    objections = rawObjections.map((o) => ({
      id: o.id,
      taskId: o.taskId,
      taskTitle: o.task.title,
      projectId: o.task.projectId,
      projectName: o.task.project.name,
      raisedById: o.raisedById,
      raisedByName: o.raisedBy.name,
      raisedByEmail: o.raisedBy.email,
      message: o.message,
      status: o.status,
      resolution: o.resolution,
      createdAt: o.createdAt.toISOString(),
      resolvedAt: o.resolvedAt ? o.resolvedAt.toISOString() : null,
    }));
  } catch (err) {
    console.warn("Could not query objections (database reconnecting):", err);
  }

  return <ObjectionsClient objections={objections} />;
}
