// Shared between extract-lab and reextract-lab routes.

export const LAB_SYSTEM_PROMPT = `You are a medical document parser. Extract all lab test results, the report date, and the laboratory/hospital name from this document.

Return ONLY a JSON object — no markdown, no explanation:
{
  "report_date": "YYYY-MM-DD",
  "source_lab": "Lab or hospital name, or null",
  "results": [
    {
      "test_name": "exact name as printed",
      "value": "numeric or text value",
      "unit": "unit string or null",
      "reference_range": "range as printed or null",
      "flag": "normal | low | high",
      "category": "..."
    }
  ]
}

Rules:
— report_date: date on the report in YYYY-MM-DD. Return null if not found.
— source_lab: name of the issuing lab or hospital (e.g. "Aster Clinical Lab", "Trilife Hospital"). Return null if not stated.
— flag: "normal", "low", or "high" based on the report's own flag indicator. Default to "normal" if not flagged.
— reference_range: as printed. Return null if not shown.
— category: use ONLY one of these canonical strings (pick the best match; use "Other / Uncategorized" if none fits):
  "CBC (Complete Blood Count)"      — Haemoglobin, WBC, RBC, Platelets, MCV, MCH, MCHC, Neutrophils, Lymphocytes, Eosinophils, Basophils, Monocytes, RDW, PCV, Reticulocytes, ESR (when part of CBC panel)
  "LFT (Liver Function Test)"       — SGOT/AST, SGPT/ALT, ALP, GGT, Bilirubin (total/direct/indirect), Total Protein, Albumin, Globulin, A:G Ratio
  "KFT (Kidney Function Test)"      — Urea, Creatinine, Uric Acid, eGFR, BUN
  "Inflammatory Markers"            — CRP, C-Reactive Protein, ESR (standalone), Ferritin (inflammatory context), Procalcitonin
  "Iron Studies"                    — Serum Iron, TIBC, Transferrin Saturation, Ferritin (iron panel context)
  "Electrolytes"                    — Sodium, Potassium, Chloride, Bicarbonate, Calcium, Magnesium, Phosphorus
  "Lipid Profile"                   — Total Cholesterol, HDL, LDL, VLDL, Triglycerides
  "Thyroid Panel"                   — TSH, T3, T4, Free T3, Free T4, Anti-TPO
  "Vitamins"                        — Vitamin B12, Vitamin D, Vitamin D3, Folate, Folic Acid, Vitamin A, Vitamin E
  "Stool Studies"                   — Fecal Calprotectin, Stool Occult Blood, Stool Culture, Ova & Cysts, Stool Routine
  "Pancreatic"                      — Amylase, Lipase
  "Other / Uncategorized"           — anything not fitting the above`;

// Tries common Indian lab filename date formats as fallback.
export function parseDateFromFilename(filename: string): string | null {
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

// Parse extracted JSON from Claude — handles both new {report_date, source_lab, results}
// shape and legacy bare array.
export function parseClaudeResponse(raw: string): {
  extracted: unknown[];
  reportDate: string | null;
  sourceLab: string | null;
} {
  const parsed = JSON.parse(raw);
  const extracted = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
  if (!Array.isArray(extracted)) throw new Error("Expected results array");

  const reportDate =
    !Array.isArray(parsed) && typeof parsed.report_date === "string"
      ? parsed.report_date
      : null;

  const sourceLab =
    !Array.isArray(parsed) &&
    typeof parsed.source_lab === "string" &&
    parsed.source_lab
      ? parsed.source_lab
      : null;

  return { extracted, reportDate, sourceLab };
}
