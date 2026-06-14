import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SymptomsClient from "./SymptomsClient";

export default async function SymptomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const start = new Date();
  start.setDate(start.getDate() - 13);
  const startDate = start.toISOString().slice(0, 10);

  const { data: logs } = await supabase
    .from("symptom_logs")
    .select("id, date, energy, mood, appetite, pain_level, notes")
    .gte("date", startDate)
    .order("date", { ascending: false });

  const allLogs = logs ?? [];
  const todayLog = allLogs.find((l) => l.date === today) ?? null;

  return (
    <SymptomsClient userId={user.id} todayLog={todayLog} logs={allLogs} />
  );
}
