import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_settings")
    .select("next_lab_draw_date")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ next_lab_draw_date: data?.next_lab_draw_date ?? null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const nextLabDrawDate: string | null = body.next_lab_draw_date || null;

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, next_lab_draw_date: nextLabDrawDate, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ next_lab_draw_date: nextLabDrawDate });
}
