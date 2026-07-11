import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DAILY_LOG_SYSTEM_PROMPT = `You are a health data parser for a pediatric Crohn's disease tracker. Extract structured daily health data from a caregiver's free-text summary. Return ONLY a JSON object with the fields you can confidently extract. Use null for anything absent, ambiguous, or unclear — never guess.

Fields and valid values:
- mood: 1-5 integer (1=very bad, 5=great)
- energy: 1-5 integer
- pain_level: 1-5 integer
- stomach_pain: 0-3 integer (0=none, 1=mild, 2=moderate, 3=severe)
- bloating: 0-3 integer
- nausea: 0-3 integer
- loose_stools: 0-3 integer
- constipation: 0-3 integer
- bm_frequency: integer count for the day
- bm_consistency: 1-7 Bristol Stool Scale (1-2=hard, 3-4=normal, 5-7=loose)
- breakfast: text
- morning_snack: text
- lunch: text
- evening_snack: text
- dinner: text
- junk_sugar_flag: boolean
- exercise: text
- slept_at: "HH:MM" 24hr format
- woke_at: "HH:MM" 24hr format
- sleep_quality: 0-3 integer (0=poor, 1=fair, 2=good, 3=great)
- medication_taken: boolean
- medication_details: text
- school_notes: text
- skills_notes: text
- notes: text

Return only valid JSON, no preamble, no markdown fences.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: DAILY_LOG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text in Claude response" },
        { status: 500 }
      );
    }

    const raw = textBlock.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: "Parsing failed", detail: String(err) },
      { status: 500 }
    );
  }
}
