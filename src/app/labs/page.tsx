import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LabsClient from "./LabsClient";

type LabResult = {
  id: string;
  report_date: string;
  source_filename: string;
  extracted_json: LabRow[];
  source_lab: string | null;
  created_at: string;
};

export type LabRow = {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  flag: "normal" | "low" | "high";
  category?: string | null;
};

export default async function LabsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("lab_results")
    .select("id, report_date, source_filename, extracted_json, source_lab, created_at")
    .order("created_at", { ascending: false });

  return <LabsClient userId={user.id} previousResults={data ?? []} />;
}
