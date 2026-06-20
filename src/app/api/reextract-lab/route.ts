import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  LAB_SYSTEM_PROMPT,
  parseDateFromFilename,
  parseClaudeResponse,
} from "@/lib/lab-extraction";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Fetch the existing row
  const { data: row, error: fetchErr } = await supabase
    .from("lab_results")
    .select("id, created_at, storage_path, source_filename")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !row)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Locate the PDF — prefer the stored path; fall back to time-based discovery
  // (for rows uploaded before storage_path tracking was added).
  let storagePath: string | null = (row.storage_path as string | null) ?? null;

  if (!storagePath) {
    const { data: files } = await supabase.storage
      .from("lab-reports")
      .list(user.id as string, { sortBy: { column: "created_at", order: "asc" } });

    const rowTime = new Date(row.created_at as string).getTime();

    // The PDF upload precedes the DB insert by the time Claude processing takes (~5-60s).
    // Treat any file created within a 2-minute window before row.created_at as a candidate.
    const candidates = (files ?? [])
      .map((f) => ({
        ...f,
        ft: new Date((f.created_at as string | null) ?? 0).getTime(),
      }))
      .filter((f) => {
        const gap = rowTime - f.ft;
        return gap > 0 && gap < 120_000;
      })
      .sort(
        (a, b) => Math.abs(a.ft - rowTime) - Math.abs(b.ft - rowTime)
      );

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not locate the stored PDF for this report. The file may have been uploaded before path tracking was added or was deleted from storage.",
          code: "NO_PDF",
        },
        { status: 404 }
      );
    }

    storagePath = `${user.id}/${candidates[0].name}`;
  }

  // Download the PDF from Supabase Storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("lab-reports")
    .download(storagePath);

  if (dlErr || !fileData) {
    return NextResponse.json(
      { error: "Failed to download stored PDF", detail: dlErr?.message },
      { status: 500 }
    );
  }

  const base64 = Buffer.from(
    await (fileData as Blob).arrayBuffer()
  ).toString("base64");

  // Re-run Claude extraction with the canonical-category prompt
  let extracted: unknown[];
  let reportDate: string | null;
  let sourceLab: string | null;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: LAB_SYSTEM_PROMPT,
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
    if (!textBlock || textBlock.type !== "text")
      throw new Error("No text response");

    const raw = textBlock.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = parseClaudeResponse(raw);
    extracted = parsed.extracted;
    sourceLab = parsed.sourceLab;
    // Only update report_date if Claude found one; don't overwrite a correct date with null
    reportDate =
      parsed.reportDate ?? parseDateFromFilename(row.source_filename as string) ?? null;
  } catch (err) {
    return NextResponse.json(
      { error: "Extraction failed", detail: String(err) },
      { status: 500 }
    );
  }

  // Overwrite the existing row — never create a duplicate
  const updatePayload: Record<string, unknown> = {
    extracted_json: extracted,
    source_lab: sourceLab,
    storage_path: storagePath,
  };
  if (reportDate) updatePayload.report_date = reportDate;

  const { error: updateErr } = await supabase
    .from("lab_results")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    count: extracted.length,
    source_lab: sourceLab,
  });
}
