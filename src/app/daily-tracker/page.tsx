import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DailyTrackerClient, { type DailyEntry } from "./DailyTrackerClient";

export default async function DailyTrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const start = new Date();
  start.setDate(start.getDate() - 13);
  const startDate = start.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_tracker")
    .select("*")
    .gte("date", startDate)
    .order("date", { ascending: false });

  const allLogs = (data ?? []) as DailyEntry[];
  const todayEntry = allLogs.find((l) => l.date === today) ?? null;

  return (
    <DailyTrackerClient
      userId={user.id}
      todayEntry={todayEntry}
      logs={allLogs}
    />
  );
}
