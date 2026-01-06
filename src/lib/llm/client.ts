// LLM Client - Supports Ollama (local or remote) and Groq (production)

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
}

// Configuration from environment
const LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "deepseek-r1:7b";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

// Health coach system prompt
export const HEALTH_COACH_SYSTEM_PROMPT = `You are Olympus AI, a knowledgeable and supportive health and wellness coach. Your role is to:

1. Provide evidence-based guidance on nutrition, exercise, sleep, and recovery
2. Analyze user health data to offer personalized insights
3. Answer questions about fitness, nutrition, and general wellness
4. Motivate and encourage users on their health journey

IMPORTANT GUIDELINES:
- Never diagnose medical conditions or diseases
- Never recommend stopping or changing prescribed medications
- For symptoms suggesting medical emergency, direct to emergency services
- For persistent or concerning symptoms, recommend consulting a healthcare provider
- Frame all advice as general wellness guidance, not medical advice
- Be supportive and encouraging while being honest about limitations

When analyzing data, look for:
- Trends and patterns in metrics
- Correlations between behaviors and outcomes (sleep vs recovery, nutrition vs energy)
- Areas for improvement based on user goals
- Positive progress to celebrate

Keep responses concise but informative. Use bullet points for clarity when appropriate.`;

/**
 * Generate response using Ollama
 * Works with both local Ollama and remote Ollama on GPU server
 *
 * To use remote GPU server:
 * 1. On GPU server: ollama serve --host 0.0.0.0
 * 2. Set OLLAMA_HOST=http://YOUR_GPU_IP:11434
 * 3. Set OLLAMA_MODEL=deepseek-r1:32b (or larger)
 */
async function generateWithOllama(
  messages: ChatMessage[]
): Promise<LLMResponse> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages,
        stream: false,
        options: {
          // Adjust based on your GPU capabilities
          num_ctx: 8192, // Context window
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || "I apologize, I couldn't generate a response.",
      model: OLLAMA_MODEL,
    };
  } catch (error) {
    console.error("Ollama error:", error);

    // Provide helpful error message
    const isRemote = OLLAMA_HOST !== "http://localhost:11434";
    const suggestion = isRemote
      ? `Make sure Ollama is running on your GPU server (${OLLAMA_HOST}) with: ollama serve --host 0.0.0.0`
      : "Make sure Ollama is running locally with: ollama serve";

    throw new Error(`Failed to connect to Ollama. ${suggestion}`);
  }
}

/**
 * Generate response using Groq API
 * Very cheap: ~$0.05 per 1M tokens
 */
async function generateWithGroq(messages: ChatMessage[]): Promise<LLMResponse> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Groq error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || "I apologize, I couldn't generate a response.",
      model: GROQ_MODEL,
    };
  } catch (error) {
    console.error("Groq error:", error);
    throw error;
  }
}

/**
 * Generate response using vLLM (alternative to Ollama for production)
 * Use this if you set up vLLM on your GPU server
 */
async function generateWithVLLM(messages: ChatMessage[]): Promise<LLMResponse> {
  const VLLM_HOST = process.env.VLLM_HOST || "http://localhost:8000";
  const VLLM_MODEL = process.env.VLLM_MODEL || "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B";

  try {
    const response = await fetch(`${VLLM_HOST}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || "I apologize, I couldn't generate a response.",
      model: VLLM_MODEL,
    };
  } catch (error) {
    console.error("vLLM error:", error);
    throw error;
  }
}

/**
 * Main function to generate LLM response
 * Automatically routes to the configured provider
 */
export async function generateResponse(
  messages: ChatMessage[]
): Promise<LLMResponse> {
  // Add system prompt if not present
  if (messages.length === 0 || messages[0].role !== "system") {
    messages = [
      { role: "system", content: HEALTH_COACH_SYSTEM_PROMPT },
      ...messages,
    ];
  }

  switch (LLM_PROVIDER) {
    case "groq":
      return generateWithGroq(messages);
    case "vllm":
      return generateWithVLLM(messages);
    case "ollama":
    default:
      return generateWithOllama(messages);
  }
}

/**
 * Generate health insights based on user data
 */
export async function generateHealthInsight(
  userContext: string,
  query: string
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: HEALTH_COACH_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is my recent health data:

${userContext}

My question: ${query}`,
    },
  ];

  const response = await generateResponse(messages);
  return response.content;
}

/**
 * Check if LLM is available
 */
export async function checkLLMHealth(): Promise<{
  available: boolean;
  provider: string;
  model: string;
  host?: string;
  error?: string;
}> {
  try {
    if (LLM_PROVIDER === "groq") {
      if (!GROQ_API_KEY) {
        return {
          available: false,
          provider: "groq",
          model: GROQ_MODEL,
          error: "GROQ_API_KEY not configured",
        };
      }
      await generateWithGroq([
        { role: "user", content: "Say 'ok' if you're working." },
      ]);
      return { available: true, provider: "groq", model: GROQ_MODEL };
    } else if (LLM_PROVIDER === "vllm") {
      const VLLM_HOST = process.env.VLLM_HOST || "http://localhost:8000";
      const response = await fetch(`${VLLM_HOST}/health`);
      return {
        available: response.ok,
        provider: "vllm",
        model: process.env.VLLM_MODEL || "unknown",
        host: VLLM_HOST,
      };
    } else {
      // Test Ollama connection
      const response = await fetch(`${OLLAMA_HOST}/api/tags`);
      if (!response.ok) {
        throw new Error("Cannot connect to Ollama");
      }
      return {
        available: true,
        provider: "ollama",
        model: OLLAMA_MODEL,
        host: OLLAMA_HOST,
      };
    }
  } catch (error) {
    return {
      available: false,
      provider: LLM_PROVIDER,
      model: LLM_PROVIDER === "groq" ? GROQ_MODEL : OLLAMA_MODEL,
      host: OLLAMA_HOST,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
