"""
Olympus AI Coach

A health coaching agent powered by Llama 3.1 and LangGraph.

Usage:
    from olympus_coach import agent
    result = agent.invoke({"messages": [HumanMessage(content="How did I sleep?")]})

Or run the CLI:
    python -m olympus_coach.cli
"""

from .agent import agent, create_agent
from .tools import ALL_TOOLS, get_health_summary, get_sleep_summary, log_food

__all__ = [
    "agent",
    "create_agent",
    "ALL_TOOLS",
    "get_sleep_summary",
    "get_health_summary",
    "log_food",
]
