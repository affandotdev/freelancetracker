import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import InvoicePrintView from "./InvoicePrintView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;

  let invoice: any = null;

  try {
    invoice = await (prisma as any).invoice.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: true,
            clientEmail: true,
            category: true,
            totalAmount: true,
            receivedAmount: true,
            description: true,
          },
        },
      },
    });
  } catch (err) {
    console.warn("Error fetching invoice:", err);
  }

  if (!invoice) {
    notFound();
  }

  const formattedInvoice = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    amount: invoice.amount,
    status: invoice.status,
    notes: invoice.notes,
    project: {
      id: invoice.project.id,
      name: invoice.project.name,
      client: invoice.project.client || "Client",
      clientEmail: invoice.project.clientEmail || null,
      category: invoice.project.category || "General",
      totalAmount: invoice.project.totalAmount,
      receivedAmount: invoice.project.receivedAmount,
      description: invoice.project.description,
    },
  };

  return <InvoicePrintView invoice={formattedInvoice} />;
}
