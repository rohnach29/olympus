"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Watch,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface Token {
  id: string;
  name: string;
  lastUsedAt: string | null;
  requestCount: number;
  isActive: boolean;
  createdAt: string;
}

interface SyncStatus {
  status: "connected" | "stale" | "never";
  lastSync: string | null;
  totalSyncs: number;
  hasActiveToken: boolean;
  weekStats: {
    syncs: number;
    metrics: number;
    sleepSessions: number;
    workouts: number;
  };
}

export function AppleHealthIntegration() {
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showNewTokenModal, setShowNewTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; webhookUrl: string } | null>(null);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [tokensRes, statusRes] = await Promise.all([
        fetch("/api/integrations/tokens"),
        fetch("/api/integrations/status"),
      ]);

      if (!tokensRes.ok || !statusRes.ok) {
        throw new Error("Failed to fetch integration data");
      }

      const tokensData = await tokensRes.json();
      const statusData = await statusRes.json();

      setTokens(tokensData.tokens || []);
      setSyncStatus(statusData);
    } catch (err) {
      console.error("Error fetching integration data:", err);
      setError("Failed to load integration data");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateToken() {
    if (!newTokenName.trim()) return;

    setCreatingToken(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create token");
      }

      const data = await response.json();

      // Get the full webhook URL
      const webhookUrl = `${window.location.origin}${data.webhookUrl}`;

      setNewToken({ token: data.token, webhookUrl });

      // Refresh token list
      const tokensRes = await fetch("/api/integrations/tokens");
      if (tokensRes.ok) {
        const tokensData = await tokensRes.json();
        setTokens(tokensData.tokens || []);
      }
    } catch (err) {
      console.error("Error creating token:", err);
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleRevokeToken(tokenId: string) {
    try {
      const response = await fetch(`/api/integrations/tokens?id=${tokenId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke token");
      }

      // Remove from list
      setTokens(tokens.filter((t) => t.id !== tokenId));
    } catch (err) {
      console.error("Error revoking token:", err);
      setError("Failed to revoke token");
    }
  }

  function handleCopy(text: string, type: "token" | "url") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleCloseNewTokenModal() {
    setShowNewTokenModal(false);
    setNewTokenName("");
    setNewToken(null);
  }

  function getStatusIcon() {
    if (!syncStatus) return null;

    switch (syncStatus.status) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "stale":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "never":
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  }

  function getStatusText() {
    if (!syncStatus) return "";

    switch (syncStatus.status) {
      case "connected":
        return "Connected";
      case "stale":
        return "Not synced recently";
      case "never":
        return "Not connected";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Watch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Apple Health</p>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Main Integration Card */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Watch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">Apple Health</p>
                {getStatusIcon()}
              </div>
              <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowNewTokenModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Token
            </Button>
          </div>
        </div>

        {/* Sync Stats */}
        {syncStatus && syncStatus.status !== "never" && (
          <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 text-sm">
            <div className="text-center">
              <p className="text-lg font-semibold">{syncStatus.weekStats.syncs}</p>
              <p className="text-muted-foreground text-xs">Syncs (7d)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{syncStatus.weekStats.metrics}</p>
              <p className="text-muted-foreground text-xs">Metrics</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{syncStatus.weekStats.sleepSessions}</p>
              <p className="text-muted-foreground text-xs">Sleep</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{syncStatus.weekStats.workouts}</p>
              <p className="text-muted-foreground text-xs">Workouts</p>
            </div>
          </div>
        )}

        {/* Token List */}
        {tokens.filter(t => t.isActive).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Active Tokens</p>
            {tokens.filter(t => t.isActive).map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-background"
              >
                <div>
                  <p className="font-medium text-sm">{token.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {token.lastUsedAt
                      ? `Last used: ${new Date(token.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}{" "}
                    | {token.requestCount} requests
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRevokeToken(token.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Setup Instructions */}
        {tokens.length === 0 && (
          <div className="p-4 rounded-lg border border-dashed text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">How to connect:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Download "Health Auto Export" app from the App Store ($5)</li>
              <li>Click "Add Token" above to generate your API credentials</li>
              <li>Configure the app with your webhook URL and token</li>
              <li>Your Apple Watch data will sync automatically!</li>
            </ol>
          </div>
        )}
      </div>

      {/* New Token Modal */}
      <Dialog open={showNewTokenModal} onOpenChange={handleCloseNewTokenModal}>
        <DialogContent className="sm:max-w-md">
          {!newToken ? (
            <>
              <DialogHeader>
                <DialogTitle>Create API Token</DialogTitle>
                <DialogDescription>
                  Generate a token to connect Health Auto Export to Olympus.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenName">Token Name</Label>
                  <Input
                    id="tokenName"
                    placeholder="e.g., iPhone 15 Pro"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A name to help you identify this token later.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseNewTokenModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateToken}
                  disabled={creatingToken || !newTokenName.trim()}
                >
                  {creatingToken ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Token"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Your API Token</DialogTitle>
                <DialogDescription className="text-amber-600">
                  Copy this token now - it won&apos;t be shown again!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newToken.token}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(newToken.token, "token")}
                    >
                      {copied === "token" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newToken.webhookUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(newToken.webhookUrl, "url")}
                    >
                      {copied === "url" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                  <p className="font-medium">Health Auto Export Settings:</p>
                  <p className="text-muted-foreground text-xs">
                    1. Go to Automations → REST API<br />
                    2. Set Method: POST<br />
                    3. Set URL: (your webhook URL)<br />
                    4. Add Header: Authorization: Bearer (your token)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseNewTokenModal}>
                  I&apos;ve saved my token
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
