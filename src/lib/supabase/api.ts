import { getSupabase } from "./client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("placeholder") &&
    supabaseAnonKey !== "placeholder-key"
  );
};

export async function checkDuplicateRGNs(
  rgns: string[]
): Promise<{ rgn: string; id: string; name: string }[]> {
  // Verificar se Supabase está configurado
  if (!isSupabaseConfigured()) {
    console.warn(
      "⚠️ Supabase não configurado - verificação de duplicatas desabilitada"
    );
    return [];
  }

  // Filtrar RGNs vazios ou inválidos
  const validRgns = rgns
    .filter((rgn) => rgn && rgn.trim() !== "" && rgn.trim().length > 0)
    .map((rgn) => rgn.trim());

  if (validRgns.length === 0) {
    console.log("Nenhum RGN válido para verificar");
    return [];
  }

  console.log(`🔍 Verificando ${validRgns.length} RGNs no banco global...`);

  const supabase = getSupabase();

  try {
    // Verificar se o usuário está autenticado
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn(
        "⚠️ Usuário não autenticado - verificação de duplicatas desabilitada"
      );
      return [];
    }

    // Buscar animais com RGNs específicos
    const { data, error } = await supabase
      .from("animals")
      .select("rgn, name")
      .in("rgn", validRgns);

    if (error) {
      const errorInfo = {
        message: error?.message || "Erro sem mensagem",
        details: error?.details || "Sem detalhes",
        hint: error?.hint || "Sem dica",
        code: error?.code || "Sem código",
      };

      console.error(
        "❌ Erro ao buscar animais para verificação de RGN:",
        errorInfo
      );

      // Se for erro de permissão ou tabela não existe, retornar array vazio
      if (
        errorInfo.code === "42P01" || // Tabela não existe
        errorInfo.code === "42501" || // Sem permissão
        errorInfo.code === "PGRST116" || // JWT inválido ou expirado
        errorInfo.code === "PGRST301" // RLS policy violation
      ) {
        console.warn(
          `⚠️ Verificação de duplicatas global desabilitada (código: ${errorInfo.code}). A importação continuará com verificação apenas local.`
        );
        return [];
      }

      console.warn(
        "⚠️ Não foi possível verificar duplicatas no banco global. A importação continuará com verificação apenas local."
      );
      return [];
    }

    if (!data || data.length === 0) {
      console.log("✅ Nenhum animal duplicado encontrado");
      return [];
    }

    console.log(`⚠️ Encontrados ${data.length} RGNs duplicados`);

    // Mapear para o formato esperado
    return data.map((animal: any) => ({
      rgn: animal.rgn || "",
      id: animal.rgn || "",
      name: animal.name || "Sem nome",
    }));
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("❌ Erro inesperado ao verificar RGNs duplicados:", {
      message: errorMessage,
      stack: errorStack,
      errorType: typeof error,
    });

    console.warn(
      "⚠️ Verificação de duplicatas falhou. A importação continuará sem verificação."
    );
    return [];
  }
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

export function onOnlineStatusChange(
  callback: (online: boolean) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
