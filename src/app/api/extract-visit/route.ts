import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VISIT_EXTRACTION_PROMPT = `You are a medical document reader. You will be shown an image of a doctor's visit note, prescription, or follow-up summary (possibly a WhatsApp screenshot, photo of handwritten notes, or printed document).

Your job:
1. Transcribe and summarize the visit content into clean, readable text. Preserve medical details faithfully — drug names, dosages, instructions, observations, next steps. Organize into short paragraphs or bullet points if the original is messy.
2. Extract the visit date if visible (appointment date, not "today"). Return in YYYY-MM-DD format.
3. Extract the doctor/provider name if visible.

Return ONLY a JSON object — no markdown, no explanation:
{
  "extracted_text": "clean transcription/summary of the visit note",
  "visit_date": "YYYY-MM-DD or null if not found",
  "provider_name": "Doctor name or null if not found"
}`;

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
  if (!file) {
    return NextResponse.json({ error: "Image file required" }, { status: 400 });
  }

  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !imageTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPEG, PNG, WebP, GIF, or PDF." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");

  const ext = file.name.split(".").pop()?.toLowerCase() || (isPdf ? "pdf" : "jpg");
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("visit-images")
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: "Storage upload failed", detail: uploadError.message },
      { status: 500 }
    );
  }

  try {
    const fileContent: Anthropic.Messages.ContentBlockParam = isPdf
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64,
          },
        };

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            { type: "text", text: VISIT_EXTRACTION_PROMPT },
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

    return NextResponse.json({
      extracted_text: parsed.extracted_text ?? "",
      visit_date: parsed.visit_date ?? null,
      provider_name: parsed.provider_name ?? null,
      raw_image_path: storagePath,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Extraction failed", detail: String(err) },
      { status: 500 }
    );
  }
}
