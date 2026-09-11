"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/session";

/**
 * Server Action: Log in with username and password against environment variables.
 */
export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const validUsername = process.env.APP_USERNAME || "admin";
  const validPassword = process.env.APP_PASSWORD || "admin123";

  if (!username || !password) {
    return { error: "Please enter both username and password." };
  }

  if (username !== validUsername || password !== validPassword) {
    return { error: "Invalid username or password." };
  }

  await createSession(username);
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
  if (!session) {
    redirect("/login");
  }
}

/**
 * Server Action: Create a new project with rich metadata & financials.
 */
export async function createProjectAction(formData: FormData) {
  await requireAuth();

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

/**
 * Server Action: Update project details, financials, and progress.
 */
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
  await requireAuth();

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

/**
 * Server Action: Delete a project by ID.
 */
export async function deleteProjectAction(id: string) {
  await requireAuth();

  await prisma.project.delete({
    where: { id },
  });

  revalidatePath("/");
  redirect("/");
}
