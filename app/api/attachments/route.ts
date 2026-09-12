import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Ensures the Attachment table exists in PostgreSQL.
 * Runs each DDL statement separately so it never violates prepared statement rules.
 */
async function ensureAttachmentTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Attachment" (
        "id" TEXT PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'Quotation',
        "mimeType" TEXT NOT NULL,
        "size" INTEGER NOT NULL DEFAULT 0,
        "fileData" TEXT NOT NULL,
        "isLink" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Attachment_projectId_idx" ON "Attachment"("projectId")
    `);
  } catch (err) {
    console.warn("Attachment table initialization check:", err);
  }
}

/**
 * Persists an attachment record using Prisma Client if available,
 * or direct raw SQL insert as a resilient fallback.
 */
async function saveAttachment(data: {
  projectId: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  fileData: string;
  isLink: boolean;
}) {
  const id = crypto.randomUUID();

  if (typeof (prisma as any).attachment?.create === "function") {
    try {
      const record = await (prisma as any).attachment.create({
        data: {
          id,
          ...data,
        },
      });
      return {
        ...record,
        createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
      };
    } catch (prismaErr: any) {
      console.warn("prisma.attachment.create fallback to raw SQL:", prismaErr?.message || prismaErr);
    }
  }

  // Resilient fallback directly executing PostgreSQL INSERT
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Attachment" ("id", "projectId", "name", "category", "mimeType", "size", "fileData", "isLink", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    id,
    data.projectId,
    data.name,
    data.category,
    data.mimeType,
    data.size,
    data.fileData,
    data.isLink
  );

  return {
    id,
    ...data,
    createdAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    await ensureAttachmentTable();

    const formData = await req.formData();
    const projectId = formData.get("projectId") as string;
    const category = (formData.get("category") as string) || "Quotation";
    const isLink = formData.get("isLink") === "true";

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    if (isLink) {
      const linkUrl = formData.get("linkUrl") as string;
      const linkName = (formData.get("linkName") as string) || "Cloud Document";

      if (!linkUrl) {
        return NextResponse.json({ error: "Link URL is required" }, { status: 400 });
      }

      const created = await saveAttachment({
        projectId,
        name: linkName.trim(),
        category,
        mimeType: "text/uri-list",
        size: 0,
        fileData: linkUrl.trim(),
        isLink: true,
      });

      return NextResponse.json({
        success: true,
        attachment: created,
      });
    }

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file was selected" }, { status: 400 });
    }

    const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 4.5MB limit. Please upload a smaller file or attach a cloud link." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || "application/octet-stream";
    const base64Data = `data:${mimeType};base64,${buffer.toString("base64")}`;

    const created = await saveAttachment({
      projectId,
      name: file.name,
      category,
      mimeType,
      size: file.size,
      fileData: base64Data,
      isLink: false,
    });

    return NextResponse.json({
      success: true,
      attachment: created,
    });
  } catch (error: any) {
    console.error("Upload error in route handler:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload attachment. Please try again." },
      { status: 500 }
    );
  }
}
