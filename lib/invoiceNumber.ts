import { prisma } from "@/lib/prisma";

/**
 * Generates the next sequential invoice number in the format INV-0001, INV-0002, etc.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  try {
    const latestInvoice = await (prisma as any).invoice.findFirst({
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });

    if (!latestInvoice || !latestInvoice.invoiceNumber) {
      return "INV-0001";
    }

    // Match digits from format INV-XXXX
    const match = latestInvoice.invoiceNumber.match(/INV-(\d+)/i);
    if (match && match[1]) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `INV-${nextNumber.toString().padStart(4, "0")}`;
    }

    // Fallback: total invoice count + 1
    const totalCount = await (prisma as any).invoice.count();
    return `INV-${(totalCount + 1).toString().padStart(4, "0")}`;
  } catch (err) {
    console.warn("Could not calculate next invoice number, fallback to timestamp:", err);
    return `INV-${Date.now().toString().slice(-4)}`;
  }
}
