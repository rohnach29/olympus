import crypto from "crypto";

/**
 * Generate a cryptographically secure API token.
 * Uses 32 random bytes (256-bit entropy) encoded as hex (64 characters).
 * This is the same entropy level as a 256-bit encryption key.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate an idempotency key from data content.
 * Used to prevent duplicate webhook processing.
 */
export function generateIdempotencyKey(userId: string, timestamps: string[]): string {
  const sortedTimestamps = [...timestamps].sort();
  const content = `${userId}:${sortedTimestamps.join(",")}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}
