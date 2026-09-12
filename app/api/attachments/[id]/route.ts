import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    const attachment = await (prisma as any).attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return new NextResponse("Attachment not found", { status: 404 });
    }

    // If it's an external cloud URL, redirect to it
    if (attachment.isLink) {
      return NextResponse.redirect(attachment.fileData);
    }

    // If it's a data URL, parse and return binary
    if (attachment.fileData && attachment.fileData.startsWith("data:")) {
      const commaIdx = attachment.fileData.indexOf(",");
      const meta = attachment.fileData.slice(5, commaIdx);
      const mime = meta.split(";")[0] || attachment.mimeType || "application/octet-stream";
      const base64 = attachment.fileData.slice(commaIdx + 1);
      const buffer = Buffer.from(base64, "base64");

      const isDownload = req.nextUrl.searchParams.get("download") === "true";
      const disposition = isDownload ? "attachment" : "inline";

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mime,
          "Content-Length": buffer.length.toString(),
          "Content-Disposition": `${disposition}; filename="${encodeURIComponent(
            attachment.name
          )}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new NextResponse("Invalid file data", { status: 500 });
  } catch (error) {
    console.error("Error serving attachment:", error);
    return new NextResponse("Error retrieving file", { status: 500 });
  }
}
