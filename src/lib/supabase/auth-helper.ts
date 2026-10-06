import { getSupabase } from "./client";

export async function getAuthToken(): Promise<string> {
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      return session.access_token;
    }

    // Tentar refresh se não tem sessão válida
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      console.log("🔑 Auth token refreshed successfully");
      return refreshData.session.access_token;
    }
  } catch (error) {
    console.warn("⚠️ Failed to get auth session:", error);
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const headers: Record<string, string> = {
    apikey: anonKey,
    "Content-Type": "application/json",
  };

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      // Verificar se o token está perto de expirar (menos de 60s)
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt && expiresAt - now < 60) {
        console.log("🔑 Token expiring soon, attempting refresh...");
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData?.session?.access_token) {
          headers["Authorization"] =
            `Bearer ${refreshData.session.access_token}`;
          console.log("🔑 Token refreshed successfully");
          return headers;
        }
      }

      headers["Authorization"] = `Bearer ${session.access_token}`;
      return headers;
    }

    // Sem sessão ativa — tentar refresh
    console.log("🔑 No active session, attempting refresh...");
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      headers["Authorization"] = `Bearer ${refreshData.session.access_token}`;
      console.log("🔑 Session restored via refresh");
      return headers;
    }

    console.warn(
      "⚠️ No auth session available. Replication will fail if RLS is enabled.",
    );
  } catch (error) {
    console.warn("⚠️ Failed to get auth headers:", error);
  }

  return headers;
}

export function cleanSupabaseDocument<T extends Record<string, any>>(
  doc: T
): T {
  const cleaned: any = {};

  for (const [key, value] of Object.entries(doc)) {
    // Skip fields that only exist in Supabase but not in RxDB schemas
    if (["org_id", "device_id", "server_updated_at", "field_updated_at"].includes(key)) {
      continue;
    }

    // Don't skip nulls for critical replication fields - let the mapper handle them
    if (
      value === null &&
      !["_deleted", "created_at", "updated_at"].includes(key)
    ) {
      continue;
    }

    // Force numeric technical timestamps for Supabase compatibility (bigint)
    if (["created_at", "updated_at"].includes(key) && value) {
      if (typeof value === "string") {
        const parsed = Date.parse(value);
        cleaned[key] = isNaN(parsed)
          ? isNaN(Number(value))
            ? Date.now()
            : Number(value)
          : parsed;
      } else if (value instanceof Date) {
        cleaned[key] = value.getTime();
      } else {
        cleaned[key] = value;
      }
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned as T;
}

export function cleanSupabaseDocuments<T extends Record<string, any>>(
  docs: T[]
): T[] {
  return docs.map((doc) => cleanSupabaseDocument(doc));
}
