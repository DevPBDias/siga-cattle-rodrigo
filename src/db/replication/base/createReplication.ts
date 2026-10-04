import {
  replicateRxCollection,
  RxReplicationState,
} from "rxdb/plugins/replication";
import { MyDatabase } from "../../collections";
import {
  ReplicationConfig,
  ReplicableEntity,
  ReplicationCheckpoint,
} from "./types";
import {
  getAuthHeaders,
  cleanSupabaseDocuments,
  cleanSupabaseDocument,
} from "@/lib/supabase/auth-helper";
import { SyncLogger } from "@/lib/sync/syncLogger";
import { PendingQueue } from "@/lib/sync/pendingQueue";
import { toast } from "sonner";

export function createReplication<T extends ReplicableEntity>(
  config: ReplicationConfig<T>,
) {
  const {
    collectionName,
    tableName,
    replicationIdentifier = `${String(collectionName)}-replication-v13`,
    pullBatchSize = 1000,
    pushBatchSize = 1000,
    mapToSupabase,
    mapFromSupabase,
    retryTime = 5000,
    live = true,
    autoStart = false,
  } = config;

  const colName = String(collectionName);

  return async (
    db: MyDatabase,
    supabaseUrl: string,
    _supabaseKey: string,
  ): Promise<RxReplicationState<T, ReplicationCheckpoint>> => {
    const collection = db[collectionName];

    SyncLogger.info(colName, "Creating replication", {
      tableName,
      replicationIdentifier,
      pullBatchSize,
      pushBatchSize,
      live,
      autoStart,
    });

    const replication = replicateRxCollection<T, ReplicationCheckpoint>({
      collection: collection as any,
      replicationIdentifier,

      // ==================== PULL (Supabase → RxDB) ====================
      //
      // Checkpoint field: server_updated_at
      //
      // server_updated_at is stamped by the server (lww_merge trigger) at the
      // moment of write. It is always monotonically increasing and safe to use
      // as a pull cursor.
      //
      // updated_at is the device-side edit timestamp. It can be any value in
      // the past (e.g. from an offline edit), so it must NOT be used as a
      // cursor — doing so would cause the client to miss records that arrive
      // with old updated_at but high server_updated_at.
      pull: {
        async handler(checkpoint, batchSize) {
          // The checkpoint stores the last server_updated_at we received.
          const lastServerUpdatedAt = checkpoint?.updated_at || 0;
          const lastId = checkpoint?.last_id || null;
          const effectiveBatchSize = batchSize || pullBatchSize;

          SyncLogger.info(colName, "Pulling from Sync API...", {
            lastServerUpdatedAt,
            lastId,
            batchSize: effectiveBatchSize,
          });

          const headers = await getAuthHeaders();

          if (!headers.Authorization) {
            SyncLogger.error(
              colName,
              "No auth token available. Skipping pull.",
            );
            throw new Error("Authentication required for sync");
          }

          const primaryKey =
            (collection as any).schema.jsonSchema.primaryKey || "id";

          // Safe numeric conversion of the checkpoint value.
          let lastServerUpdatedAtNum: number;
          if (typeof lastServerUpdatedAt === "number") {
            lastServerUpdatedAtNum = lastServerUpdatedAt;
          } else {
            const parsed = Date.parse(String(lastServerUpdatedAt));
            lastServerUpdatedAtNum = isNaN(parsed) ? 0 : parsed;
          }

          // The API route uses `lastModified` as the query param name for
          // backward compatibility. The route now maps it to server_updated_at.
          const params = new URLSearchParams({
            table: tableName,
            lastModified: String(lastServerUpdatedAtNum),
            primaryKey,
            limit: String(effectiveBatchSize),
          });

          if (lastId) params.append("lastId", String(lastId));

          const url = `/api/sync?${params.toString()}`;

          SyncLogger.info(colName, "Pulling from Sync API...", { url });

          const response = await fetch(url, { headers });

          if (!response.ok) {
            const errorText = await response.text();
            SyncLogger.error(
              colName,
              `Pull failed: ${response.status}`,
              errorText,
            );

            if (response.status !== 401 && response.status !== 403) {
              toast.error(
                `Falha ao sincronizar: ${colName}. Tentaremos novamente em breve.`,
              );
            }

            throw new Error(`Pull failed: ${response.status}`);
          }

          const rawDocuments: Record<string, any>[] = await response.json();
          const data = Array.isArray(rawDocuments) ? rawDocuments : [];

          // Map documents for RxDB.
          const processedDocuments = data.map((doc) => {
            let processed: T;
            if (mapFromSupabase) {
              processed = mapFromSupabase(doc);
            } else {
              processed = cleanSupabaseDocuments([doc])[0] as T;
            }

            // RxDB requires _deleted, created_at and updated_at to be present.
            return {
              ...processed,
              _deleted: !!processed._deleted,
              created_at: processed.created_at || Date.now(),
              updated_at: processed.updated_at || Date.now(),
            } as T;
          });

          SyncLogger.info(
            colName,
            `Received ${processedDocuments.length} documents`,
          );

          // Advance the checkpoint using server_updated_at from the last raw doc.
          // The checkpoint.updated_at field stores server_updated_at (not updated_at).
          const lastRawDoc = data.length > 0 ? data[data.length - 1] : null;
          const newCheckpoint: ReplicationCheckpoint = {
            updated_at: lastRawDoc
              ? Number(lastRawDoc.server_updated_at)  // ← KEY CHANGE
              : lastServerUpdatedAtNum,
            last_id: lastRawDoc ? String(lastRawDoc[primaryKey]) : lastId,
          };

          if (data.length > 0) {
            SyncLogger.info(colName, "Checkpoint advanced", {
              server_updated_at: newCheckpoint.updated_at,
              last_id: newCheckpoint.last_id,
              docsInBatch: data.length,
              hasMore: data.length >= effectiveBatchSize,
            });
          }

          return {
            documents: processedDocuments,
            checkpoint: newCheckpoint,
          };
        },
        batchSize: pullBatchSize,
      },

      // ==================== PUSH (RxDB → Supabase) ====================
      //
      // The push handler sends updated_at (device timestamp) to the server.
      // The server (/api/sync POST) injects org_id and device_id.
      // The lww_merge trigger on the server resolves conflicts using updated_at.
      push: {
        async handler(rows) {
          SyncLogger.info(colName, `PUSH triggered with ${rows.length} rows`);

          const primaryKey =
            (collection as any).schema.jsonSchema.primaryKey || "id";

          // Mark docs as syncing in PendingQueue
          rows.forEach((row) => {
            const docId = String((row.newDocumentState as any)[primaryKey]);
            PendingQueue.add(colName, docId);
            PendingQueue.markSyncing(colName, docId);
          });

          const documents = rows.map((row) => {
            const doc = row.newDocumentState as T;

            // Guarantee updated_at is present (defensive)
            if (!doc.updated_at) {
              SyncLogger.warn(
                colName,
                "Document missing updated_at, adding now",
              );
              (doc as any).updated_at = Date.now();
            }

            let mapped = mapToSupabase
              ? mapToSupabase(doc)
              : { ...(doc as Record<string, any>) };

            // Supabase uses bigint for timestamps — keep as number, not ISO string.
            if (mapped.updated_at !== undefined && mapped.updated_at !== null) {
              mapped.updated_at = Number(mapped.updated_at);
            }
            if (mapped.created_at !== undefined && mapped.created_at !== null) {
              mapped.created_at = Number(mapped.created_at);
            }

            return mapped;
          });

          const headers = await getAuthHeaders();

          if (!headers.Authorization) {
            SyncLogger.error(
              colName,
              "No auth token for push. Session may have expired.",
            );

            rows.forEach((row) => {
              const docId = String((row.newDocumentState as any)[primaryKey]);
              PendingQueue.markError(colName, docId, "No auth token");
            });

            throw new Error("Authentication required for sync");
          }

          SyncLogger.info(
            colName,
            `Pushing ${documents.length} docs to Sync API...`,
          );

          const response = await fetch("/api/sync", {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              table: tableName,
              documents,
              primaryKey,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();

            rows.forEach((row) => {
              const docId = String((row.newDocumentState as any)[primaryKey]);
              PendingQueue.markError(
                colName,
                docId,
                `Push failed: ${response.status}`,
              );
            });

            SyncLogger.error(
              colName,
              `Push failed: ${response.status}`,
              errorText,
            );
            throw new Error(`Push failed: ${response.status} - ${errorText}`);
          }

          const responseData = await response.json();
          const updatedDocs = Array.isArray(responseData) ? responseData : [];

          // Mark all as synced
          rows.forEach((row) => {
            const docId = String((row.newDocumentState as any)[primaryKey]);
            PendingQueue.markSynced(colName, docId);
          });

          SyncLogger.info(
            colName,
            `Push successful: ${updatedDocs.length} docs synced ✅`,
          );

          if (updatedDocs.length > 0) {
            const mappedResults = updatedDocs.map((doc) => {
              if (mapFromSupabase) return mapFromSupabase(doc);
              const cleaned = cleanSupabaseDocument(doc);
              return {
                ...cleaned,
                _deleted: cleaned._deleted ?? false,
              } as T;
            });
            return mappedResults;
          }

          return [];
        },
        batchSize: pushBatchSize,
      },

      live,
      retryTime,
      autoStart,
    });

    return replication;
  };
}

