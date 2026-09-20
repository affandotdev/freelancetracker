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
  const projectUrl = formData.get("projectUrl") as string;
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
      projectUrl: projectUrl?.trim() || null,
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
    projectUrl?: string | null;
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
  if (data.projectUrl !== undefined) updateData.projectUrl = data.projectUrl?.trim() || null;
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

  let taskDeadline: Date | null = null;
  if (deadlineVal) {
    const parsed = new Date(deadlineVal);
    if (!isNaN(parsed.getTime())) {
      taskDeadline = parsed;
    }
  }

  // If no deadline was explicitly specified for the task, inherit the parent project's deadline
  if (!taskDeadline) {
    const parentProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { deadline: true },
    });
    taskDeadline = parentProject?.deadline || null;
  }

  const created = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      assignedToId: assignedToId && assignedToId !== "unassigned" ? assignedToId : null,
      deadline: taskDeadline,
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

  // Description update (allowed for both Super Admin and assigned Member)
  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }

  // Super Admin only fields
  if (isSuperAdmin) {
    if (data.title !== undefined) updateData.title = data.title.trim();
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
  const path = (formData.get("path") as string)?.trim() || null;
  const module = (formData.get("module") as string)?.trim() || "User Side";
  const priority = (formData.get("priority") as string)?.trim() || "Medium";
  const assignedToId = (formData.get("assignedToId") as string)?.trim() || null;

  if (!projectId || !title) {
    throw new Error("Project and issue title are required.");
  }

  if (!assignedToId || assignedToId === "none") {
    throw new Error("Assigned worker is required. Please select a team member to assign this bug.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!targetUser || targetUser.role === "SUPER_ADMIN" || targetUser.email.toLowerCase().includes("admin@")) {
    throw new Error("Bugs must be assigned to a valid team member (cannot be assigned to an Admin).");
  }
  const targetAssigneeId = targetUser.id;

  // Attachment handling: file, screenshot, video, or cloud link
  let attachmentUrl = (formData.get("attachmentUrl") as string)?.trim() || null;
  let attachmentName = (formData.get("attachmentName") as string)?.trim() || null;
  let attachmentType = (formData.get("attachmentType") as string)?.trim() || null;

  const linkUrl = (formData.get("linkUrl") as string)?.trim();
  const linkName = (formData.get("linkName") as string)?.trim();

  const file = formData.get("file") as File | null;
  if (file && typeof file === "object" && file.size > 0 && !attachmentUrl) {
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_SIZE) {
      throw new Error("Attached file exceeds the 15MB limit. Please attach a smaller file or link a video/cloud recording.");
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || "application/octet-stream";
    attachmentUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    attachmentName = file.name;
    if (mime.startsWith("image/")) {
      attachmentType = "image";
    } else if (mime.startsWith("video/")) {
      attachmentType = "video";
    } else {
      attachmentType = "file";
    }
  } else if (linkUrl && !attachmentUrl) {
    attachmentUrl = linkUrl;
    attachmentName = linkName || "Video / Cloud Recording";
    const isVideoLink = /loom\.com|youtube\.com|youtu\.be|drive\.google\.com|vimeo\.com|\.mp4|\.webm/i.test(linkUrl);
    attachmentType = isVideoLink ? "video" : "link";
  }

  const issue = await (prisma as any).issue.create({
    data: {
      projectId,
      title,
      description,
      path,
      module,
      priority,
      status: "Open",
      raisedById: session.userId,
      assignedToId: targetAssigneeId,
      attachmentUrl,
      attachmentName,
      attachmentType,
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

  if (!assignedToId || assignedToId === "none") {
    throw new Error("Assigned worker is required. Please select a team member.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!targetUser || targetUser.role === "SUPER_ADMIN" || targetUser.email.toLowerCase().includes("admin@")) {
    throw new Error("Bugs must be assigned to a valid team member (cannot be assigned to an Admin).");
  }
  const targetUserId = targetUser.id;

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
 * Update an existing issue/bug (title, description, priority, status, assigned member, resolution).
 * Accessible to Super Admin, the reporter, or the assigned member.
 */
export async function updateIssueAction(formData: FormData) {
  const session = await requireAuth();

  const issueId = (formData.get("issueId") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const path = (formData.get("path") as string)?.trim() || null;
  const module = (formData.get("module") as string)?.trim() || "User Side";
  const priority = (formData.get("priority") as string)?.trim() || "Medium";
  const status = (formData.get("status") as string)?.trim() || "Open";
  const assignedToId = (formData.get("assignedToId") as string)?.trim() || null;
  const resolution = (formData.get("resolution") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string)?.trim();

  if (!issueId || !title) {
    throw new Error("Issue ID and title are required.");
  }

  if (!assignedToId || assignedToId === "none") {
    throw new Error("Assigned worker is required. Please select a team member.");
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
    throw new Error("Unauthorized: Only the assigned member, reporter, or Super Admin can edit this issue.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!targetUser || targetUser.role === "SUPER_ADMIN" || targetUser.email.toLowerCase().includes("admin@")) {
    throw new Error("Bugs must be assigned to a valid team member (cannot be assigned to an Admin).");
  }
  const targetAssigneeId = targetUser.id;

  const isResolvedOrClosed = status === "Resolved" || status === "Closed";

  const updated = await (prisma as any).issue.update({
    where: { id: issueId },
    data: {
      title,
      description,
      path,
      module,
      priority,
      status,
      assignedToId: targetAssigneeId,
      resolution,
      resolvedAt: isResolvedOrClosed ? (issue.resolvedAt || new Date()) : null,
      ...(projectId && isSuperAdmin ? { projectId } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      raisedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath("/issues");
  revalidatePath(`/projects/${updated.projectId}`);
  revalidatePath("/");
  if (updated.assignedToId) {
    revalidatePath(`/team/${updated.assignedToId}`);
  }

  return updated;
}

/**
 * Delete an issue.
 * Accessible to Super Admin, the reporter, or the assigned member.
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
  const isAssigned = issue.assignedToId === session.userId;

  if (!isSuperAdmin && !isReporter && !isAssigned) {
    throw new Error("Unauthorized: Only the reporter, assigned member, or Super Admin can delete this issue.");
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

/* ==========================================================================
   MEETING & FOLLOW-UP ACTIONS
   ========================================================================== */

/**
 * Schedule a new client meeting / follow-up call.
 * Super Admin can assign to any team member; Members can schedule and self-assign.
 */
export async function createMeetingAction(formData: FormData) {
  const session = await requireAuth();

  const title = (formData.get("title") as string)?.trim();
  const clientName = (formData.get("clientName") as string)?.trim();
  const clientEmail = (formData.get("clientEmail") as string)?.trim() || null;
  const clientPhone = (formData.get("clientPhone") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const type = (formData.get("type") as string)?.trim() || "Client Meeting";
  const platform = (formData.get("platform") as string)?.trim() || "Google Meet";
  const meetingLink = (formData.get("meetingLink") as string)?.trim() || null;
  const scheduledAtRaw = formData.get("scheduledAt") as string;
  const durationMinutes = parseInt((formData.get("durationMinutes") as string) || "30", 10);
  const agenda = (formData.get("agenda") as string)?.trim() || null;
  const assignedToIdRaw = (formData.get("assignedToId") as string)?.trim() || null;

  if (!title || !clientName || !scheduledAtRaw) {
    throw new Error("Meeting title, client name, and scheduled date/time are required.");
  }

  const scheduledAt = new Date(scheduledAtRaw);
  if (isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduled date/time format.");
  }

  let assignedToId = assignedToIdRaw && assignedToIdRaw !== "none" ? assignedToIdRaw : null;
  if (session.role !== "SUPER_ADMIN" && !assignedToId) {
    assignedToId = session.userId;
  }

  const meeting = await (prisma as any).meeting.create({
    data: {
      title,
      clientName,
      clientEmail,
      clientPhone,
      projectId: projectId && projectId !== "none" ? projectId : null,
      type,
      platform,
      meetingLink,
      scheduledAt,
      durationMinutes: isNaN(durationMinutes) ? 30 : durationMinutes,
      agenda,
      status: "Scheduled",
      assignedToId,
      createdById: session.userId,
    },
    include: {
      project: { select: { id: true, name: true, client: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath("/meetings");
  if (meeting.projectId) {
    revalidatePath(`/projects/${meeting.projectId}`);
  }
  if (meeting.assignedToId) {
    revalidatePath(`/team/${meeting.assignedToId}`);
  }
  revalidatePath("/");

  return meeting;
}

/**
 * Update meeting status (e.g. Scheduled -> Completed, Rescheduled, Cancelled).
 */
export async function updateMeetingStatusAction(formData: FormData) {
  const session = await requireAuth();

  const meetingId = formData.get("meetingId") as string;
  const status = formData.get("status") as string;

  if (!meetingId || !status) {
    throw new Error("Meeting ID and status are required.");
  }

  const meeting = await (prisma as any).meeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssigned = meeting.assignedToId === session.userId;
  const isCreator = meeting.createdById === session.userId;

  if (!isSuperAdmin && !isAssigned && !isCreator) {
    throw new Error("Unauthorized: Only Super Admin or assigned members can update meeting status.");
  }

  const isCompleted = status === "Completed";
  const updated = await (prisma as any).meeting.update({
    where: { id: meetingId },
    data: {
      status,
      completedAt: isCompleted ? new Date() : null,
    },
  });

  revalidatePath("/meetings");
  if (meeting.projectId) {
    revalidatePath(`/projects/${meeting.projectId}`);
  }
  if (meeting.assignedToId) {
    revalidatePath(`/team/${meeting.assignedToId}`);
  }
  revalidatePath("/");

  return updated;
}

/**
 * Log follow-up notes, discussion summary, outcome, and action items for a meeting.
 */
export async function addMeetingFollowUpAction(formData: FormData) {
  const session = await requireAuth();

  const meetingId = formData.get("meetingId") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const outcome = (formData.get("outcome") as string)?.trim() || null;
  const actionItems = (formData.get("actionItems") as string)?.trim() || null;
  const nextFollowUpDateRaw = (formData.get("nextFollowUpDate") as string)?.trim() || null;
  const markCompleted = formData.get("markCompleted") === "true";

  if (!meetingId) {
    throw new Error("Meeting ID is required.");
  }

  const meeting = await (prisma as any).meeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAssigned = meeting.assignedToId === session.userId;
  const isCreator = meeting.createdById === session.userId;

  if (!isSuperAdmin && !isAssigned && !isCreator) {
    throw new Error("Unauthorized to log follow-up notes for this meeting.");
  }

  let nextFollowUpDate: Date | null = null;
  if (nextFollowUpDateRaw) {
    const parsed = new Date(nextFollowUpDateRaw);
    if (!isNaN(parsed.getTime())) {
      nextFollowUpDate = parsed;
    }
  }

  const updateData: any = {
    notes,
    outcome,
    actionItems,
    nextFollowUpDate,
  };

  if (markCompleted) {
    updateData.status = "Completed";
    updateData.completedAt = new Date();
  }

  const updated = await (prisma as any).meeting.update({
    where: { id: meetingId },
    data: updateData,
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath("/meetings");
  if (meeting.projectId) {
    revalidatePath(`/projects/${meeting.projectId}`);
  }
  if (meeting.assignedToId) {
    revalidatePath(`/team/${meeting.assignedToId}`);
  }
  revalidatePath("/");

  return updated;
}

/**
 * Reassign meeting to another team member (Super Admin or creator).
 */
export async function reassignMeetingAction(formData: FormData) {
  const session = await requireAuth();

  const meetingId = formData.get("meetingId") as string;
  const assignedToIdRaw = (formData.get("assignedToId") as string)?.trim() || null;

  if (!meetingId) {
    throw new Error("Meeting ID is required.");
  }

  const meeting = await (prisma as any).meeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    throw new Error("Unauthorized: Super Admin access required to reassign client meetings.");
  }

  const assignedToId = assignedToIdRaw && assignedToIdRaw !== "none" ? assignedToIdRaw : null;

  const updated = await (prisma as any).meeting.update({
    where: { id: meetingId },
    data: {
      assignedToId,
    },
  });

  revalidatePath("/meetings");
  if (meeting.projectId) {
    revalidatePath(`/projects/${meeting.projectId}`);
  }
  if (assignedToId) {
    revalidatePath(`/team/${assignedToId}`);
  }
  if (meeting.assignedToId) {
    revalidatePath(`/team/${meeting.assignedToId}`);
  }
  revalidatePath("/");

  return updated;
}

/**
 * Delete a meeting.
 */
export async function deleteMeetingAction(meetingId: string) {
  const session = await requireAuth();

  if (!meetingId) {
    throw new Error("Meeting ID is required.");
  }

  const meeting = await (prisma as any).meeting.findUnique({
    where: { id: meetingId },
  });

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isCreator = meeting.createdById === session.userId;

  if (!isSuperAdmin && !isCreator) {
    throw new Error("Unauthorized: Only Super Admin or meeting creator can delete this meeting.");
  }

  await (prisma as any).meeting.delete({
    where: { id: meetingId },
  });

  revalidatePath("/meetings");
  if (meeting.projectId) {
    revalidatePath(`/projects/${meeting.projectId}`);
  }
  if (meeting.assignedToId) {
    revalidatePath(`/team/${meeting.assignedToId}`);
  }
  revalidatePath("/");

  return { success: true };
}

/**
 * Log a direct / unscheduled meeting update on the fly (e.g. ad-hoc client phone call or instant sync).
 * Creates a meeting with status: 'Completed', records the notes & outcome, and self-assigns if member.
 */
export async function createDirectMeetingUpdateAction(formData: FormData) {
  const session = await requireAuth();

  const title = (formData.get("title") as string)?.trim() || "Ad-hoc Client Meeting";
  const clientName = (formData.get("clientName") as string)?.trim();
  const clientEmail = (formData.get("clientEmail") as string)?.trim() || null;
  const clientPhone = (formData.get("clientPhone") as string)?.trim() || null;
  const projectId = (formData.get("projectId") as string)?.trim() || null;
  const type = (formData.get("type") as string)?.trim() || "Client Meeting";
  const platform = (formData.get("platform") as string)?.trim() || "Phone Call";
  const conductedAtRaw = (formData.get("conductedAt") as string)?.trim();
  const durationMinutes = parseInt((formData.get("durationMinutes") as string) || "30", 10);
  const notes = (formData.get("notes") as string)?.trim();
  const outcome = (formData.get("outcome") as string)?.trim() || "Positive - Approved";
  const actionItems = (formData.get("actionItems") as string)?.trim() || null;
  const nextFollowUpDateRaw = (formData.get("nextFollowUpDate") as string)?.trim() || null;
  const assignedToIdRaw = (formData.get("assignedToId") as string)?.trim() || null;

  if (!clientName || !notes) {
    throw new Error("Client name and discussion notes are required.");
  }

  const scheduledAt = conductedAtRaw ? new Date(conductedAtRaw) : new Date();
  let nextFollowUpDate: Date | null = null;
  if (nextFollowUpDateRaw) {
    const parsed = new Date(nextFollowUpDateRaw);
    if (!isNaN(parsed.getTime())) {
      nextFollowUpDate = parsed;
    }
  }

  let assignedToId = assignedToIdRaw && assignedToIdRaw !== "none" ? assignedToIdRaw : null;
  if (session.role !== "SUPER_ADMIN" && !assignedToId) {
    assignedToId = session.userId;
  }

  const meeting = await (prisma as any).meeting.create({
    data: {
      title,
      clientName,
      clientEmail,
      clientPhone,
      projectId: projectId && projectId !== "none" ? projectId : null,
      type,
      platform,
      scheduledAt,
      durationMinutes: isNaN(durationMinutes) ? 30 : durationMinutes,
      status: "Completed",
      completedAt: new Date(),
      notes,
      outcome,
      actionItems,
      nextFollowUpDate,
      assignedToId,
      createdById: session.userId,
    },
    include: {
      project: { select: { id: true, name: true, client: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath("/meetings");
  if (meeting.projectId) {
    revalidatePath(`/projects/${meeting.projectId}`);
  }
  if (meeting.assignedToId) {
    revalidatePath(`/team/${meeting.assignedToId}`);
  }
  revalidatePath("/");

  return meeting;
}

/* ==========================================================================
   GLOBAL NOTIFICATION ACTIONS
   ========================================================================== */

export interface NavbarNotification {
  id: string;
  type: "meeting" | "bug" | "task" | "objection";
  title: string;
  message: string;
  link: string;
  createdAt: string;
  authorName?: string;
  authorEmail?: string;
  priority?: "urgent" | "high" | "normal";
  status?: string;
}

/**
 * Fetch real-time notifications for the navbar based on the user's role and assignments.
 */
export async function getNavbarNotificationsAction(): Promise<NavbarNotification[]> {
  const session = await requireAuth();

  const notifications: NavbarNotification[] = [];

  try {
    if (session.role === "SUPER_ADMIN") {
      // 1. Recent Meeting Updates submitted by members
      const recentMeetings = (prisma as any).meeting
        ? await (prisma as any).meeting.findMany({
            take: 8,
            where: {
              OR: [
                { notes: { not: null } },
                { outcome: { not: null } },
                { status: "Completed" },
              ],
            },
            orderBy: { updatedAt: "desc" },
            include: {
              project: { select: { name: true } },
              assignedTo: { select: { name: true, email: true } },
              createdBy: { select: { name: true, email: true } },
            },
          })
        : [];

      recentMeetings.forEach((m: any) => {
        notifications.push({
          id: `notif-meet-${m.id}-${new Date(m.updatedAt).getTime()}`,
          type: "meeting",
          title: `Meeting Logged: ${m.title}`,
          message: `${m.assignedTo?.name || m.createdBy?.name || "Member"} updated meeting with ${m.clientName}. Outcome: ${m.outcome || m.status}.`,
          link: "/meetings",
          createdAt: m.updatedAt.toISOString(),
          authorName: m.assignedTo?.name || m.createdBy?.name,
          authorEmail: m.assignedTo?.email || m.createdBy?.email,
          priority: m.outcome === "Follow-up Required" ? "high" : "normal",
          status: m.status,
        });
      });

      // 2. Newly Reported & Critical Bugs
      const recentIssues = (prisma as any).issue
        ? await (prisma as any).issue.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            include: {
              project: { select: { name: true } },
              raisedBy: { select: { name: true, email: true } },
              assignedTo: { select: { name: true, email: true } },
            },
          })
        : [];

      recentIssues.forEach((issue: any) => {
        notifications.push({
          id: `notif-bug-${issue.id}`,
          type: "bug",
          title: `Bug Ticket: ${issue.title}`,
          message: `${issue.raisedBy.name} reported defect on ${issue.project.name} (${issue.priority} Priority). Assigned to ${issue.assignedTo?.name || "unassigned"}.`,
          link: "/issues",
          createdAt: issue.createdAt.toISOString(),
          authorName: issue.raisedBy.name,
          authorEmail: issue.raisedBy.email,
          priority: issue.priority === "Critical" ? "urgent" : issue.priority === "High" ? "high" : "normal",
          status: issue.status,
        });
      });

      // 3. Open Objections
      const recentObjections = await prisma.objection.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          raisedBy: { select: { name: true, email: true } },
          task: {
            include: {
              project: { select: { name: true } },
            },
          },
        },
      });

      recentObjections.forEach((obj) => {
        notifications.push({
          id: `notif-obj-${obj.id}`,
          type: "objection",
          title: `Objection on ${obj.task.title}`,
          message: `${obj.raisedBy.name} raised a blocker: "${obj.message.slice(0, 80)}"`,
          link: `/tasks/${obj.taskId}`,
          createdAt: obj.createdAt.toISOString(),
          authorName: obj.raisedBy.name,
          authorEmail: obj.raisedBy.email,
          priority: obj.status === "Open" ? "urgent" : "normal",
          status: obj.status,
        });
      });

      // 4. Task Updates
      const recentTaskUpdates = await prisma.taskUpdate.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          task: {
            include: {
              project: { select: { name: true } },
              assignedTo: { select: { name: true, email: true } },
            },
          },
        },
      });

      recentTaskUpdates.forEach((tu) => {
        notifications.push({
          id: `notif-tu-${tu.id}`,
          type: "task",
          title: `Task Update: ${tu.task.title}`,
          message: `${tu.task.assignedTo?.name || "Worker"} posted work progress on ${tu.task.project.name}.`,
          link: `/tasks/${tu.taskId}`,
          createdAt: tu.createdAt.toISOString(),
          authorName: tu.task.assignedTo?.name,
          authorEmail: tu.task.assignedTo?.email,
          priority: "normal",
        });
      });
    } else {
      // MEMBER NOTIFICATIONS:
      // 1. Assigned Meetings
      const memberMeetings = (prisma as any).meeting
        ? await (prisma as any).meeting.findMany({
            where: {
              assignedToId: session.userId,
            },
            orderBy: { scheduledAt: "desc" },
            take: 8,
            include: {
              project: { select: { name: true } },
              createdBy: { select: { name: true, email: true } },
            },
          })
        : [];

      memberMeetings.forEach((m: any) => {
        const isUpcoming = new Date(m.scheduledAt) > new Date();
        notifications.push({
          id: `notif-mem-meet-${m.id}`,
          type: "meeting",
          title: `${isUpcoming ? "Scheduled Call" : "Meeting Log"}: ${m.title}`,
          message: `Client meeting with ${m.clientName} (${m.platform}) on ${new Date(m.scheduledAt).toLocaleDateString()}. Status: ${m.status}.`,
          link: "/meetings",
          createdAt: m.createdAt.toISOString(),
          authorName: m.createdBy?.name || "Admin",
          priority: isUpcoming ? "high" : "normal",
          status: m.status,
        });
      });

      // 2. Assigned Bugs
      const memberIssues = (prisma as any).issue
        ? await (prisma as any).issue.findMany({
            where: {
              assignedToId: session.userId,
            },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
              project: { select: { name: true } },
              raisedBy: { select: { name: true, email: true } },
            },
          })
        : [];

      memberIssues.forEach((issue: any) => {
        notifications.push({
          id: `notif-mem-bug-${issue.id}`,
          type: "bug",
          title: `Assigned Bug: ${issue.title}`,
          message: `${issue.raisedBy.name} assigned you a defect on ${issue.project.name} (${issue.priority} Priority). Status: ${issue.status}.`,
          link: "/issues",
          createdAt: issue.createdAt.toISOString(),
          authorName: issue.raisedBy.name,
          priority: issue.priority === "Critical" ? "urgent" : "normal",
          status: issue.status,
        });
      });

      // 3. Assigned Tasks
      const memberTasks = await prisma.task.findMany({
        where: {
          assignedToId: session.userId,
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: {
          project: { select: { name: true } },
          objections: { where: { status: "Open" } },
        },
      });

      memberTasks.forEach((t) => {
        if (t.objections.length > 0) {
          notifications.push({
            id: `notif-mem-task-obj-${t.id}`,
            type: "objection",
            title: `Blocker on ${t.title}`,
            message: `There are ${t.objections.length} open objection(s) on your assigned task.`,
            link: `/tasks/${t.id}`,
            createdAt: t.updatedAt.toISOString(),
            priority: "urgent",
            status: "Blocked",
          });
        } else {
          notifications.push({
            id: `notif-mem-task-${t.id}`,
            type: "task",
            title: `Deliverable: ${t.title}`,
            message: `Task in ${t.project.name}. Progress: ${t.progress}%. Status: ${t.status}.`,
            link: `/tasks/${t.id}`,
            createdAt: t.createdAt.toISOString(),
            priority: "normal",
            status: t.status,
          });
        }
      });
    }

    // Sort all notifications chronologically descending
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.warn("Could not load navbar notifications:", err);
  }

  return notifications;
}



