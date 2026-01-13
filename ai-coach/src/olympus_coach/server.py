"""
FastAPI Server for Olympus AI Coach

This server exposes the LangGraph agent via HTTP, allowing the Next.js
frontend to communicate with the Python agent.

RUN: uvicorn olympus_coach.server:app --host 0.0.0.0 --port 8100 --reload
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

# Load environment variables before importing tools
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print("Starting Olympus AI Coach server...")
    print(f"Using model: {os.getenv('OLLAMA_MODEL', 'llama3.1:8b')}")
    yield
    # Shutdown
    print("Shutting down Olympus AI Coach server...")


app = FastAPI(
    title="Olympus AI Coach",
    description="AI Health Coach powered by LangGraph and Llama",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: Optional[str] = None  # Override OLYMPUS_USER_ID if provided


class ChatResponse(BaseModel):
    message: str
    model: str
    tools_used: list[str] = []


class HealthCheckResponse(BaseModel):
    status: str
    model: str
    tools_available: int


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Check if the server and LLM are ready."""
    try:
        from .tools import ALL_TOOLS

        model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        return HealthCheckResponse(
            status="healthy",
            model=model,
            tools_available=len(ALL_TOOLS),
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the AI coach and get a response.

    The agent will use tools to fetch real health data from the database
    before generating a response.
    """
    try:
        # Set user ID if provided (allows per-request user context)
        if request.user_id:
            os.environ["OLYMPUS_USER_ID"] = request.user_id

        # Import agent here to ensure env vars are loaded
        from .agent import create_agent
        from .tools import ALL_TOOLS

        # Create a fresh agent for each request
        model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        agent = create_agent(model_name=model)

        # Convert messages to LangChain format
        lc_messages = []
        for msg in request.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))

        # Invoke the agent
        result = agent.invoke({"messages": lc_messages})

        # Extract the final response
        final_message = result["messages"][-1]
        response_content = final_message.content

        # Track which tools were used
        tools_used = []
        for msg in result["messages"]:
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                tools_used.extend([tc["name"] for tc in msg.tool_calls])

        return ChatResponse(
            message=response_content,
            model=model,
            tools_used=list(set(tools_used)),  # Deduplicate
        )

    except Exception as e:
        error_msg = str(e)

        # Provide helpful error messages
        if "Connection refused" in error_msg or "connect" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Ollama is not running. Start it with: ollama serve",
            )
        elif "model" in error_msg.lower() and "not found" in error_msg.lower():
            model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
            raise HTTPException(
                status_code=503,
                detail=f"Model not found. Pull it with: ollama pull {model}",
            )
        elif "DATABASE_URL" in error_msg:
            raise HTTPException(
                status_code=503,
                detail="Database not configured. Check your .env file.",
            )
        else:
            raise HTTPException(status_code=500, detail=error_msg)


@app.get("/tools")
async def list_tools():
    """List all available tools."""
    from .tools import ALL_TOOLS

    return {
        "count": len(ALL_TOOLS),
        "tools": [
            {
                "name": tool.name,
                "description": tool.description[:200] + "..."
                if len(tool.description) > 200
                else tool.description,
            }
            for tool in ALL_TOOLS
        ],
    }


def main():
    """Entry point for the olympus-server command."""
    import uvicorn

    uvicorn.run(
        "olympus_coach.server:app",
        host="0.0.0.0",
        port=8100,
        reload=True,
    )


if __name__ == "__main__":
    main()
