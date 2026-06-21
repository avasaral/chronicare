import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TimelineClient from "./TimelineClient";
import type { LabRow } from "../labs/page";

export type TimelineLabResult = {
  id: string;
  report_date: string;
  source_filename: string;
  source_lab: string | null;
  extracted_json: LabRow[];
  created_at: string;
};

export type TimelineVisit = {
  id: string;
  visit_date: string;
  provider_name: string;
  provider_specialty: string;
  visit_format: string;
  extracted_text: string;
  notes: string | null;
  created_at: string;
};

export default async function TimelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: labs }, { data: visits }] = await Promise.all([
    supabase
      .from("lab_results")
      .select(
        "id, report_date, source_filename, source_lab, extracted_json, created_at"
      )
      .order("report_date", { ascending: false }),
    supabase
      .from("medical_visits")
      .select(
        "id, visit_date, provider_name, provider_specialty, visit_format, extracted_text, notes, created_at"
      )
      .order("visit_date", { ascending: false }),
  ]);

  return <TimelineClient labs={labs ?? []} visits={visits ?? []} />;
}
