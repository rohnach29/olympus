# Olympus - Health & Longevity Platform

A comprehensive health tracking platform with AI-powered insights, built with Next.js, PostgreSQL, and local LLM support.

## Features

- **Dashboard** - Overview of readiness, sleep, recovery, and strain scores
- **Nutrition Tracking** - Log meals with macro/micronutrient tracking
- **Workout Tracking** - Log workouts with training load analysis
- **Sleep Analysis** - Sleep stages, efficiency, and trends
- **Recovery Monitoring** - HRV-based recovery scoring
- **AI Health Coach** - Personalized insights powered by local LLM (DeepSeek/Ollama)
- **Blood Work** - Track and trend biomarkers (coming soon)
- **Longevity Score** - Biological age calculation (coming soon)

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Drizzle ORM
- **AI/LLM**: Ollama (local/remote GPU) with DeepSeek, or Groq API
- **Auth**: iron-session with bcrypt password hashing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (local or Docker)
- Ollama (for local AI)

### 1. Clone and Install

```bash
cd ~/Projects/olympus
npm install
```

### 2. Set Up PostgreSQL

#### Option A: Local PostgreSQL (macOS)

```bash
# Install with Homebrew
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb olympus
```

#### Option B: Docker

```bash
docker run --name olympus-db -e POSTGRES_DB=olympus -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16
```

### 3. Configure Environment

Update `.env.local`:

```env
# Database
DATABASE_URL=postgres://localhost:5432/olympus
# For Docker: postgres://postgres:password@localhost:5432/olympus

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-secret-key-change-this-in-production

# LLM Configuration
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:7b
```

### 4. Run Database Migrations

```bash
# Push schema to database
npm run db:push

# Or generate and run migrations
npm run db:generate
npm run db:migrate
```

### 5. Set Up Local LLM (Ollama)

```bash
# Install Ollama (macOS)
brew install ollama

# Or download from https://ollama.com

# Start Ollama
ollama serve

# In another terminal, pull DeepSeek model
ollama pull deepseek-r1:7b
```

### 6. Run the App

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 7. Create an Account

1. Go to `/signup` to create an account
2. You'll be redirected to the dashboard

## Using a Remote GPU Server

If you have a GPU server for running larger models:

1. On your GPU server, start Ollama with network access:
   ```bash
   ollama serve --host 0.0.0.0
   ```

2. Pull a larger model:
   ```bash
   ollama pull deepseek-r1:32b  # or 70b if you have enough VRAM
   ```

3. Update `.env.local`:
   ```env
   OLLAMA_HOST=http://YOUR_GPU_SERVER_IP:11434
   OLLAMA_MODEL=deepseek-r1:32b
   ```

## Project Structure

```
olympus/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (dashboard)/       # Dashboard pages
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   └── charts/            # Chart components
│   └── lib/
│       ├── db/                # Drizzle ORM schema and connection
│       ├── auth/              # Authentication utilities
│       ├── llm/               # LLM client (Ollama/Groq/vLLM)
│       └── utils/             # Utility functions
├── drizzle/                   # Generated migrations
└── public/                    # Static assets
```

## Environment Variables

```env
# Database (Required)
DATABASE_URL=postgres://localhost:5432/olympus

# Session (Required)
SESSION_SECRET=your-secret-key

# LLM Configuration
LLM_PROVIDER=ollama              # ollama, groq, or vllm
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:7b

# For production (optional - Groq is very cheap)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant

# For vLLM (alternative to Ollama)
VLLM_HOST=http://localhost:8000
VLLM_MODEL=deepseek-ai/DeepSeek-R1-Distill-Qwen-32B
```

## Database Commands

```bash
# Push schema changes to database (development)
npm run db:push

# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deploying to Vercel

1. Set up a PostgreSQL database (Neon, Railway, or Supabase PostgreSQL)
2. Push to GitHub
3. Import to Vercel
4. Add environment variables:
   - `DATABASE_URL` - Your production database URL
   - `SESSION_SECRET` - Strong random string
   - `LLM_PROVIDER=groq` - Use Groq for production
   - `GROQ_API_KEY` - Your Groq API key
5. Deploy

For production LLM, Groq API is recommended (~$0.05/M tokens):
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key
```

## Roadmap

- [ ] Blood work upload and parsing
- [ ] Longevity/biological age calculation
- [ ] Apple Health / Google Fit integration
- [ ] Device integrations (Whoop, Oura, Garmin)
- [ ] Mobile app (Flutter)
- [ ] Social features and challenges
- [ ] Advanced analytics and trends

## License

MIT
