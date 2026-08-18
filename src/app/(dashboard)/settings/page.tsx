"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppleHealthIntegration } from "@/components/integrations/apple-health-integration";

interface UserSettings {
  units?: string;
  timezone?: string;
  sleepTargetHours?: number;
  calorieTarget?: number;
  proteinTargetG?: number;
  stepsTarget?: number;
  notificationsEnabled?: boolean;
}

const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "Hawaii (UTC-10)" },
  { value: "America/Los_Angeles", label: "Pacific Time (UTC-8)" },
  { value: "America/Denver", label: "Mountain Time (UTC-7)" },
  { value: "America/Chicago", label: "Central Time (UTC-6)" },
  { value: "America/New_York", label: "Eastern Time (UTC-5)" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "Europe/Paris", label: "Central Europe (UTC+1)" },
  { value: "Europe/Helsinki", label: "Eastern Europe (UTC+2)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Kolkata", label: "India (UTC+5:30)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+11)" },
  { value: "Pacific/Auckland", label: "New Zealand (UTC+13)" },
];

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

/** A ruled section of the sheet, numbered like a ledger entry. */
function Section({
  no,
  title,
  note,
  children,
}: {
  no: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between border-t border-[var(--lg-ink)] pb-5 pt-2.5">
        <span className="font-[family-name:var(--lg-mono)] text-[10px] font-bold tracking-[.14em] text-[var(--lg-acc)]">
          {no}
        </span>
        <span className="ledger-k">
          {title}
          {note ? ` — ${note}` : ""}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Label above a hairline-ruled field, in the ledger's small-caps voice. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-[family-name:var(--lg-mono)] text-[9px] uppercase tracking-[.2em] text-[var(--lg-mut)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full border-0 border-b border-[var(--lg-rule)] bg-transparent pb-1.5 text-[18px] font-light text-[var(--lg-ink)] outline-none transition-colors focus:border-[var(--lg-ink)] disabled:text-[var(--lg-mut)]";

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-6 border border-[var(--lg-ink)] px-5 py-2 font-[family-name:var(--lg-mono)] text-[10px] uppercase tracking-[.2em] text-[var(--lg-ink)] transition-colors hover:bg-[var(--lg-ink)] hover:text-[var(--lg-paper)] disabled:border-[var(--lg-g3)] disabled:text-[var(--lg-g3)] disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
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
    timezone: "Asia/Kolkata",
  });

  const [goals, setGoals] = useState({
    sleepTarget: "8",
    calorieTarget: "2000",
    proteinTarget: "150",
    stepsTarget: "10000",
  });

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/user");
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();
        const user: UserProfile = data.user;

        setProfile({
          fullName: user.fullName || "",
          email: user.email || "",
          dateOfBirth: user.dateOfBirth || "",
          height: user.heightCm || "",
          weight: user.weightKg || "",
          timezone: user.settings?.timezone || "Asia/Kolkata",
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
          settings: { timezone: profile.timezone },
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

  return (
    <div className="ledger">
      <main className="mx-auto max-w-[980px]">
        <header>
          <div className="flex items-baseline justify-between border-b-2 border-[var(--lg-ink)] pb-4">
            <div className="text-[74px] font-extralight leading-none">Settings</div>
            <div className="text-center">
              <div className="text-[13px] font-semibold uppercase tracking-[.44em]">
                Olympus · The Masthead
              </div>
              <div className="ledger-k mt-1.5">Who you are, and what counts as a good day</div>
            </div>
          </div>

          <nav className="flex justify-between pt-2 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em]">
            <Link href="/" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
              ← BACK TO TODAY
            </Link>
            <span className="flex gap-2">
              <Link href="/" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                TODAY
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <Link href="/station" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                STATION
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <Link href="/history" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                ALMANAC
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <Link href="/blood-work" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                BLOOD WORK
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <span className="font-bold text-[var(--lg-acc)]">SETTINGS</span>
            </span>
            {/* Balances the leading link so the room list stays centred; the
                settings room has no next page to offer. */}
            <span />
          </nav>
        </header>

        {error && (
          <p className="mt-6 border-l-2 border-[var(--lg-acc)] pl-4 text-[14px] text-[var(--lg-acc)]">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-16 font-[family-name:var(--lg-mono)] text-[11px] tracking-[.2em] text-[var(--lg-mut)]">
            LOADING YOUR PROFILE…
          </p>
        ) : (
          <>
            <Section no="1.1" title="Profile" note="the constants behind every score">
              <div className="grid grid-cols-3 gap-x-10 gap-y-7">
                <Field label="Full name">
                  <input
                    className={inputClass}
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input className={inputClass} value={profile.email} disabled />
                </Field>
                <Field label="Date of birth">
                  <input
                    type="date"
                    className={inputClass}
                    value={profile.dateOfBirth}
                    onChange={(e) =>
                      setProfile({ ...profile, dateOfBirth: e.target.value })
                    }
                  />
                </Field>
                <Field label="Height (cm)">
                  <input
                    type="number"
                    className={inputClass}
                    value={profile.height}
                    onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                  />
                </Field>
                <Field label="Weight (kg)">
                  <input
                    type="number"
                    className={inputClass}
                    value={profile.weight}
                    onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                  />
                </Field>
                <Field label="Timezone">
                  <select
                    className={inputClass}
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="mt-4 font-[family-name:var(--lg-mono)] text-[9px] tracking-[.1em] text-[var(--lg-mut)]">
                THE TIMEZONE DECIDES WHERE EACH DAY STARTS AND ENDS ON THE LEDGER.
              </p>
              <ActionButton onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving…" : profileSaved ? "✓ Saved" : "Save profile"}
              </ActionButton>
            </Section>

            <Section no="1.2" title="Daily targets" note="what the ledger measures you against">
              <div className="grid grid-cols-4 gap-x-10">
                <Field label="Sleep (hours)">
                  <input
                    type="number"
                    className={inputClass}
                    value={goals.sleepTarget}
                    onChange={(e) => setGoals({ ...goals, sleepTarget: e.target.value })}
                  />
                </Field>
                <Field label="Calories (kcal)">
                  <input
                    type="number"
                    className={inputClass}
                    value={goals.calorieTarget}
                    onChange={(e) => setGoals({ ...goals, calorieTarget: e.target.value })}
                  />
                </Field>
                <Field label="Protein (g)">
                  <input
                    type="number"
                    className={inputClass}
                    value={goals.proteinTarget}
                    onChange={(e) => setGoals({ ...goals, proteinTarget: e.target.value })}
                  />
                </Field>
                <Field label="Steps">
                  <input
                    type="number"
                    className={inputClass}
                    value={goals.stepsTarget}
                    onChange={(e) => setGoals({ ...goals, stepsTarget: e.target.value })}
                  />
                </Field>
              </div>
              <ActionButton onClick={handleSaveGoals} disabled={savingGoals}>
                {savingGoals ? "Saving…" : goalsSaved ? "✓ Saved" : "Save targets"}
              </ActionButton>
            </Section>

            <Section no="1.3" title="The wire" note="where the numbers come from">
              <AppleHealthIntegration />
            </Section>
          </>
        )}

        <footer className="mt-10 border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
          <Link href="/" className="hover:text-[var(--lg-ink)]">
            Back to today
          </Link>
        </footer>
      </main>
    </div>
  );
}
