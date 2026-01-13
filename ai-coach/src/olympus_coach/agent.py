"""
LangGraph Agent for Olympus AI Coach

ARCHITECTURE OVERVIEW (for new grads):

This file implements a ReAct (Reasoning + Acting) agent using LangGraph.
The agent follows this loop:

    ┌─────────────────────────────────────────┐
    │                                         │
    ▼                                         │
┌───────────────┐    has tool calls?    ┌─────┴─────┐
│    Agent      │──────────────────────►│   Tools   │
│ (Llama 3.1)   │         yes           │ (Execute) │
└───────┬───────┘                       └───────────┘
        │ no
        ▼
    [Return to User]

KEY CONCEPTS:

1. **StateGraph**: A directed graph where nodes are functions and edges are transitions.
   State (the conversation history) flows through the graph.

2. **MessagesState**: Built-in state schema that tracks a list of messages.
   Each message is either HumanMessage, AIMessage, or ToolMessage.

3. **ToolNode**: Pre-built node that executes tools when the LLM requests them.
   It reads tool_calls from the AIMessage and runs the corresponding functions.

4. **Conditional Edges**: The `should_continue` function decides whether to:
   - Route to "tools" node (if LLM requested tool calls)
   - End the conversation (if LLM gave a final answer)

WHY LANGGRAPH OVER LANGCHAIN?

LangChain chains are linear: A -> B -> C
LangGraph graphs can loop: A -> B -> A -> B -> C

This is essential for ReAct agents that need to:
1. Think about what tool to use
2. Call the tool
3. Observe the result
4. Decide if more tools are needed (loop back to step 1)
5. Finally give an answer

The loop is what makes agents "agentic" - they can take multiple actions
before responding, just like you would Google something multiple times
before answering a question.
"""

from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from .prompts import SYSTEM_PROMPT
from .tools import ALL_TOOLS


def create_agent(model_name: str = "llama3.1:8b", temperature: float = 0.1):
    """
    Create and compile the LangGraph agent.

    Args:
        model_name: Ollama model to use (default: llama3.1:8b)
        temperature: LLM temperature (0 = deterministic, 1 = creative)
                    Lower is better for tool calling accuracy.

    Returns:
        Compiled LangGraph that can be invoked with messages.

    Example:
        agent = create_agent()
        result = agent.invoke({"messages": [HumanMessage(content="How did I sleep?")]})
        print(result["messages"][-1].content)
    """

    # =========================================================================
    # STEP 1: Initialize the LLM
    # =========================================================================
    # ChatOllama connects to your local Ollama server (http://localhost:11434)
    # The model must be pulled first: `ollama pull llama3.1:8b`
    llm = ChatOllama(
        model=model_name,
        temperature=temperature,
    )

    # =========================================================================
    # STEP 2: Bind tools to the LLM
    # =========================================================================
    # This tells the LLM what tools are available and their schemas.
    # When the LLM wants to use a tool, it outputs a special "tool_calls" field
    # instead of plain text.
    llm_with_tools = llm.bind_tools(ALL_TOOLS)

    # =========================================================================
    # STEP 3: Define the agent node
    # =========================================================================
    # This function is called when it's the LLM's turn to respond.
    # It takes the current state (messages) and returns new messages to add.
    def call_model(state: MessagesState) -> dict:
        """
        Invoke the LLM with the current conversation history.

        The LLM will either:
        - Return a text response (if it has enough info to answer)
        - Return tool_calls (if it needs to fetch data first)
        """
        messages = state["messages"]

        # Add system prompt at the beginning if not already present
        # (This ensures the agent knows its role and rules)
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # =========================================================================
    # STEP 4: Define the routing logic
    # =========================================================================
    # After the LLM responds, we need to decide what to do next:
    # - If it made tool calls -> execute them (route to "tools")
    # - If it gave a final answer -> return to user (route to END)
    def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
        """
        Determine the next step based on the LLM's response.

        This is called after every agent turn. It checks if the LLM
        requested any tool calls. If so, we execute them. Otherwise,
        we're done and return to the user.
        """
        last_message = state["messages"][-1]

        # Check if the LLM wants to call tools
        # tool_calls is a list of {name, args} dicts
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"

        # No tool calls = final answer, end the loop
        return END

    # =========================================================================
    # STEP 5: Build the graph
    # =========================================================================
    # Now we wire everything together into a state machine.

    # Create the graph with our state schema
    graph = StateGraph(MessagesState)

    # Add nodes (the "boxes" in our flowchart)
    graph.add_node("agent", call_model)  # LLM reasoning
    graph.add_node("tools", ToolNode(ALL_TOOLS))  # Tool execution

    # Add edges (the "arrows" in our flowchart)
    graph.add_edge(START, "agent")  # Start by calling the agent

    # Conditional edge: after agent, check if we need tools or are done
    graph.add_conditional_edges(
        "agent",  # From node
        should_continue,  # Decision function
        {
            "tools": "tools",  # If should_continue returns "tools"
            END: END,  # If should_continue returns END
        },
    )

    # After tools execute, always go back to agent
    # (so it can see the results and decide what to do next)
    graph.add_edge("tools", "agent")

    # =========================================================================
    # STEP 6: Compile and return
    # =========================================================================
    # Compilation validates the graph and prepares it for execution.
    # The compiled graph is callable: graph.invoke({"messages": [...]})
    return graph.compile()


# Create a default agent instance for easy importing
# Usage: from olympus_coach.agent import agent
#        result = agent.invoke({"messages": [HumanMessage(content="...")]})
agent = create_agent()
