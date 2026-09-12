import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProjectDetailClient from "./ProjectDetailClient";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  let project: any = null;
  try {
    project = await (prisma as any).project.findUnique({
      where: { id },
      include: {
        attachments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (err) {
    console.warn("Could not include attachments, falling back:", err);
    try {
      project = await prisma.project.findUnique({
        where: { id },
      });
    } catch (e) {
      console.error("Error finding project:", e);
    }
  }

  if (!project) {
    notFound();
  }

  let rawAttachments: any[] = project.attachments || [];
  if (!project.attachments) {
    try {
      rawAttachments = await prisma.$queryRawUnsafe(
        `SELECT "id", "name", "category", "mimeType", "size", "fileData", "isLink", "createdAt" 
         FROM "Attachment" WHERE "projectId" = $1 ORDER BY "createdAt" DESC`,
        id
      );
    } catch (sqlErr) {
      console.warn("Could not query attachments via raw SQL:", sqlErr);
    }
  }

  const attachments = (rawAttachments || []).map((att: any) => ({
    id: att.id,
    name: att.name,
    category: att.category,
    mimeType: att.mimeType,
    size: att.size,
    fileData: att.fileData,
    isLink: att.isLink,
    createdAt: att.createdAt ? new Date(att.createdAt).toISOString() : new Date().toISOString(),
  }));

  return (
    <ProjectDetailClient
      project={{
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        deadline: project.deadline ? project.deadline.toISOString() : null,
      }}
      initialAttachments={attachments}
    />
  );
}
