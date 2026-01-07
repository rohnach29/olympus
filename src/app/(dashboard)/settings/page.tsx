"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Target, Bell, Shield, Database, Loader2, Check } from "lucide-react";
import { AppleHealthIntegration } from "@/components/integrations/apple-health-integration";

interface UserSettings {
  units?: string;
  sleepTargetHours?: number;
  calorieTarget?: number;
  proteinTargetG?: number;
  stepsTarget?: number;
  notificationsEnabled?: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  heightCm: string | null;
  weightKg: string | null;
  settings: UserSettings | null;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [goalsSaved, setGoalsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    dateOfBirth: "",
    height: "",
    weight: "",
  });

  const [goals, setGoals] = useState({
    sleepTarget: "8",
    calorieTarget: "2000",
    proteinTarget: "150",
    stepsTarget: "10000",
  });

  // Fetch user data on mount
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/user");
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }
        const data = await response.json();
        const user: UserProfile = data.user;

        setProfile({
          fullName: user.fullName || "",
          email: user.email || "",
          dateOfBirth: user.dateOfBirth || "",
          height: user.heightCm || "",
          weight: user.weightKg || "",
        });

        if (user.settings) {
          setGoals({
            sleepTarget: String(user.settings.sleepTargetHours || 8),
            calorieTarget: String(user.settings.calorieTarget || 2000),
            proteinTarget: String(user.settings.proteinTargetG || 150),
            stepsTarget: String(user.settings.stepsTarget || 10000),
          });
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Failed to load your profile. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  // Save profile handler
  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileSaved(false);
    setError(null);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profile.fullName || null,
          dateOfBirth: profile.dateOfBirth || null,
          heightCm: profile.height ? parseFloat(profile.height) : null,
          weightKg: profile.weight ? parseFloat(profile.weight) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  // Save goals handler
  async function handleSaveGoals() {
    setSavingGoals(true);
    setGoalsSaved(false);
    setError(null);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            sleepTargetHours: parseFloat(goals.sleepTarget) || 8,
            calorieTarget: parseInt(goals.calorieTarget) || 2000,
            proteinTargetG: parseInt(goals.proteinTarget) || 150,
            stepsTarget: parseInt(goals.stepsTarget) || 10000,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save goals");
      }

      setGoalsSaved(true);
      setTimeout(() => setGoalsSaved(false), 3000);
    } catch (err) {
      console.error("Error saving goals:", err);
      setError(err instanceof Error ? err.message : "Failed to save goals");
    } finally {
      setSavingGoals(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({ ...profile, fullName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={profile.dateOfBirth}
                onChange={(e) =>
                  setProfile({ ...profile, dateOfBirth: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={profile.height}
                  onChange={(e) =>
                    setProfile({ ...profile, height: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={profile.weight}
                  onChange={(e) =>
                    setProfile({ ...profile, weight: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : profileSaved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved!
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Daily Goals
          </CardTitle>
          <CardDescription>Set your daily health targets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sleepTarget">Sleep Target (hours)</Label>
              <Input
                id="sleepTarget"
                type="number"
                value={goals.sleepTarget}
                onChange={(e) =>
                  setGoals({ ...goals, sleepTarget: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calorieTarget">Calorie Target (kcal)</Label>
              <Input
                id="calorieTarget"
                type="number"
                value={goals.calorieTarget}
                onChange={(e) =>
                  setGoals({ ...goals, calorieTarget: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proteinTarget">Protein Target (g)</Label>
              <Input
                id="proteinTarget"
                type="number"
                value={goals.proteinTarget}
                onChange={(e) =>
                  setGoals({ ...goals, proteinTarget: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stepsTarget">Steps Target</Label>
              <Input
                id="stepsTarget"
                type="number"
                value={goals.stepsTarget}
                onChange={(e) =>
                  setGoals({ ...goals, stepsTarget: e.target.value })
                }
              />
            </div>
          </div>
          <Button onClick={handleSaveGoals} disabled={savingGoals}>
            {savingGoals ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : goalsSaved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved!
              </>
            ) : (
              "Save Goals"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connected Devices
          </CardTitle>
          <CardDescription>Manage your device integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Apple Health Integration */}
          <AppleHealthIntegration />

          {/* Google Fit - Coming Soon */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Database className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Google Fit</p>
                <p className="text-sm text-muted-foreground">
                  Sync health data from Google Fit
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure your notification preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Daily Summary</p>
                <p className="text-sm text-muted-foreground">
                  Receive a daily health summary
                </p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Enabled
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Goal Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Reminders to log meals and workouts
                </p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Enabled
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AI Insights</p>
                <p className="text-sm text-muted-foreground">
                  Get notified about important health insights
                </p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Enabled
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Shield className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Data</p>
              <p className="text-sm text-muted-foreground">
                Download all your health data
              </p>
            </div>
            <Button variant="outline" disabled>
              Export
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and data
              </p>
            </div>
            <Button variant="destructive" disabled>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
