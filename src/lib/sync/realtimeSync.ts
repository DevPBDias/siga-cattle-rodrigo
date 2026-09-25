/**
 * Realtime Sync — Supabase Realtime → RxDB reSync bridge.
 *
 * Subscribes to Supabase postgres_changes for all replicated tables.
 * When a remote change is detected, triggers reSync() on the corresponding
 * RxDB replication so the local DB pulls the new data immediately.
 *
 * Cost-efficient: uses a single Supabase Realtime channel with multiple
 * table filters. reSync() is incremental (checkpoint-based), not a full pull.
 */

import { getSupabase } from "@/lib/supabase/client";
import { SyncLogger } from "@/lib/sync/syncLogger";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Map of Supabase table names → RxDB replication names in db.replications */
const TABLE_TO_REPLICATION: Record<string, string> = {
  animals: "animals",
  vaccines: "vaccines",
  farms: "farms",
  animal_metrics_ce: "animal_metrics_ce",
  animal_metrics_weight: "animal_metrics_weight",
  animal_vaccines: "animal_vaccines",
  reproduction_events: "reproduction_events",
  animal_statuses: "animal_statuses",
  animal_situations: "animal_situations",
  semen_doses: "semen_doses",
  clients: "clients",
  movements: "movements",
  sales: "sales",
  deaths: "deaths",
  exchanges: "exchanges",
};

let activeChannel: RealtimeChannel | null = null;

/**
 * Sets up Supabase Realtime subscriptions for all replicated tables.
 * When a remote INSERT/UPDATE is received, triggers reSync() on the
 * corresponding RxDB replication.
 *
 * @param replications - The db.replications object from MyDatabase
 * @returns Cleanup function to remove the channel
 */
export function setupRealtimeSync(
  replications: Record<string, any>
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Remove existing channel if any (e.g. on re-mount)
  if (activeChannel) {
    SyncLogger.info("realtime", "Removing existing Realtime channel before re-setup");
    getSupabase().removeChannel(activeChannel);
    activeChannel = null;
  }

  const supabase = getSupabase();

  SyncLogger.info("realtime", "Setting up Supabase Realtime channel for all tables...");

  // Single channel for all tables (cost-efficient)
  const channel = supabase.channel("rxdb-remote-changes", {
    config: {
      broadcast: { self: false }, // Don't receive our own pushes
    },
  });

  // Subscribe to all replicated tables
  for (const [tableName, replicationName] of Object.entries(TABLE_TO_REPLICATION)) {
    channel.on(
      "postgres_changes" as any,
      {
        event: "*", // INSERT, UPDATE, DELETE
        schema: "public",
        table: tableName,
      },
      (payload: any) => {
        const replication = replications[replicationName];
        if (!replication) {
          SyncLogger.warn(
            "realtime",
            `Received change for ${tableName} but replication not found`,
          );
          return;
        }

        SyncLogger.info(
          "realtime",
          `Remote change detected on ${tableName} (${payload.eventType}), triggering reSync...`,
          { table: tableName, eventType: payload.eventType }
        );

        // Incremental pull — only fetches docs newer than last checkpoint
        if (typeof replication.reSync === "function") {
          replication.reSync();
        }
      }
    );
  }

  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      SyncLogger.info("realtime", "✅ Supabase Realtime channel subscribed successfully");
    } else if (status === "CHANNEL_ERROR") {
      SyncLogger.error("realtime", "Realtime channel error", err);
    } else if (status === "TIMED_OUT") {
      SyncLogger.warn("realtime", "Realtime channel timed out — will retry automatically");
    } else if (status === "CLOSED") {
      SyncLogger.warn("realtime", "Realtime channel closed");
    }
  });

  activeChannel = channel;

  SyncLogger.info("realtime", `Subscribed to ${Object.keys(TABLE_TO_REPLICATION).length} tables via Realtime`);

  return () => {
    if (activeChannel) {
      SyncLogger.info("realtime", "Cleaning up Realtime channel");
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
  };
}

/** Returns true if the Realtime channel is currently active */
export function isRealtimeSyncActive(): boolean {
  return activeChannel !== null;
}
