import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MedicationsClient from "./MedicationsClient";

export default async function MedicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: meds } = await supabase
    .from("medications")
    .select("id, name, dose, unit, frequency, start_date, notes, created_at")
    .order("start_date", { ascending: false });

  const medList = meds ?? [];

  // Fetch all dose_history for this user's medications in one query,
  // sorted DESC so index 0 per medication is always the most recent entry.
  let rawHistory: {
    id: string;
    medication_id: string;
    dose: number;
    changed_at: string;
    notes: string | null;
  }[] = [];

  if (medList.length > 0) {
    const { data: h } = await supabase
      .from("dose_history")
      .select("id, medication_id, dose, changed_at, notes")
      .in(
        "medication_id",
        medList.map((m) => m.id)
      )
      .order("changed_at", { ascending: false });
    rawHistory = h ?? [];
  }

  // Group history by medication and compute current_dose server-side.
  // current_dose = dose_history[0].dose (most recent by changed_at DESC),
  // falling back to medications.dose only when dose_history is empty.
  const initialMedications = medList.map((med) => {
    const history = rawHistory.filter((h) => h.medication_id === med.id);
    const current_dose = history.length > 0 ? history[0].dose : med.dose;
    return { ...med, current_dose, dose_history: history };
  });

  return (
    <MedicationsClient
      userId={user.id}
      initialMedications={initialMedications}
    />
  );
}
