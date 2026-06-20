import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIZE_PROMPT =
  `You are a medical lab data enricher. Given a JSON array of lab test result objects, add a "category" field to each entry.
Use standard lab panel categories (e.g. "CBC", "LFT", "Inflammatory Markers", "Electrolytes", "Lipid Profile", "Thyroid Function", "Renal Function", "Urinalysis") — infer the category from the test_name. Do not use a fixed list; choose whatever category is clinically appropriate.
Return ONLY the updated JSON array with no other text, markdown, or explanation.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let id: string;
  try {
    ({ id } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: row, error: fetchErr } = await supabase
    .from("lab_results")
    .select("id, extracted_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !row)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = Array.isArray(row.extracted_json) ? row.extracted_json : [];

  let enriched: unknown[];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: CATEGORIZE_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(existing) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text")
      throw new Error("No text block in response");

    const raw = textBlock.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    enriched = JSON.parse(raw);
    if (!Array.isArray(enriched)) throw new Error("Expected array");
  } catch (err) {
    return NextResponse.json(
      { error: "Enrichment failed", detail: String(err) },
      { status: 500 }
    );
  }

  const { error: updateErr } = await supabase
    .from("lab_results")
    .update({ extracted_json: enriched })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: enriched.length });
}
