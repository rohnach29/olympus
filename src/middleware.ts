import { NextResponse, type NextRequest } from "next/server";

// Middleware now only handles basic request processing
// Authentication is handled by server components (dashboard layout, API routes)
// This avoids conflicts between cookie checks and actual session validation

export async function middleware(request: NextRequest) {
  // Just pass through - auth is handled by layouts/pages
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only match API routes if we need to add headers, CORS, etc.
    // For now, just a minimal matcher
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
