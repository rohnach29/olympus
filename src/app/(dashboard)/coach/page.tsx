"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  AlertCircle,
  Wrench,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

const STORAGE_KEY = "olympus-coach-messages";

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm your Olympus AI health coach powered by Llama. I have access to your health data and can help you understand your sleep, nutrition, workouts, blood work, and longevity metrics.\n\nI can also search the web for detailed nutrition and supplement information.\n\nWhat would you like to know?",
  timestamp: new Date(),
};

const suggestedQuestions = [
  "How did I sleep this week?",
  "What's my biological age?",
  "What did I eat today?",
  "Show my blood work results",
  "Search for vitamin D benefits",
  "What's my HRV trend?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<
    "checking" | "healthy" | "unhealthy"
  >("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const restored = parsed.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(restored);
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
    setIsHydrated(true);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save chat history:", e);
      }
    }
  }, [messages, isHydrated]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setMessages([welcomeMessage]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check server health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/ai/coach");
        if (response.ok) {
          setServerStatus("healthy");
        } else {
          setServerStatus("unhealthy");
        }
      } catch {
        setServerStatus("unhealthy");
      }
    };
    checkHealth();
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages
            .filter((m) => m.id !== "welcome")
            .concat(userMessage)
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to connect to AI coach";

      // Provide helpful context for common errors
      if (errorMsg.includes("not running") || errorMsg.includes("ECONNREFUSED")) {
        setError(
          "AI Coach server is not running. Start it with: cd ai-coach && uvicorn olympus_coach.server:app --port 8100"
        );
      } else if (errorMsg.includes("Ollama")) {
        setError("Ollama is not running. Start it with: ollama serve");
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Format tool names for display
  const formatToolName = (tool: string) => {
    return tool
      .replace(/_/g, " ")
      .replace(/get /gi, "")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Health Coach
          </h1>
          <p className="text-muted-foreground">
            Powered by Llama with access to your health data
          </p>
        </div>

        {/* Server Status & Actions */}
        <div className="flex items-center gap-2">
          {serverStatus === "checking" && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking...
            </Badge>
          )}
          {serverStatus === "healthy" && (
            <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Agent Ready
            </Badge>
          )}
          {serverStatus === "unhealthy" && (
            <Badge variant="secondary" className="gap-1 bg-red-500/10 text-red-600">
              <XCircle className="h-3 w-3" />
              Agent Offline
            </Badge>
          )}
          {messages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Clear chat</span>
            </Button>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="max-w-[80%] space-y-2">
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Tools Used Badge */}
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    <Wrench className="h-3 w-3 text-muted-foreground mt-0.5" />
                    {message.toolsUsed.map((tool) => (
                      <Badge
                        key={tool}
                        variant="outline"
                        className="text-xs py-0 h-5"
                      >
                        {formatToolName(tool)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {message.role === "user" && (
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-secondary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Analyzing your data...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="whitespace-pre-wrap">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Suggested Questions (show when few messages) */}
        {messages.length <= 2 && !isLoading && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => sendMessage(question)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your health data..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            AI provides general wellness guidance, not medical advice. Powered by
            Llama 3.1 with 18 health tools.
          </p>
        </div>
      </Card>
    </div>
  );
}
