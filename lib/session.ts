import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "project_tracker_session";

function getSecretKey() {
  const secret =
    process.env.SESSION_SECRET ||
    "dev-secret-key-must-be-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT session cookie for the authenticated user.
 */
export async function createSession(username: string) {
  const secretKey = getSecretKey();
  const token = await new SignJWT({ username })
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
export async function verifySessionToken(token?: string) {
  if (!token) return null;
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as { username: string };
  } catch {
    return null;
  }
}

/**
 * Retrieves and verifies the session from incoming cookies.
 */
export async function getSession() {
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
