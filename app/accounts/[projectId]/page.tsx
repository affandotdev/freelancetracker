import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import ProjectAccountClient from "./ProjectAccountClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectAccountPage({ params }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const { projectId } = await params;

  let project: any = null;

  try {
    project = await (prisma as any).project.findUnique({
      where: { id: projectId },
      include: {
        payments: {
          orderBy: { paidOn: "desc" },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (err) {
    console.warn("Could not query project account details:", err);
  }

  if (!project) {
    redirect("/accounts");
  }

  // Calculate actual sum of all payment records
  const totalPaid = (project.payments || []).reduce(
    (acc: number, p: any) => acc + (p.amount || 0),
    0
  );

  const formattedProject = {
    id: project.id,
    name: project.name,
    client: project.client || "Client",
    clientEmail: project.clientEmail || null,
    category: project.category || "General",
    status: project.status,
    priority: project.priority,
    totalAmount: project.totalAmount,
    receivedAmount: totalPaid,
    balance: Math.max(0, project.totalAmount - totalPaid),
    deadline: project.deadline ? project.deadline.toISOString() : null,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
  };

  const formattedPayments = (project.payments || []).map((p: any) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    note: p.note,
    paidOn: p.paidOn.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  const formattedInvoices = (project.invoices || []).map((i: any) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate ? i.dueDate.toISOString() : null,
    amount: i.amount,
    status: i.status,
    notes: i.notes,
  }));

  return (
    <ProjectAccountClient
      project={formattedProject}
      initialPayments={formattedPayments}
      initialInvoices={formattedInvoices}
    />
  );
}
