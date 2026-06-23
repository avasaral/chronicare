import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SearchResult = {
  type: "medication" | "daily_tracker" | "lab" | "visit";
  id: string;
  label: string;
  snippet: string;
  href: string;
};

function extractSnippet(
  text: string | null,
  keyword: string,
  fieldLabel: string
): string | null {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + keyword.length + 50);
  let s = text.slice(start, end).trim();
  if (start > 0) s = "…" + s;
  if (end < text.length) s = s + "…";
  return `${fieldLabel}: ${s}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  // Strip characters that break PostgREST filter syntax
  const keyword = q.replace(/[.,()"/\\]/g, "").trim();
  if (!keyword) return NextResponse.json({ results: [] });

  const pattern = `%${keyword}%`;
  const results: SearchResult[] = [];

  const [medsRes, trackerRes, visitsRes, labsRes] = await Promise.all([
    supabase
      .from("medications")
      .select("id, name, notes, side_effects")
      .or(
        `name.ilike.${pattern},notes.ilike.${pattern},side_effects.ilike.${pattern}`
      )
      .limit(10),

    supabase
      .from("daily_tracker")
      .select(
        "id, date, breakfast, morning_snack, lunch, evening_snack, dinner, exercise, medication_details, school_notes, skills_notes, notes"
      )
      .or(
        `breakfast.ilike.${pattern},morning_snack.ilike.${pattern},lunch.ilike.${pattern},evening_snack.ilike.${pattern},dinner.ilike.${pattern},exercise.ilike.${pattern},medication_details.ilike.${pattern},school_notes.ilike.${pattern},skills_notes.ilike.${pattern},notes.ilike.${pattern}`
      )
      .order("date", { ascending: false })
      .limit(10),

    supabase
      .from("medical_visits")
      .select("id, visit_date, provider_name, extracted_text, notes")
      .or(
        `provider_name.ilike.${pattern},extracted_text.ilike.${pattern},notes.ilike.${pattern}`
      )
      .order("visit_date", { ascending: false })
      .limit(10),

    // Lab results: fetch all, filter jsonb test_name in TypeScript
    supabase
      .from("lab_results")
      .select("id, report_date, source_filename, source_lab, extracted_json")
      .order("report_date", { ascending: false }),
  ]);

  // Medications
  for (const med of medsRes.data ?? []) {
    const s =
      extractSnippet(med.name, keyword, "Name") ??
      extractSnippet(med.notes, keyword, "Notes") ??
      extractSnippet(med.side_effects, keyword, "Side effects") ??
      "";
    results.push({
      type: "medication",
      id: med.id,
      label: med.name,
      snippet: s,
      href: "/medications",
    });
  }

  // Daily Tracker
  for (const entry of trackerRes.data ?? []) {
    const fields: [string | null, string][] = [
      [entry.breakfast, "Breakfast"],
      [entry.morning_snack, "Morning snack"],
      [entry.lunch, "Lunch"],
      [entry.evening_snack, "Evening snack"],
      [entry.dinner, "Dinner"],
      [entry.exercise, "Exercise"],
      [entry.medication_details, "Medication"],
      [entry.school_notes, "School"],
      [entry.skills_notes, "Skills"],
      [entry.notes, "Notes"],
    ];
    const s =
      fields.reduce<string | null>(
        (acc, [val, label]) => acc ?? extractSnippet(val, keyword, label),
        null
      ) ?? "";
    results.push({
      type: "daily_tracker",
      id: entry.id,
      label: formatDate(entry.date),
      snippet: s,
      href: "/daily-tracker",
    });
  }

  // Visits
  for (const visit of visitsRes.data ?? []) {
    const s =
      extractSnippet(visit.provider_name, keyword, "Provider") ??
      extractSnippet(visit.extracted_text, keyword, "Notes") ??
      extractSnippet(visit.notes, keyword, "Notes") ??
      "";
    results.push({
      type: "visit",
      id: visit.id,
      label: `${formatDate(visit.visit_date)} · ${visit.provider_name}`,
      snippet: s,
      href: "/visits",
    });
  }

  // Labs — TypeScript-side filtering for jsonb test_name + text fields
  const kLower = keyword.toLowerCase();
  let labCount = 0;
  for (const lab of labsRes.data ?? []) {
    if (labCount >= 10) break;

    const fnMatch = extractSnippet(lab.source_filename, keyword, "File");
    const slMatch = extractSnippet(lab.source_lab, keyword, "Lab");

    let testMatch: string | null = null;
    if (Array.isArray(lab.extracted_json)) {
      for (const row of lab.extracted_json as {
        test_name?: string;
        value?: string;
        unit?: string;
      }[]) {
        if (row.test_name?.toLowerCase().includes(kLower)) {
          testMatch = `Test: ${row.test_name}${row.value ? ` = ${row.value}` : ""}${row.unit ? ` ${row.unit}` : ""}`;
          break;
        }
      }
    }

    const s = fnMatch ?? slMatch ?? testMatch;
    if (s) {
      results.push({
        type: "lab",
        id: lab.id,
        label: `${formatDate(lab.report_date)} · ${lab.source_filename}`,
        snippet: s,
        href: "/labs",
      });
      labCount++;
    }
  }

  return NextResponse.json({ results });
}
