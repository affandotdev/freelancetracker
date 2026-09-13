import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "project_tracker_session";

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "MEMBER" | string;
  username?: string;
}

function getSecretKey() {
  const secret =
    process.env.SESSION_SECRET ||
    "dev-secret-key-must-be-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT session cookie for the authenticated user.
 */
export async function createSession(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  const secretKey = getSecretKey();
  const token = await new SignJWT({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    username: user.name || user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return token;
}

/**
 * Verifies a JWT session token string (safe for Edge middleware).
 */
export async function verifySessionToken(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieves and verifies the session from incoming cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/**
 * Clears the session cookie on logout.
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
