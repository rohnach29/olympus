# Olympus AI Coach

AI Health Coach powered by Llama 3.1 and LangGraph.

## Quick Start

```bash
# Install Ollama and pull the model
brew install ollama
ollama serve  # In a separate terminal
ollama pull llama3.1:8b

# Install and run
pip install -e .
python -m olympus_coach.cli
```

## Usage

Ask health questions:
- "How did I sleep last night?"
- "Give me a health summary"
- "Log 2 eggs for breakfast"
