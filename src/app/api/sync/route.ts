import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Allowlist — only these tables can be accessed via the sync API.
// ---------------------------------------------------------------------------
const ALLOWED_TABLES = new Set([
  "animals",
  "farms",
  "clients",
  "animal_situations",
  "animal_statuses",
  "vaccines",
  "animal_metrics_weight",
  "animal_metrics_ce",
  "animal_vaccines",
  "reproduction_events",
  "deaths",
  "sales",
  "exchanges",
  "movements",
  "semen_doses",
  "organization_settings",
]);

// ---------------------------------------------------------------------------
// PK override: maps the client-side RxDB primary key to the actual Supabase
// column name when they differ between the old and new schema.
//
// reproduction_events: old schema used event_id; new schema uses id (UUID).
// ---------------------------------------------------------------------------
const SERVER_PK_OVERRIDE: Record<string, string> = {
  reproduction_events: "id",
};

async function getSupabaseForRequest(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } },
    );
  }
  return await createServerClient();
}

async function getOrgId(
  supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  if (error || !data) {
    console.warn("[SyncAPI] Could not resolve org_id for user", userId, error?.message);
    return null;
  }
  return data.org_id as string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table");
  const lastModified = searchParams.get("lastModified");
  const lastId = searchParams.get("lastId");
  const limit = searchParams.get("limit") || "1000";
  const clientPrimaryKey = searchParams.get("primaryKey") || "id";

  if (!table) {
    return NextResponse.json({ error: "Table name is required" }, { status: 400 });
  }
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: "Table not allowed" }, { status: 403 });
  }

  const supabase = await getSupabaseForRequest(req);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    console.warn("[SyncAPI] Unauthorized pull attempt on:", table, userError?.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use the server-side PK column (may differ from the client-side RxDB PK).
  const serverPk = SERVER_PK_OVERRIDE[table] ?? clientPrimaryKey;

  console.log(`[SyncAPI] Pull: ${table} (pk=${serverPk}) for ${user.email}`);

  let query = supabase
    .from(table)
    .select("*")
    .order("server_updated_at", { ascending: true })
    .order(serverPk, { ascending: true })
    .limit(parseInt(limit));

  if (lastModified !== null && lastModified !== undefined) {
    const lastModNum = Number(lastModified);
    // Convert epoch number to ISO string for Supabase timestamptz column
    const lastModStr = new Date(lastModNum).toISOString();

    if (lastId) {
      const idFilter = `"${lastId}"`;
      query = query.or(
        `server_updated_at.gt.${lastModStr},and(server_updated_at.eq.${lastModStr},${serverPk}.gt.${idFilter})`,
      );
    } else {
      query = query.gte("server_updated_at", lastModStr);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[SyncAPI] Pull error for ${table}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[SyncAPI] Pull success for ${table}: ${data?.length ?? 0} rows`);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { table, documents, primaryKey: clientPrimaryKey = "id" } = body;

    if (!table || !documents || !Array.isArray(documents)) {
      return NextResponse.json({ error: "Table and documents are required" }, { status: 400 });
    }
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: "Table not allowed" }, { status: 403 });
    }

    const supabase = await getSupabaseForRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) {
      return NextResponse.json({ error: "User has no active organization" }, { status: 403 });
    }

    // Use the server-side PK for upsert conflict resolution.
    const serverPk = SERVER_PK_OVERRIDE[table] ?? clientPrimaryKey;

    const enriched = documents.map((doc: Record<string, unknown>) => ({
      ...doc,
      org_id: orgId,
      device_id: (doc.device_id as string | undefined) || "web",
    }));

    const { data, error } = await supabase
      .from(table)
      .upsert(enriched, { onConflict: serverPk, ignoreDuplicates: false })
      .select();

    if (error) {
      console.error(`[SyncAPI] Push error for ${table}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[SyncAPI] Push success for ${table}: ${data?.length ?? 0} rows for ${user.email}`);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[SyncAPI] Internal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
