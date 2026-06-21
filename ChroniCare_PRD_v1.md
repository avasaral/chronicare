# ChroniCare — Product Requirements Document
**Status:** Active build — converged from 3 prior attempts (ChroniCare v0.1–v0.2, HealthLog, CareWeave) + Krishna's June 2026 reflection
**Owner:** Krishna (builder), Vidya (primary caregiver, co-user)
**Subject:** Ananya — pediatric Crohn's disease (small bowel) + autism
**Timeline:** Finish V1+V2 functional scope in 5 days, building on existing ChroniCare codebase (no rebuild)

---

## 1. Why this exists

Ananya has two overlapping chronic conditions — pediatric Crohn's of the small bowel and autism — that interact in ways that make tracking unusually important and unusually hard:

- Crohn's requires close monitoring of symptoms, diet, bowel movements, and medication response, with labs roughly every 10 days during active dose adjustment.
- Autism means Ananya has limited verbal self-reporting. Krishna and Vidya are the primary instrument for detecting a problem — through behavioral observation, not what Ananya says.
- The two conditions confound each other: a behavioral change could be a GI flare, a med side effect, a developmental moment, or just a bad day at school. Without a longitudinal record, it's nearly impossible to tell which.

This is not "a health record app." The job-to-be-done is **caregiver confidence and control**: walking into a specialist visit prepared instead of anxious, catching a concerning trend before it becomes a crisis, and having one trustworthy place holding the full story of what happened and why.

Three prior attempts (ChroniCare via Claude Code, HealthLog spec via Claude Code, CareWeave via Lovable) each captured part of this picture but none was carried to daily, functional use. ChroniCare is furthest along — it has a live, working V1 with real user feedback already collected from Vidya — so it is the base this PRD builds on. **Nothing here proposes a rebuild.**

---

## 2. Users

| User | Role |
|---|---|
| Vidya | Primary caregiver, day-to-day logger, heaviest hands-on user |
| Krishna | Behavioral observer, care advocate, builder of the tool |
| Dr. Lavenya (pediatric GI, Rainbow Hospital) | Consumer of summaries/timelines, not a logged-in user in V1/V2 |
| RDI coach / therapist | Consumer of behavioral/developmental notes, not a logged-in user in V1/V2 |

No self-serve signup. Accounts are created manually for Krishna and Vidya, as already implemented. A "provider view" (read-only, reduced-information) is the mechanism for doctors — not separate accounts.

**Near-term (post-V2, explicitly out of scope for the 5-day sprint):** 3–5 other trusted families. **Long-term vision:** a platform for caregivers of pediatric/adult chronic conditions generally — validated personal-use-first.

---

## 3. Scope decision: V1 + V2 only, fully functional, single-family

Given the 5-day constraint and the pattern across prior attempts (multiple restarts, never reaching daily use), the scope is deliberately narrowed:

**In scope this sprint:**
- V1 — Daily log/tracker with short-term trend display
- V2 — Historical record/archive: lab trending, medication timeline, doctor visit notes, birth-to-now record ingestion, exportable summary for specialists

**Explicitly out of scope this sprint (captured for later, not forgotten):**
- V3 — Insights/intelligence, early-warning indicators, pattern detection across data types
- V4 — Linked external research/resources (e.g., Crohn's & Colitis UK food guidance)
- Multi-family scaling, HIPAA-grade infrastructure, self-serve onboarding, billing
- PHI migration to user-owned cloud storage (Google Drive/OneDrive) — stays on the roadmap as a pre-multi-family requirement, not a pre-V2 one

**Rationale:** the biggest risk to this project isn't the tech, it's that the tool needs to become a *habit* before it becomes a *platform*. A fully working single-family tool used daily this week beats a scalable-but-unused platform next month. Security/scaling work for unknown future users buys nothing while the only users are Krishna and Vidya.

---

## 4. Design priority: device modes

This is new in this revision and should shape UI decisions directly — it wasn't explicit in any prior attempt:

| Mode | Primary device | Use case |
|---|---|---|
| **Input — daily log** | iPhone | Vidya/Krishna logging symptoms, food, meds, mood in the moment |
| **Input — records/history** | MacBook | Bulk upload of Epic MyChart exports, old labs, imaging, birth-to-now history |
| **Viewing — primary** | iPhone | Quick look-back, "how was she this week," checking dose history |
| **Viewing — doctor-facing** | iPad | Showing timeline/summary live in a consult, in-person or virtual |

**Implication for build order:** the Daily Tracker must be genuinely fast and comfortable as a one-handed iPhone form — this was Vidya's #1 complaint about V1 ("app was not usable on iPhone"). The doctor/provider view should be tested on iPad dimensions, not just assumed to scale down from desktop.

---

## 5. V1 — Daily Log / Tracker

### 5.1 What gets logged daily
Converged from Vidya's direct feedback (most authoritative — real usage) + Krishna's reflection + HealthLog's symptom taxonomy:

- **GI symptoms** — stomach pain, bloating, nausea, loose stools, constipation (severity, not just present/absent)
- **Bowel movements** — frequency, consistency (clinically important given small bowel Crohn's)
- **Food** — what she ate, with a flag for junk food/sugar intake (explicitly called out as Crohn's-relevant)
- **Physical activity / exercise**
- **Sleep** — hours, quality
- **Mood**
- **Pain level**
- **Energy**
- **Medication adherence** — was today's medication actually taken as prescribed (lives in Daily Tracker, not the medication page — per Vidya's explicit request)
- **School** — how the day went, notable happenings (good or bad) — framed as part of the *same* longitudinal picture, since med/condition changes can affect school performance
- **New skills learned** — developmental/behavioral, kept separate from physical symptoms
- **Free-form notes** — miscellaneous, catch-all

One entry per day; opens in update mode if today's entry already exists (existing V1 behavior — keep).

### 5.2 Short-term trend display
- 14-day list view with severity badges (already built — keep)
- Trend chart across the above dimensions (descoped from original V1, carried forward as a top priority — this is core to "V1 should show short-term trends," not optional polish)

### 5.3 Renaming
"Symptoms" tab → **"Daily Tracker"** (explicit user request from Vidya; reflects the expanded scope above)

---

## 6. V2 — Historical Record / Longitudinal Archive

### 6.1 Lab results
- Existing PDF upload → Claude extraction pipeline (Haiku, structured JSON) — keep as-is, it works
- ~~Add image upload support (JPG/PNG)~~ — **revised 2026-06-21**: this assumed a general Bangalore diagnostic-center pattern that doesn't match this family's actual labs, which send PDFs exclusively. Not a gap for this single-family build. If multi-family expansion (§2, near-term) surfaces a real WhatsApp-image case from another family, revisit then — don't speculatively build for a workflow no current user has.
- **Trend/comparison chart across multiple lab reports over time** — identified by Vidya as the single most clinically valuable missing feature. Top priority within V2.
- Lab appointment reminder (next draw date)

### 6.2 Medications
- Existing dose-history timeline logic — keep as-is (already correctly handles historical backfill and derives current dose from latest `changed_at`, after real debugging effort — don't touch this logic casually)
- Add **side effects field** per medication, per doctor guidance (in progress)
- Adherence now lives in Daily Tracker (see 5.1), not duplicated here

### 6.3 Doctor visit summaries
- New section: visit notes — in-person or virtual (Krishna noted many virtual visit summaries arrive via WhatsApp text — ingestion should accommodate pasted text, not just files)
- Therapist notes — same pattern
- Tag visits to relevant medication/dose changes and lab results where possible, to support the unified timeline (6.5)

### 6.4 Full medical history ingestion (birth to present)
- One-time bulk ingestion path for Epic MyChart exports, scanned/older records, and images — this is explicitly a MacBook-mode task, not an iPhone one
- Goal: backfill the longitudinal record so the timeline isn't just "since ChroniCare started," but covers Ananya's full history
- Reuses the same Claude-extraction pattern already validated for recent labs; older/scanned documents may need the image-support path from 6.1 rather than PDF-only

### 6.5 Unified timeline
- Single zoomable view combining labs, dose changes, visit notes, and Daily Tracker flags across all event types — described by Vidya as the feature that would make the longitudinal nature of the app *tangible* rather than implied across separate tabs
- This is the feature that most directly serves the "generate a summary/timeline for doctors" need from Krishna's reflection

### 6.6 Search
- Search across all of the above by medication name, symptom, date range, or keyword — directly from Krishna's stated need ("search for any specific medication or event")

### 6.7 Doctor/provider view
- Controlled, reduced-information view for sharing with Dr. Lavenya or other specialists — not a separate login, a view mode
- Should default to iPad-friendly layout, since this is the primary consult-room use case
- This functions as the "generate a summary to hand to doctors" capability — start with a clean, exportable/displayable timeline + one-page summary rather than a separate share-link/audit-log system (that's CareWeave-level infrastructure, appropriate for the multi-family phase, not this sprint)

---

## 7. Explicitly deferred to V3 (insights/intelligence)
Captured so it isn't lost, not built now:
- Early indicator / flare-risk detection from patterns across daily tracker + labs + meds
- AI-generated appointment-prep summary synthesizing recent records ahead of a specific visit
- Any form of predictive or anomaly-detection modeling

## 8. Explicitly deferred to V4 (external knowledge linking)
- Linking relevant research/resources (e.g., Crohn's & Colitis UK dietary guidance) contextually against logged symptoms/food

## 9. Explicitly deferred until multi-family expansion (post-V2, not this sprint)
- PHI migration out of Supabase Storage into user-owned cloud storage (Google Drive/OneDrive via OAuth) — important trust differentiator, but appropriately timed *before wider sharing*, not before the 5-day personal-use goal
- Multi-patient support (more than one child per account)
- Self-serve signup, expiring share links, audit logs, HIPAA-grade infra
- Further cost optimization on extraction (Gemini Flash, on-device models) — current Haiku cost (~$0.08–0.10/lab upload) is acceptable at single-family volume

---

## 10. Non-negotiable technical constraints carried forward
(from CLAUDE.md / DECISIONS.md discipline already established — keep enforcing)

- No mock or placeholder data, ever — always real data
- Inline forms, not modals (established pattern)
- Confirm-before-delete on destructive actions
- `router.refresh()` after mutations (established pattern)
- dose_history entries are delete-only, never editable — preserves clinical timeline integrity; any future "edit" need should be solved with an audit-trailed correction, not silent overwrite
- Current dose is always *derived* from dose_history's latest `changed_at`, never a separately maintained field
- CLAUDE.md and DECISIONS.md must be kept current as the app evolves — they do not update themselves; this is a manual discipline step, not automatic

---

## 11. Definition of done for this 5-day sprint

Not "feature-complete." Specifically:

1. Vidya can log a full day's Daily Tracker entry (section 5.1) comfortably on her iPhone in under 2 minutes
2. A lab report (PDF or image) can be uploaded and shows up correctly extracted, with at least a 2-report trend visible
3. At least one real historical record (MyChart export or old lab) has been backfilled, proving the ingestion path works on real data, not a test file
4. A doctor-facing view can be pulled up on an iPad and would be usable in an actual consult tomorrow
5. Krishna and Vidya have both logged real data daily through the build period — the app is being dogfooded, not just built

---

## 12. Source documents converged into this PRD
- `CHRONICARE_PROJECT_KNOWLEDGE.md` — primary base; live V1 build, real schema, real bugs/fixes, Vidya's direct feedback
- `HealthLog_Project_Knowledge.md` — contributed: tiered AI-summary context strategy, local-vs-cloud PHI sensitivity split, symptom taxonomy
- `longitudinal_health_tracker.txt` (CareWeave/Lovable draft) — contributed: digital-binder folder taxonomy, one-page summary concept, doctor-share mechanism (deferred to post-V2)
- Krishna's June 2026 reflection (this conversation) — contributed: explicit V1–V4 framing, device-mode split (iPhone/Mac/iPad), full birth-to-now history ingestion requirement, scope-lock decision (single-family, full-function, V1+V2 only)
