import React from "react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import AccountsClient from "./AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requireRole("SUPER_ADMIN");

  let projects: any[] = [];

  try {
    const rawProjects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        client: true,
        clientEmail: true,
        category: true,
        status: true,
        priority: true,
        totalAmount: true,
        receivedAmount: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
        payments: {
          select: { amount: true },
        },
      },
    });

    projects = rawProjects.map((p: any) => {
      const paymentsSum = (p.payments || []).reduce(
        (acc: number, curr: any) => acc + (curr.amount || 0),
        0
      );
      const effectiveReceived = paymentsSum > 0 ? paymentsSum : p.receivedAmount;

      return {
        id: p.id,
        name: p.name,
        client: p.client || "Direct Client",
        clientEmail: p.clientEmail,
        category: p.category || "General",
        status: p.status,
        priority: p.priority,
        totalAmount: p.totalAmount,
        receivedAmount: effectiveReceived,
        balance: Math.max(0, p.totalAmount - effectiveReceived),
        deadline: p.deadline ? p.deadline.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });
  } catch (err) {
    console.warn("Could not query accounts data:", err);
  }

  return <AccountsClient initialProjects={projects} />;
}
