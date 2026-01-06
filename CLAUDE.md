# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Interaction Guidelines (CRITICAL)
- **User Context:** I am a new grad/Junior Engineer.
- **Goal:** My priority is **learning**, not just copying code.
- **Style:**
  - Discuss **architecture** intuitively before writing code.
  - When fixing bugs, explain the **root cause** and the "why" behind the fix.
  - Avoid academic jargon; use real-world engineering analogies.
  - If a solution is complex, break it down into step-by-step logic first.

## Interaction Profile
- **Role:** You are an expert Senior Engineer acting as a mentor to a new grad.
- **Tone:** Encouraging but rigorous. Break topics down intuitively using analogies.
- **Instruction:**
  - Do not just provide the answer; explain the engineering trade-offs.
  - If I suggest a "school-style" solution (like memorizing syntax), correct me and show the "industry standard" way (like using patterns).

## Build & Development Commands

```bash
npm run dev           # Start dev server (port 3000)
npm run build         # Production build
npm run lint          # Run ESLint

# Database (Drizzle ORM)
npm run db:push       # Push schema changes to DB (development)
npm run db:generate   # Generate migrations
npm run db:migrate    # Run migrations
npm run db:studio     # Open Drizzle Studio GUI
```

## Architecture Overview

Olympus is a health and longevity tracking platform built with Next.js 16 (App Router), PostgreSQL, and Drizzle ORM.

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **UI**: Radix UI primitives with shadcn/ui patterns, Lucide icons, Recharts
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: iron-session with bcrypt (12 salt rounds)
- **LLM**: Ollama (local) or Groq API for AI health coach (not implemented yet)

### Route Groups
- `(auth)/` - Login, signup pages (unauthenticated)
- `(dashboard)/` - Protected pages with sidebar layout

### Key Directories
- `src/lib/db/schema.ts` - All database tables and types
- `src/lib/auth/session.ts` - iron-session utilities and `getCurrentUser()`
- `src/lib/llm/client.ts` - LLM provider abstraction (Ollama/Groq/vLLM)
- `src/lib/utils/sleep-scoring.ts` - Evidence-based PSQI sleep scoring algorithm
- `src/components/ui/` - Base UI components (Radix-based)
- `scripts/` - Data seeding scripts (USDA food database)

### Database Schema (14 tables)
Core tables: `users`, `sessions`, `foods`, `foodLogs`, `nutritionGoals`, `workouts`, `sleepSessions`, `dailyScores`, `bloodWork`, `chatMessages`

Types are inferred using `typeof table.$inferSelect` pattern.

### API Route Pattern
All API routes follow this structure:
```typescript
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// ... input validation
// ... database operation with Drizzle
return NextResponse.json({ data }, { status: 201 });
```

### Sleep Scoring Algorithm
Located in `src/lib/utils/sleep-scoring.ts`. Uses weighted components:
- Duration (20%), Efficiency (20%), Deep Sleep (15%), REM (15%), Latency (10%), Awakenings (10%), HRV (10%)
- Personal baselines calculated from last 14 days (min 7 sessions)

### Component Patterns
- Server components for pages and layouts
- Client components (`"use client"`) for interactive elements
- `cn()` utility for class name merging (clsx + tailwind-merge)
- Score visualization: `getScoreColor()` and `getScoreBgColor()` utilities

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - 32+ character secret for iron-session

LLM (optional):
- `LLM_PROVIDER` - `ollama`, `groq`, or `vllm`
- `OLLAMA_HOST` - Default: `http://localhost:11434`
- `OLLAMA_MODEL` - Default: `deepseek-r1:7b`
- `GROQ_API_KEY` - For production deployments

