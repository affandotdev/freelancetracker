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

  let project = null;
  try {
    project = await prisma.project.findUnique({
      where: { id },
    });
  } catch (err) {
    console.error("Error finding project:", err);
  }

  if (!project) {
    notFound();
  }

  return (
    <ProjectDetailClient
      project={{
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        deadline: project.deadline ? project.deadline.toISOString() : null,
      }}
    />
  );
}
