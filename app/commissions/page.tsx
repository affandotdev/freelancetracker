import React from "react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import CommissionsClient from "./CommissionsClient";

export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  await requireRole("SUPER_ADMIN");

  let commissions: any[] = [];
  let projects: any[] = [];

  try {
    const [rawCommissions, rawProjects] = await Promise.all([
      (prisma as any).commission.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: { id: true, name: true, client: true, totalAmount: true },
          },
        },
      }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, client: true, totalAmount: true },
      }),
    ]);

    commissions = rawCommissions.map((c: any) => ({
      id: c.id,
      beneficiary: c.beneficiary,
      projectId: c.projectId,
      projectName: c.project?.name || null,
      clientName: c.project?.client || null,
      projectAmount: c.project?.totalAmount || null,
      amount: c.amount,
      percentage: c.percentage,
      status: c.status,
      notes: c.notes,
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    projects = rawProjects.map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
      totalAmount: p.totalAmount,
    }));
  } catch (err) {
    console.warn("Could not query commissions:", err);
  }

  return (
    <CommissionsClient
      initialCommissions={commissions}
      projects={projects}
    />
  );
}
