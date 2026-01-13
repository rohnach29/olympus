# Olympus

An AI-powered health and longevity platform that gives LLMs real-time access to your biometrics through a custom MCP server.

## Why This Exists

Most health apps show you dashboards. Olympus lets you *talk* to your health data. Ask "Why am I tired today?" and the AI pulls your sleep stages, HRV, and recovery scores to give you a real answer.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Claude / LLM                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ MCP Protocol
┌─────────────────────────▼───────────────────────────────────────┐
│                    MCP Server (TypeScript)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Tools: get_health_summary, get_sleep_data, get_hrv_trend,  │ │
│  │        log_food, search_foods, get_workouts, get_bloodwork │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────────┐
│                   Next.js Backend (API Routes)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Health APIs  │  │ Nutrition    │  │ LLM Client for simple  │ │
│  │ (sleep, hrv, │  │ (USDA search,│  │ tasks                  │ │
│  │  workouts)   │  │  food log)   │  │ (Ollama)               │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Drizzle ORM
┌─────────────────────────▼───────────────────────────────────────┐
│                       PostgreSQL                                │
│  users, health_metrics, food_logs, workouts, blood_work         │
└─────────────────────────────────────────────────────────────────┘
```

## Key Technical Decisions

**MCP Server for LLM Context Injection**  
Built a custom [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes health data as tools. This lets any MCP-compatible LLM (Claude, etc.) autonomously query sleep, HRV, nutrition, and workout data without manual copy-paste.

**RAG Pipeline for Food Logging**  
Natural language food input → USDA database search → structured nutritional JSON. Say "I had a chicken burrito" and it maps to REAL macro/micronutrient data.

**Flexible LLM Backend**  
Supports local models (Ollama/DeepSeek) for privacy or cloud APIs (Groq) for speed.

**Type-Safe Database Layer**  
Drizzle ORM with full TypeScript inference. Schema changes are caught at compile time.

## Tech Stack

Frontend | Next.js 16, React 19, TypeScript, Tailwind 
Backend | Next.js API Routes 
Database | PostgreSQL + Drizzle ORM 
MCP Server | TypeScript, @modelcontextprotocol/sdk 
LLM | Ollama (local) / Groq API (cloud) 
Auth | iron-session + bcrypt 

## MCP Server Tools

The MCP server exposes these tools to LLMs:

 `get_health_summary` | Today's metrics + weekly averages |
 `get_sleep_summary` | Sleep stages, efficiency, trends |
 `get_hrv_trend` | HRV data for recovery analysis |
 `get_recent_workouts` | Workout history with heart rate data |
 `get_todays_food_log` | Meals logged today with macros |
 `log_food` | Log a meal with full nutritional data |
 `search_foods` | Search USDA database |
 `get_blood_work_results` | Biomarker history |
 `get_longevity_metrics` | Biological age calculation |

## Running Locally

```bash
# Install dependencies
npm install

# Set up PostgreSQL (Docker)
docker run --name olympus-db -e POSTGRES_DB=olympus -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database URL and LLM settings

# Run migrations
npm run db:push

# Start dev server
npm run dev
```

For the MCP server:
```bash
cd mcp-server
npm install
npm run build
```

Then add to your Claude desktop config:
```json
{
  "mcpServers": {
    "olympus": {
      "command": "node",
      "args": ["/path/to/olympus/mcp-server/dist/index.js"]
    }
  }
}
```

## License

MIT
