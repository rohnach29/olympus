import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { db, sessions, users } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";

// Session data type
export interface SessionData {
  userId?: string;
  isLoggedIn: boolean;
}

// Session options
const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_security",
  cookieName: "olympus_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

// Get session from cookies
export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

// Get current user from session
export async function getCurrentUser() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    return null;
  }

  try {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
        gender: users.gender,
        heightCm: users.heightCm,
        weightKg: users.weightKg,
        goals: users.goals,
        settings: users.settings,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return user[0] || null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

// Create a new session for user
export async function createSession(userId: string) {
  const session = await getSession();

  // Set session data
  session.userId = userId;
  session.isLoggedIn = true;
  await session.save();

  // Also store in database for server-side validation
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
  await db.insert(sessions).values({
    userId,
    expiresAt,
  });

  return session;
}

// Destroy session (logout)
export async function destroySession() {
  const session = await getSession();

  if (session.userId) {
    // Remove from database
    await db.delete(sessions).where(eq(sessions.userId, session.userId));
  }

  session.destroy();
}

// Check if user is authenticated (for middleware)
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn && !!session.userId;
}
