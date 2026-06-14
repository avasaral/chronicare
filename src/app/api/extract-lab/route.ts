import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT =
  "You are a medical document parser. Extract all lab test results from this report. Return ONLY a JSON array with no other text: [{test_name, value, unit, reference_range, flag}] where flag is normal, low, or high. If reference range is not available set it to null.";

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
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
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
    extracted = JSON.parse(raw);
    if (!Array.isArray(extracted)) throw new Error("Expected array");
  } catch (err) {
    return NextResponse.json(
      { error: "Extraction failed", detail: String(err) },
      { status: 500 }
    );
  }

  // Save to lab_results
  const today = new Date().toISOString().slice(0, 10);
  const { error: dbError } = await supabase.from("lab_results").insert({
    user_id: user.id,
    report_date: today,
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
