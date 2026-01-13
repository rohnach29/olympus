# Olympus

An AI-powered health and longevity platform that gives LLMs real-time access to your biometrics through a custom MCP server.

## Why This Exists

Most health apps show you dashboards. Olympus lets you *talk* to your health data. Ask "Why am I tired today?" and the AI pulls your sleep stages, HRV, and recovery scores to give you a real answer.

## How It Works

```
Claude (or any LLM)
    ↓ MCP Protocol
MCP Server → exposes tools like get_sleep_data, log_food, get_hrv_trend
    ↓ REST
Next.js API routes → health data, USDA nutrition search, LLM client
    ↓ Drizzle ORM
PostgreSQL
```

The MCP server is the interesting part — it lets Claude autonomously query and log health data without copy-pasting. You just talk to it.

## What I Built

**MCP Server** (`/mcp-server`)  
Custom [Model Context Protocol](https://modelcontextprotocol.io/) server exposing 9 tools: health summaries, sleep analysis, HRV trends, workout logs, food logging, USDA search, blood work, and longevity metrics.

**RAG for Food Logging**  
"I had a chicken burrito" → USDA database search → structured macro/micronutrient JSON. No manual entry.

**Pluggable LLM Backend**  
Local inference with Ollama/DeepSeek for privacy, or Groq API for speed. One env var to switch.

## Stack

- Next.js 16 / React 19 / TypeScript / Tailwind
- PostgreSQL + Drizzle ORM
- MCP server with @modelcontextprotocol/sdk
- Ollama or Groq for LLM

## Running It

```bash
npm install

# Postgres
docker run --name olympus-db -e POSTGRES_DB=olympus -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16

cp .env.example .env.local
npm run db:push
npm run dev
```

MCP server:
```bash
cd mcp-server && npm install && npm run build
```

Add to Claude desktop config:
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
