import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Activity, FlaskConical, Pill } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: meds }, { data: todayLog }, { data: lastLab }] =
    await Promise.all([
      supabase
        .from("medications")
        .select("name")
        .order("start_date", { ascending: false }),
      supabase
        .from("daily_tracker")
        .select("id")
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("lab_results")
        .select("report_date, source_filename")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const medications = meds ?? [];
  const symptomsLoggedToday = todayLog !== null;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">ChroniCare</h1>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Summary cards */}
        <div className="space-y-3">
          {/* Medications */}
          <Link
            href="/medications"
            className="flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-xs hover:border-foreground/20 transition-colors"
          >
            <Pill className="size-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">Medications</p>
                <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                  {medications.length}{" "}
                  {medications.length === 1 ? "active" : "active"}
                </span>
              </div>
              {medications.length > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  {medications.map((m) => m.name).join(", ")}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No medications added yet
                </p>
              )}
            </div>
          </Link>

          {/* Daily Tracker */}
          <Link
            href="/daily-tracker"
            className="flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-xs hover:border-foreground/20 transition-colors"
          >
            <Activity className="size-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">Daily Tracker</p>
                {symptomsLoggedToday ? (
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 shrink-0">
                    Logged today
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 shrink-0">
                    Not logged yet
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {symptomsLoggedToday
                  ? "Today's log is complete"
                  : "Tap to log today →"}
              </p>
            </div>
          </Link>

          {/* Labs */}
          <Link
            href="/labs"
            className="flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-xs hover:border-foreground/20 transition-colors"
          >
            <FlaskConical className="size-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Lab Results</p>
              {lastLab ? (
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  Last upload{" "}
                  <span className="text-foreground">
                    {formatDate(lastLab.report_date)}
                  </span>{" "}
                  · {lastLab.source_filename}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No reports uploaded yet
                </p>
              )}
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
