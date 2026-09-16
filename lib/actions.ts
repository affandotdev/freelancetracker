"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { getNextInvoiceNumber } from "@/lib/invoiceNumber";

/**
 * Ensures the default SUPER_ADMIN exists in the database.
 * If no users exist, seeds one based on environment variables.
 */
async function ensureSuperAdminExists() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const adminEmail =
        process.env.SEED_ADMIN_EMAIL ||
        (process.env.APP_USERNAME && process.env.APP_USERNAME.includes("@")
          ? process.env.APP_USERNAME
          : "admin@workplan.dev");
      const adminPassword =
        process.env.SEED_ADMIN_PASSWORD || process.env.APP_PASSWORD || "admin123";
      const adminName = "Super Admin";

      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail.toLowerCase().trim(),
          passwordHash,
          role: "SUPER_ADMIN",
        },
      });
      console.log(`Auto-seeded initial Super Admin: ${adminEmail}`);
    }
  } catch (err) {
    console.warn("Could not ensure super admin exists:", err);
  }
}

/**
 * Server Action: Log in with email/username and password.
 */
export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  await ensureSuperAdminExists();

  const emailOrUsername = ((formData.get("email") as string) || (formData.get("username") as string) || "")
    .toLowerCase()
    .trim();
  const password = formData.get("password") as string;

  if (!emailOrUsername || !password) {
    return { error: "Please enter your email and password." };
  }

  // Find user by email or fallback username matching
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername },
        { email: { startsWith: emailOrUsername + "@" } },
      ],
    },
  });

  if (!user) {
    // Fallback for legacy admin credentials matching APP_USERNAME
    const legacyUser = (process.env.APP_USERNAME || "admin").toLowerCase();
    const legacyPass = process.env.APP_PASSWORD || "admin123";

    if (emailOrUsername === legacyUser && password === legacyPass) {
      // Create user record for legacy admin on the fly
      const passwordHash = await bcrypt.hash(legacyPass, 10);
      const created = await prisma.user.create({
        data: {
          name: "Super Admin",
          email: legacyUser.includes("@") ? legacyUser : `${legacyUser}@workplan.dev`,
          passwordHash,
          role: "SUPER_ADMIN",
        },
      });

      await createSession({
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
      });
      redirect("/");
    }

    return { error: "Invalid email or password." };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return { error: "Invalid email or password." };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  redirect("/");
}

/**
 * Server Action: Log out and clear session cookie.
 */
export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

/**
 * Ensures user has an active session before performing database actions.
 */
async function requireAuth() {
  const session = await getSession();
  if (!session || !session.userId) {
    redirect("/login");
  }
  return session;
}

/**
 * Ensures user is SUPER_ADMIN.
 */
async function requireSuperAdmin() {
  const session = await requireAuth();
  if (session.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized: Super Admin access required.");
  }
  return session;
}

/* ==========================================================================
   TEAM MANAGEMENT ACTIONS (Super Admin only)
   ========================================================================== */

/**
 * Create a new team member with role MEMBER.
 */
export async function createTeamMemberAction(formData: FormData) {
  await requireSuperAdmin();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    throw new Error("Name, email, and temporary password are required.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("A user with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "MEMBER",
    },
  });

  revalidatePath("/team");
  revalidatePath("/projects/[id]");
  return { success: true };
}

/**
 * Remove a team member.
 */
export async function removeTeamMemberAction(memberId: string) {
  const session = await requireSuperAdmin();

  if (session.userId === memberId) {
    throw new Error("You cannot remove your own Super Admin account.");
  }

  // Unassign tasks from this member before removing
  await prisma.task.updateMany({
    where: { assignedToId: memberId },
    data: { assignedToId: null },
  });

  await prisma.user.delete({
    where: { id: memberId },
  });

  revalidatePath("/team");
  revalidatePath("/projects");
  revalidatePath("/");
  return { success: true };
}

/* ==========================================================================
   PROJECT ACTIONS (Super Admin only)
   ========================================================================== */

export async function createProjectAction(formData: FormData) {
  await requireSuperAdmin();

  const name = formData.get("name") as string;
  const client = formData.get("client") as string;
  const clientEmail = formData.get("clientEmail") as string;
  const category = formData.get("category") as string;
  const priority = formData.get("priority") as string;
  const status = formData.get("status") as string;
  const progress = Number(formData.get("progress")) || 0;
  const totalAmount = Number(formData.get("totalAmount")) || 0;
  const receivedAmount = Number(formData.get("receivedAmount")) || 0;
  const deadlineVal = formData.get("deadline") as string;
  const description = formData.get("description") as string;

  if (!name || !name.trim()) {
    throw new Error("Project name is required.");
  }

  await prisma.project.create({
    data: {
      name: name.trim(),
      client: client?.trim() || null,
      clientEmail: clientEmail?.trim() || null,
      category: category || "Web Development",
      priority: priority || "Medium",
      status: status || "Not Started",
      progress: Math.min(100, Math.max(0, progress)),
      totalAmount: Math.max(0, totalAmount),
      receivedAmount: Math.max(0, receivedAmount),
      deadline: deadlineVal ? new Date(deadlineVal) : null,
      description: description?.trim() || null,
    },
  });

  revalidatePath("/");
  redirect("/");
}

export async function updateProjectAction(
  id: string,
  data: {
    name?: string;
    client?: string | null;
    clientEmail?: string | null;
    category?: string;
    priority?: string;
    status?: string;
    progress?: number;
    totalAmount?: number;
    receivedAmount?: number;
    deadline?: Date | string | null;
    description?: string | null;
  }
) {
  await requireSuperAdmin();

  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.client !== undefined) updateData.client = data.client?.trim() || null;
  if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail?.trim() || null;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.progress !== undefined) {
    updateData.progress = Math.min(100, Math.max(0, data.progress));
  }
  if (data.totalAmount !== undefined) {
    updateData.totalAmount = Math.max(0, Number(data.totalAmount) || 0);
  }
  if (data.receivedAmount !== undefined) {
    updateData.receivedAmount = Math.max(0, Number(data.receivedAmount) || 0);
  }
  if (data.deadline !== undefined) {
    updateData.deadline = data.deadline ? new Date(data.deadline) : null;
  }
  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }

  const updated = await prisma.project.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return updated;
}

export async function deleteProjectAction(id: string) {
  await requireSuperAdmin();

  await prisma.project.delete({
    where: { id },
  });

  revalidatePath("/");
  redirect("/");
}

/* ==========================================================================
   TASK ACTIONS (Super Admin creates/deletes; Member/Admin updates)
   ========================================================================== */

/**
 * Super Admin creates a task and assigns to a team member.
 */
export async function createTaskAction(formData: FormData) {
  await requireSuperAdmin();

  const projectId = formData.get("projectId") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const assignedToId = (formData.get("assignedToId") as string) || null;
  const deadlineVal = (formData.get("deadline") as string) || null;

  if (!projectId || !title) {
    throw new Error("Project ID and Task Title are required.");
  }

  const created = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      assignedToId: assignedToId && assignedToId !== "unassigned" ? assignedToId : null,
      deadline: deadlineVal ? new Date(deadlineVal) : null,
      status: "To Do",
      progress: 0,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return created;
}

/**
 * Update task progress, status, or details.
 * - MEMBER can only update their own assigned task's status and progress.
 * - SUPER_ADMIN can update any task and all fields.
 */
export async function updateTaskAction(
  taskId: string,
  data: {
    status?: string;
    progress?: number;
    title?: string;
    description?: string | null;
    assignedToId?: string | null;
    deadline?: string | Date | null;
  }
) {
  const session = await requireAuth();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssignedMember = task.assignedToId === session.userId;

  if (!isSuperAdmin && !isAssignedMember) {
    throw new Error("Unauthorized: You can only update your own assigned tasks.");
  }

  const updateData: any = {};

  // Status update
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "Done" && data.progress === undefined) {
      updateData.progress = 100;
    }
  }

  // Progress update (0-100)
  if (data.progress !== undefined) {
    updateData.progress = Math.min(100, Math.max(0, Number(data.progress)));
    if (updateData.progress === 100 && !data.status) {
      updateData.status = "Done";
    }
  }

  // Super Admin only fields
  if (isSuperAdmin) {
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.assignedToId !== undefined) {
      updateData.assignedToId = data.assignedToId && data.assignedToId !== "unassigned" ? data.assignedToId : null;
    }
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
  return updated;
}

/**
 * Delete a task (Super Admin only).
 */
export async function deleteTaskAction(taskId: string) {
  await requireSuperAdmin();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  await prisma.task.delete({
    where: { id: taskId },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
  return { success: true };
}

/* ==========================================================================
   TASK UPDATE LOGS
   ========================================================================== */

/**
 * Post a timestamped update on a task.
 * Accessible to assigned Member and Super Admin.
 */
export async function addTaskUpdateAction(formData: FormData) {
  const session = await requireAuth();

  const taskId = formData.get("taskId") as string;
  const text = (formData.get("text") as string)?.trim();

  if (!taskId || !text) {
    throw new Error("Task ID and update text are required.");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssignedMember = task.assignedToId === session.userId;

  if (!isSuperAdmin && !isAssignedMember) {
    throw new Error("Unauthorized: You can only post updates on your assigned tasks.");
  }

  const update = await prisma.taskUpdate.create({
    data: {
      taskId,
      text,
    },
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
  return update;
}

/**
 * Delete a timestamped work update from a task.
 * Accessible to assigned Member and Super Admin.
 */
export async function deleteTaskUpdateAction(updateId: string) {
  const session = await requireAuth();

  if (!updateId) {
    throw new Error("Update ID is required.");
  }

  const update = await prisma.taskUpdate.findUnique({
    where: { id: updateId },
    include: {
      task: true,
    },
  });

  if (!update) {
    throw new Error("Update not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssignedMember = update.task.assignedToId === session.userId;

  if (!isSuperAdmin && !isAssignedMember) {
    throw new Error("Unauthorized: Only the assigned member or Super Admin can delete this update.");
  }

  await prisma.taskUpdate.delete({
    where: { id: updateId },
  });

  revalidatePath(`/tasks/${update.taskId}`);
  revalidatePath(`/projects/${update.task.projectId}`);
  if (update.task.assignedToId) {
    revalidatePath(`/team/${update.task.assignedToId}`);
  }
  revalidatePath("/");
  return { success: true };
}

/* ==========================================================================
   OBJECTIONS ACTIONS
   ========================================================================== */

/**
 * Raise an objection / blocker on a task.
 * Accessible to assigned Member and Super Admin.
 */
export async function raiseObjectionAction(formData: FormData) {
  const session = await requireAuth();

  const taskId = formData.get("taskId") as string;
  const message = (formData.get("message") as string)?.trim();

  if (!taskId || !message) {
    throw new Error("Task ID and objection message are required.");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssignedMember = task.assignedToId === session.userId;

  if (!isSuperAdmin && !isAssignedMember) {
    throw new Error("Unauthorized: You can only raise objections on your assigned tasks.");
  }

  // Create objection and optionally mark task as Blocked
  const objection = await prisma.objection.create({
    data: {
      taskId,
      raisedById: session.userId,
      message,
      status: "Open",
    },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "Blocked" },
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/objections");
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/");
  return objection;
}

/**
 * Resolve an objection (Super Admin only).
 */
export async function resolveObjectionAction(formData: FormData) {
  await requireSuperAdmin();

  const objectionId = formData.get("objectionId") as string;
  const resolution = (formData.get("resolution") as string)?.trim() || "Resolved by Super Admin";

  if (!objectionId) {
    throw new Error("Objection ID is required.");
  }

  const objection = await prisma.objection.findUnique({
    where: { id: objectionId },
    include: { task: true },
  });

  if (!objection) {
    throw new Error("Objection not found.");
  }

  await prisma.objection.update({
    where: { id: objectionId },
    data: {
      status: "Resolved",
      resolution,
      resolvedAt: new Date(),
    },
  });

  // If no other open objections on this task, move from Blocked to In Progress
  const otherOpen = await prisma.objection.count({
    where: {
      taskId: objection.taskId,
      status: "Open",
      id: { not: objectionId },
    },
  });

  if (otherOpen === 0 && objection.task.status === "Blocked") {
    await prisma.task.update({
      where: { id: objection.taskId },
      data: { status: "In Progress" },
    });
  }

  revalidatePath("/objections");
  revalidatePath(`/tasks/${objection.taskId}`);
  revalidatePath(`/projects/${objection.task.projectId}`);
  revalidatePath("/");
  return { success: true };
}

/* ==========================================================================
   ATTACHMENT ACTIONS
   ========================================================================== */

export async function uploadAttachmentAction(formData: FormData) {
  await requireAuth();

  const projectId = formData.get("projectId") as string;
  const category = (formData.get("category") as string) || "Quotation";
  const isLink = formData.get("isLink") === "true";

  if (!projectId) {
    throw new Error("Project ID is required");
  }

  if (isLink) {
    const linkUrl = formData.get("linkUrl") as string;
    const linkName = (formData.get("linkName") as string) || "Cloud Document";

    if (!linkUrl) {
      throw new Error("Link URL is required");
    }

    const created = await (prisma as any).attachment.create({
      data: {
        projectId,
        name: linkName.trim(),
        category,
        mimeType: "text/uri-list",
        size: 0,
        fileData: linkUrl.trim(),
        isLink: true,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return {
      id: created.id,
      name: created.name,
      category: created.category,
      mimeType: created.mimeType,
      size: created.size,
      fileData: created.fileData,
      isLink: created.isLink,
      createdAt: created.createdAt.toISOString(),
    };
  }

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const MAX_SIZE = 4.5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("File size exceeds 4.5MB limit. Please upload a smaller file or attach a cloud link.");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const mimeType = file.type || "application/octet-stream";
  const base64Data = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const created = await (prisma as any).attachment.create({
    data: {
      projectId,
      name: file.name,
      category,
      mimeType,
      size: file.size,
      fileData: base64Data,
      isLink: false,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return {
    id: created.id,
    name: created.name,
    category: created.category,
    mimeType: created.mimeType,
    size: created.size,
    fileData: created.fileData,
    isLink: created.isLink,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function deleteAttachmentAction(attachmentId: string, projectId: string) {
  await requireAuth();

  await (prisma as any).attachment.delete({
    where: { id: attachmentId },
  });

  revalidatePath(`/projects/${projectId}`);
}

/* ==========================================================================
   ACCOUNTS & PAYMENT ACTIONS (Super Admin only)
   ========================================================================== */

/**
 * Super Admin records an individual payment for a project.
 * Automatically recalculates and updates Project.receivedAmount as sum of all payments.
 */
export async function addPaymentAction(
  projectId: string,
  amount: number,
  method: string = "Bank Transfer",
  note?: string | null,
  paidOn?: string | null
) {
  await requireSuperAdmin();

  if (amount === undefined || isNaN(amount) || amount <= 0) {
    throw new Error("A valid payment amount greater than 0 is required.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  // 1. Create Payment record
  const createdPayment = await (prisma as any).payment.create({
    data: {
      projectId,
      amount: Number(amount),
      method: method || "Bank Transfer",
      note: note?.trim() || null,
      paidOn: paidOn ? new Date(paidOn) : new Date(),
    },
  });

  // 2. Sum all payments for this project
  const allPayments = await (prisma as any).payment.findMany({
    where: { projectId },
    select: { amount: true },
  });

  const totalPaid = allPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  // 3. Update project's synced receivedAmount
  await prisma.project.update({
    where: { id: projectId },
    data: {
      receivedAmount: totalPaid,
    },
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return createdPayment;
}

/**
 * Super Admin deletes a payment entry and re-syncs Project.receivedAmount.
 */
export async function deletePaymentAction(paymentId: string) {
  await requireSuperAdmin();

  const payment = await (prisma as any).payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error("Payment record not found.");
  }

  const projectId = payment.projectId;

  // Delete payment
  await (prisma as any).payment.delete({
    where: { id: paymentId },
  });

  // Recalculate total payments for this project
  const remainingPayments = await (prisma as any).payment.findMany({
    where: { projectId },
    select: { amount: true },
  });

  const totalPaid = remainingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      receivedAmount: totalPaid,
    },
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/**
 * Super Admin generates a new sequential invoice for a project.
 */
export async function createInvoiceAction(formData: FormData) {
  await requireSuperAdmin();

  const projectId = formData.get("projectId") as string;
  const amountStr = formData.get("amount") as string;
  const dueDateStr = formData.get("dueDate") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!projectId || !amountStr) {
    throw new Error("Project and Invoice Amount are required.");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Please enter a valid invoice amount greater than 0.");
  }

  const invoiceNumber = await getNextInvoiceNumber();

  const created = await (prisma as any).invoice.create({
    data: {
      projectId,
      invoiceNumber,
      amount,
      dueDate: dueDateStr ? new Date(dueDateStr) : null,
      status: "Draft",
      notes,
    },
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${projectId}`);
  revalidatePath(`/invoices/${created.id}`);
  return created;
}

/**
 * Super Admin updates an invoice's status (Draft -> Sent -> Paid).
 */
export async function updateInvoiceStatusAction(
  invoiceId: string,
  status: "Draft" | "Sent" | "Paid"
) {
  await requireSuperAdmin();

  const updated = await (prisma as any).invoice.update({
    where: { id: invoiceId },
    data: { status },
  });

  revalidatePath("/accounts");
  revalidatePath(`/invoices/${invoiceId}`);
  return updated;
}

/**
 * Super Admin deletes an invoice record.
 */
export async function deleteInvoiceAction(invoiceId: string) {
  await requireSuperAdmin();

  await (prisma as any).invoice.delete({
    where: { id: invoiceId },
  });

  revalidatePath("/accounts");
}

/**
 * Compatibility helper for direct updates:
 */
export async function recordPaymentAction(projectId: string, amount: number) {
  return addPaymentAction(projectId, amount, "Direct Entry", "Recorded from Accounts");
}

/* ==========================================================================
   DIRECT MEMBER TASK ASSIGNMENT ACTIONS (Super Admin only)
   ========================================================================== */

/**
 * Super Admin directly creates a task assigned to a specific member from their profile.
 */
export async function assignTaskToMemberAction(formData: FormData) {
  await requireSuperAdmin();

  const projectId = formData.get("projectId") as string;
  const memberId = formData.get("memberId") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const deadlineVal = (formData.get("deadline") as string) || null;
  const status = (formData.get("status") as string) || "To Do";

  if (!projectId || !title || !memberId) {
    throw new Error("Project, Task Title, and Member are required.");
  }

  const created = await prisma.task.create({
    data: {
      projectId,
      assignedToId: memberId,
      title,
      description,
      status,
      progress: status === "Done" ? 100 : 0,
      deadline: deadlineVal ? new Date(deadlineVal) : null,
    },
  });

  revalidatePath(`/team/${memberId}`);
  revalidatePath("/team");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return created;
}

/* ==========================================================================
   COMMISSION ACTIONS (Super Admin only)
   ========================================================================== */

/**
 * Super Admin creates a new commission record.
 */
export async function createCommissionAction(formData: FormData) {
  await requireSuperAdmin();

  const beneficiary = (formData.get("beneficiary") as string)?.trim();
  const projectId = (formData.get("projectId") as string) || null;
  const amountStr = formData.get("amount") as string;
  const percentageStr = formData.get("percentage") as string;
  const status = (formData.get("status") as string) || "Pending";
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!beneficiary || !amountStr) {
    throw new Error("Beneficiary name and commission amount are required.");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Please enter a valid commission amount greater than 0.");
  }

  const percentage = percentageStr ? parseFloat(percentageStr) : null;
  const isPaid = status === "Paid";

  const created = await (prisma as any).commission.create({
    data: {
      beneficiary,
      projectId: projectId && projectId !== "none" ? projectId : null,
      amount,
      percentage: percentage && !isNaN(percentage) ? percentage : null,
      status,
      notes,
      paidAt: isPaid ? new Date() : null,
    },
  });

  revalidatePath("/commissions");
  return created;
}

/**
 * Super Admin updates commission status (e.g. mark as Paid or Pending).
 */
export async function updateCommissionStatusAction(
  commissionId: string,
  status: "Pending" | "Paid"
) {
  await requireSuperAdmin();

  const isPaid = status === "Paid";

  const updated = await (prisma as any).commission.update({
    where: { id: commissionId },
    data: {
      status,
      paidAt: isPaid ? new Date() : null,
    },
  });

  revalidatePath("/commissions");
  return updated;
}

/**
 * Super Admin deletes a commission record.
 */
export async function deleteCommissionAction(commissionId: string) {
  await requireSuperAdmin();

  await (prisma as any).commission.delete({
    where: { id: commissionId },
  });

  revalidatePath("/commissions");
}

/* ==========================================================================
   ISSUES & BUG TRACKER ACTIONS
   ========================================================================== */

/**
 * Report a new bug/issue against a project and optionally assign it to a team member.
 * Accessible to any authenticated user (Member or Super Admin).
 */
export async function createIssueAction(formData: FormData) {
  const session = await requireAuth();

  const projectId = (formData.get("projectId") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const priority = (formData.get("priority") as string)?.trim() || "Medium";
  const assignedToId = (formData.get("assignedToId") as string)?.trim() || null;

  if (!projectId || !title) {
    throw new Error("Project and issue title are required.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  const issue = await (prisma as any).issue.create({
    data: {
      projectId,
      title,
      description,
      priority,
      status: "Open",
      raisedById: session.userId,
      assignedToId: assignedToId && assignedToId !== "none" ? assignedToId : null,
    },
    include: {
      project: { select: { id: true, name: true } },
      raisedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath("/issues");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  if (assignedToId) {
    revalidatePath(`/team/${assignedToId}`);
  }

  return issue;
}

/**
 * Update the status of an issue (e.g. Open -> In Progress -> Resolved -> Closed),
 * with an optional resolution explanation.
 * Accessible to assigned Member, reporter, or Super Admin.
 */
export async function updateIssueStatusAction(formData: FormData) {
  const session = await requireAuth();

  const issueId = formData.get("issueId") as string;
  const status = formData.get("status") as string;
  const resolution = (formData.get("resolution") as string)?.trim() || null;

  if (!issueId || !status) {
    throw new Error("Issue ID and status are required.");
  }

  const validStatuses = ["Open", "In Progress", "Resolved", "Closed"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const issue = await (prisma as any).issue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    throw new Error("Issue not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssigned = issue.assignedToId === session.userId;
  const isReporter = issue.raisedById === session.userId;

  if (!isSuperAdmin && !isAssigned && !isReporter) {
    throw new Error("Unauthorized: Only the assigned member, reporter, or Super Admin can update this issue.");
  }

  const isResolvedOrClosed = status === "Resolved" || status === "Closed";

  const updated = await (prisma as any).issue.update({
    where: { id: issueId },
    data: {
      status,
      resolution: resolution !== null ? resolution : issue.resolution,
      resolvedAt: isResolvedOrClosed ? (issue.resolvedAt || new Date()) : null,
    },
    include: {
      project: { select: { id: true, name: true } },
      raisedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath("/issues");
  revalidatePath(`/projects/${issue.projectId}`);
  revalidatePath("/");
  if (issue.assignedToId) {
    revalidatePath(`/team/${issue.assignedToId}`);
  }

  return updated;
}

/**
 * Reassign an issue to a different team member.
 * Accessible to Super Admin, reporter, or assigned member.
 */
export async function reassignIssueAction(formData: FormData) {
  const session = await requireAuth();

  const issueId = formData.get("issueId") as string;
  const assignedToId = (formData.get("assignedToId") as string)?.trim() || null;

  if (!issueId) {
    throw new Error("Issue ID is required.");
  }

  const issue = await (prisma as any).issue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    throw new Error("Issue not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isReporter = issue.raisedById === session.userId;
  const isAssigned = issue.assignedToId === session.userId;

  if (!isSuperAdmin && !isReporter && !isAssigned) {
    throw new Error("Unauthorized: Only Super Admin, reporter, or assigned member can reassign this issue.");
  }

  const targetUserId = assignedToId && assignedToId !== "none" ? assignedToId : null;

  const updated = await (prisma as any).issue.update({
    where: { id: issueId },
    data: {
      assignedToId: targetUserId,
    },
  });

  revalidatePath("/issues");
  revalidatePath(`/projects/${issue.projectId}`);
  revalidatePath("/");
  if (targetUserId) {
    revalidatePath(`/team/${targetUserId}`);
  }

  return updated;
}

/**
 * Delete an issue.
 * Accessible to Super Admin or the user who reported it.
 */
export async function deleteIssueAction(issueId: string) {
  const session = await requireAuth();

  if (!issueId) {
    throw new Error("Issue ID is required.");
  }

  const issue = await (prisma as any).issue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    throw new Error("Issue not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isReporter = issue.raisedById === session.userId;

  if (!isSuperAdmin && !isReporter) {
    throw new Error("Unauthorized: Only the reporter or Super Admin can delete this issue.");
  }

  await (prisma as any).issue.delete({
    where: { id: issueId },
  });

  revalidatePath("/issues");
  revalidatePath(`/projects/${issue.projectId}`);
  revalidatePath("/");
  if (issue.assignedToId) {
    revalidatePath(`/team/${issue.assignedToId}`);
  }

  return { success: true };
}

