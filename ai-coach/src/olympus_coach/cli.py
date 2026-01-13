"""
CLI Interface for Olympus AI Coach

This provides a simple interactive chat interface to test your agent.
Run with: python -m olympus_coach.cli

WHAT YOU'LL LEARN (for new grads):

1. **Dotenv loading**: Environment variables (DATABASE_URL, etc.) are loaded
   from a .env file before the agent is imported.

2. **Message history**: We maintain a list of messages across turns so the
   agent has context of the conversation.

3. **Error handling**: LLM inference can fail (Ollama not running, model not
   pulled, etc.). We catch and display errors gracefully.

4. **Token streaming** (future): For better UX, you can stream tokens as they
   generate instead of waiting for the full response. This is left as an
   exercise.
"""

import sys
from pathlib import Path

# Load environment variables before importing anything else
# This ensures DATABASE_URL and USER_ID are available
from dotenv import load_dotenv
import os

# Try multiple .env locations (handles different run contexts)
possible_env_paths = [
    Path(__file__).parent.parent.parent / ".env",  # From package: src/olympus_coach/cli.py -> ai-coach/.env
    Path.cwd() / ".env",  # Current working directory
    Path.cwd().parent / ".env",  # Parent of cwd
]

env_loaded = False
for env_path in possible_env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        env_loaded = True
        break

if not env_loaded:
    print("Warning: No .env file found. Checked:")
    for p in possible_env_paths:
        print(f"  - {p}")
    print("\nMake sure DATABASE_URL and OLYMPUS_USER_ID are set.")

# Verify required env vars
if not os.getenv("DATABASE_URL"):
    print("\nError: DATABASE_URL not set.")
    print("Create ai-coach/.env with:")
    print('  DATABASE_URL="postgresql://..."')
    print('  OLYMPUS_USER_ID="your-uuid"')
    sys.exit(1)


def main():
    """Main entry point for the CLI."""
    # Import agent after env vars are loaded
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    from .agent import create_agent

    print("=" * 60)
    print("  Olympus AI Coach (Llama 3.1:8B)")
    print("  Powered by LangGraph + Ollama")
    print("=" * 60)
    print()
    print("Commands:")
    print("  Type your health question and press Enter")
    print("  'quit' or 'exit' to leave")
    print("  'clear' to reset conversation")
    print()

    # Check Ollama is running
    try:
        agent = create_agent()
    except Exception as e:
        print(f"Error initializing agent: {e}")
        print()
        print("Make sure Ollama is running:")
        print("  1. brew install ollama")
        print("  2. ollama serve")
        print("  3. ollama pull llama3.1:8b")
        sys.exit(1)

    # Conversation history (persists across turns within this session)
    messages: list = []

    while True:
        try:
            # Get user input
            user_input = input("\nYou: ").strip()

            # Handle commands
            if not user_input:
                continue
            if user_input.lower() in ("quit", "exit", "q"):
                print("\nGoodbye! Stay healthy.")
                break
            if user_input.lower() == "clear":
                messages = []
                print("\n[Conversation cleared]")
                continue
            if user_input.lower() == "debug":
                # Show raw message history (useful for debugging)
                print("\n[Message History]")
                for i, msg in enumerate(messages):
                    print(f"  {i}: {type(msg).__name__}: {str(msg.content)[:100]}...")
                continue

            # Add user message to history
            messages.append(HumanMessage(content=user_input))

            # Invoke the agent
            print("\nCoach: ", end="", flush=True)

            try:
                result = agent.invoke({"messages": messages})

                # Extract the new messages from the result
                new_messages = result["messages"]

                # Update our message history with all new messages
                # (This includes any tool calls and their results)
                messages = new_messages

                # Find the last AI message to display
                for msg in reversed(new_messages):
                    if isinstance(msg, AIMessage) and msg.content:
                        print(msg.content)
                        break
                else:
                    print("[No response generated]")

            except Exception as e:
                error_msg = str(e)
                if "Connection refused" in error_msg:
                    print(f"\nError: Cannot connect to Ollama. Is it running?")
                    print("  Run: ollama serve")
                elif "model" in error_msg.lower() and "not found" in error_msg.lower():
                    print(f"\nError: Model not found. Pull it first:")
                    print("  Run: ollama pull llama3.1:8b")
                else:
                    print(f"\nError: {e}")
                # Remove the failed user message from history
                messages = messages[:-1] if messages else []

        except KeyboardInterrupt:
            print("\n\nInterrupted. Type 'quit' to exit.")
            continue
        except EOFError:
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
