import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VisitsClient from "./VisitsClient";

export type MedicalVisit = {
  id: string;
  visit_date: string;
  provider_name: string;
  provider_specialty: string;
  visit_format: string;
  source_type: string;
  raw_image_path: string | null;
  extracted_text: string;
  notes: string | null;
  created_at: string;
};

export default async function VisitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("medical_visits")
    .select(
      "id, visit_date, provider_name, provider_specialty, visit_format, source_type, raw_image_path, extracted_text, notes, created_at"
    )
    .order("visit_date", { ascending: false });

  return <VisitsClient userId={user.id} visits={data ?? []} />;
}
