"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRxDB } from "./RxDBProvider";
import { combineLatest } from "rxjs";
import { forceSyncAll } from "../db/replication";
import { SyncLogger } from "@/lib/sync/syncLogger";
import { PendingQueue } from "@/lib/sync/pendingQueue";
import type { SyncLogEntry } from "@/lib/sync/syncLogger";
import { setupRealtimeSync } from "@/lib/sync/realtimeSync";

interface SyncStats {
  pending: number;
  syncing: number;
  error: number;
  total: number;
}

interface ReplicationContextType {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  online: boolean;
  replicationErrors: Error[];
  triggerSync: () => void;
  entityStatus: Record<string, { isSyncing: boolean; error: Error | null }>;
  /** Estatísticas da fila de documentos pendentes */
  syncStats: SyncStats;
  /** Exporta os logs de sincronização como JSON (para debug/suporte) */
  exportSyncLogs: () => string;
  /** Retorna os últimos erros de sincronização do SyncLogger */
  getRecentSyncErrors: () => SyncLogEntry[];
}

const defaultSyncStats: SyncStats = {
  pending: 0,
  syncing: 0,
  error: 0,
  total: 0,
};

const ReplicationContext = createContext<ReplicationContextType>({
  isSyncing: false,
  lastSyncedAt: null,
  online: true,
  replicationErrors: [],
  triggerSync: () => {},
  entityStatus: {},
  syncStats: defaultSyncStats,
  exportSyncLogs: () => "[]",
  getRecentSyncErrors: () => [],
});

export const useReplication = () => useContext(ReplicationContext);

export function ReplicationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, isLoading } = useRxDB();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [replicationErrors, setReplicationErrors] = useState<Error[]>([]);
  const [entityStatus, setEntityStatus] = useState<
    Record<string, { isSyncing: boolean; error: Error | null }>
  >({});
  const [syncStats, setSyncStats] = useState<SyncStats>(defaultSyncStats);
  const [replicationsReady, setReplicationsReady] = useState(false);

  useEffect(() => {
    SyncLogger.info("provider", "ReplicationProvider initialized", {
      hasDb: !!db,
      isLoading,
      hasReplications: !!(db as any)?.replications,
    });
  }, [db, isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Atualização periódica das stats do PendingQueue
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = PendingQueue.getStats();
      setSyncStats(stats);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // BUG-04 FIX: Poll until db.replications is populated (it's set async after setupReplication)
  useEffect(() => {
    if (!db || isLoading || replicationsReady) return;

    // Check immediately
    if ((db as any).replications) {
      setReplicationsReady(true);
      return;
    }

    // Poll every 300ms until replications are set
    const interval = setInterval(() => {
      if ((db as any).replications) {
        setReplicationsReady(true);
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [db, isLoading, replicationsReady]);

  useEffect(() => {
    if (!isLoading && db && replicationsReady && (db as any).replications) {
      const replicationsMap = (db as any).replications;
      const replicationEntries = Object.entries(replicationsMap);

      SyncLogger.info(
        "provider",
        `Tracking ${replicationEntries.length} entities`,
        Object.keys(replicationsMap),
      );

      if (replicationEntries.length === 0) return;

      // Inicializa o estado com as entidades conhecidas
      setEntityStatus((prev) => {
        const next = { ...prev };
        replicationEntries.forEach(([name]) => {
          if (!next[name]) next[name] = { isSyncing: false, error: null };
        });
        return next;
      });

      const subscriptions: any[] = [];

      replicationEntries.forEach(([name, rep]: [string, any]) => {
        if (!rep) return;

        // Track activity (active$)
        subscriptions.push(
          rep.active$.subscribe((isActive: boolean) => {
            setEntityStatus((prev) => ({
              ...prev,
              [name]: { ...prev[name], isSyncing: isActive },
            }));
          }),
        );

        // Track errors (error$)
        subscriptions.push(
          rep.error$.subscribe((error: Error | null) => {
            if (error) {
              SyncLogger.error("provider", `Sync error for ${name}`, error);
            }
            setEntityStatus((prev) => ({
              ...prev,
              [name]: { ...prev[name], error },
            }));
          }),
        );
      });

      // Global sync status logic
      const activeObservables = replicationEntries.map(
        ([_, rep]: [string, any]) => rep.active$,
      );
      const globalActiveSub = combineLatest(activeObservables).subscribe(
        (actives) => {
          const currentlySyncing = actives.some((a) => a === true);
          setIsSyncing(currentlySyncing);
          if (!currentlySyncing) setLastSyncedAt(new Date());
        },
      );

      const errorObservables = replicationEntries.map(
        ([_, rep]: [string, any]) => rep.error$,
      );
      const globalErrorSub = combineLatest(errorObservables).subscribe(
        (errors) => {
          const activeErrors = errors.filter((err) => err !== null) as Error[];
          setReplicationErrors(activeErrors);
        },
      );

      subscriptions.push(globalActiveSub, globalErrorSub);

      return () => {
        subscriptions.forEach((sub) => sub.unsubscribe());
      };
    }
  }, [isLoading, db, replicationsReady]);

  // BUG-02 FIX: Supabase Realtime subscription — triggers reSync on remote changes
  useEffect(() => {
    if (!db || !replicationsReady || !online) return;

    const replications = (db as any).replications;
    if (!replications) return;

    SyncLogger.info("provider", "Starting Supabase Realtime sync...");
    const cleanup = setupRealtimeSync(replications);

    return cleanup;
  }, [db, replicationsReady, online]);

  const triggerSync = useCallback(() => {
    SyncLogger.info("provider", "Manual sync triggered by user");
    forceSyncAll(db as any);
  }, [db]);

  const exportSyncLogs = useCallback(() => {
    return SyncLogger.export();
  }, []);

  const getRecentSyncErrors = useCallback(() => {
    return SyncLogger.getErrors();
  }, []);

  return (
    <ReplicationContext.Provider
      value={{
        isSyncing,
        lastSyncedAt,
        online,
        replicationErrors,
        triggerSync,
        entityStatus,
        syncStats,
        exportSyncLogs,
        getRecentSyncErrors,
      }}
    >
      {children}
    </ReplicationContext.Provider>
  );
}
