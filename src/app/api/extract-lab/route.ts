import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tries common Indian lab filename date formats as a last resort.
// Prefers YYYY-MM-DD, then DD-MM-YYYY / DD.MM.YYYY / DD/MM/YYYY.
function parseDateFromFilename(filename: string): string | null {
  const iso = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = filename.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3];
    const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
    if (!isNaN(date.getTime())) return `${y}-${m}-${d}`;
  }

  return null;
}

const SYSTEM_PROMPT =
  `You are a medical document parser. Extract all lab test results and the report date from this document.
Return ONLY a JSON object with no other text:
{
  "report_date": "YYYY-MM-DD",
  "results": [{"test_name": "...", "value": "...", "unit": "...", "reference_range": "...", "flag": "normal|low|high"}]
}
For report_date use the date printed on the lab report in YYYY-MM-DD format. If you cannot find a date, return null.
For flag use "normal", "low", or "high". If reference_range is not available set it to null.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  // Upload to Supabase Storage
  const storageFilename = `${user.id}/${crypto.randomUUID()}.pdf`;
  await supabase.storage
    .from("lab-reports")
    .upload(storageFilename, buffer, { contentType: "application/pdf" });
  // Continue even if storage upload fails — the extraction is the critical path.

  // Call Claude API with the PDF
  let extracted: unknown[];
  let reportDate: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            { type: "text", text: "Extract all lab test results." },
          ],
        },
      ],
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
    // Accept both the new {report_date, results} shape and the legacy bare array
    extracted = Array.isArray(parsed) ? parsed : parsed.results ?? [];
    if (!Array.isArray(extracted)) throw new Error("Expected array");
    reportDate =
      (!Array.isArray(parsed) && typeof parsed.report_date === "string"
        ? parsed.report_date
        : null) ??
      parseDateFromFilename(file.name) ??
      new Date().toISOString().slice(0, 10);
  } catch (err) {
    return NextResponse.json(
      { error: "Extraction failed", detail: String(err) },
      { status: 500 }
    );
  }

  // Save to lab_results
  const { error: dbError } = await supabase.from("lab_results").insert({
    user_id: user.id,
    report_date: reportDate,
    source_filename: file.name,
    extracted_json: extracted,
  });

  if (dbError) {
    return NextResponse.json(
      { error: "Database error", detail: dbError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ results: extracted });
}
