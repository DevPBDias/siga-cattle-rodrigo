"use client";

import { createRxDatabase, addRxPlugin, RxStorage } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { RxDBQueryBuilderPlugin } from "rxdb/plugins/query-builder";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBMigrationPlugin } from "rxdb/plugins/migration-schema";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { animalSchema } from "./schemas/animal.schema";
import { vaccineSchema } from "./schemas/vaccine.schema";
import { farmSchema } from "./schemas/farm.schema";
import { MyDatabase, MyDatabaseCollections } from "./collections";
import { setupReplication } from "./replication";
import { animalMetricCESchema } from "./schemas/animal_metric_ce.schema";
import { animalMetricWeightSchema } from "./schemas/animal_metric_weight.schema";
import { animalVaccineSchema } from "./schemas/animal_vaccines.type";
import { reproductionEventSchema } from "./schemas/reproduction_event.schema";
import { animalStatusSchema } from "./schemas/animal_status.schema";
import { semenDoseSchema } from "./schemas/semen_dose.schema";
import { lastWriteWins } from "./replication/base/conflictResolver";
import { RxConflictHandler, defaultConflictHandler } from "rxdb";
import { animalSituationSchema } from "./schemas/animal_situation.schema";
import { clientSchema } from "./schemas/client.schema";
import { movementSchema } from "./schemas/movement.schema";
import { saleSchema } from "./schemas/sale.schema";
import { deathSchema } from "./schemas/death.schema";
import { exchangeSchema } from "./schemas/exchange.schema";
import { organizationSettingsSchema } from "./schemas/organization_settings.schema";

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBMigrationPlugin);

let devModeLoaded = false;

async function loadDevModePlugin(): Promise<void> {
  if (devModeLoaded || process.env.NODE_ENV !== "development") {
    return;
  }

  try {
    const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
    addRxPlugin(RxDBDevModePlugin);
    devModeLoaded = true;
    console.log("[RxDB] Dev-mode plugin loaded");
  } catch (err) {
    console.warn("[RxDB] Failed to load dev-mode plugin", err);
  }
}

const DB_VERSION = "v17";
const DB_NAME = `indi_ouro_db_${DB_VERSION}`;

let storageInstance: RxStorage<any, any> | null = null;

function getStorage() {
  if (!storageInstance) {
    storageInstance = getRxStorageDexie();
    if (process.env.NODE_ENV === "development") {
      storageInstance = wrappedValidateAjvStorage({
        storage: storageInstance,
      });
    }
  }
  return storageInstance;
}

let dbInstance: MyDatabase | null = null;
let dbPromise: Promise<MyDatabase> | null = null;

async function createDatabase(): Promise<MyDatabase> {
  await loadDevModePlugin();

  const storage = getStorage();

  try {
    const db = await createRxDatabase<MyDatabaseCollections>({
      name: DB_NAME,
      storage: storage,
      multiInstance: true,
      ignoreDuplicate: process.env.NODE_ENV === "development",
      eventReduce: true,
    });

    const collectionsCount = Object.keys(db.collections).length;
    if (collectionsCount > 0) {
      console.log(
        `[RxDB] Database already has ${collectionsCount} collections, skipping addCollections`,
      );
      // BUG-03 FIX: Don't return early — still need to set up replication
      // (it's a no-op if already configured, but critical on hot-reload/multi-context)
      setupReplication(db).catch((err: Error) => {
        console.warn("[RxDB] Replication setup on existing db:", err);
      });
      return db;
    }

    try {
      const customConflictHandler: RxConflictHandler<any> = {
        isEqual: defaultConflictHandler.isEqual,
        resolve: async (i) => {
          return lastWriteWins(i.newDocumentState, i.realMasterState);
        },
      };

      await db.addCollections({
        animals: {
          schema: animalSchema,
          conflictHandler: customConflictHandler,
        },
        vaccines: {
          schema: vaccineSchema,
          conflictHandler: customConflictHandler,
        },
        farms: { schema: farmSchema, conflictHandler: customConflictHandler },
        animal_metrics_ce: {
          schema: animalMetricCESchema,
          conflictHandler: customConflictHandler,
        },
        animal_metrics_weight: {
          schema: animalMetricWeightSchema,
          conflictHandler: customConflictHandler,
        },
        animal_vaccines: {
          schema: animalVaccineSchema,
          conflictHandler: customConflictHandler,
        },
        reproduction_events: {
          schema: reproductionEventSchema,
          conflictHandler: customConflictHandler,
          migrationStrategies: {
            1: (oldDoc) => {
              return { ...oldDoc, d11_date: oldDoc.d11_date ?? undefined };
            },
          },
        },
        animal_statuses: {
          schema: animalStatusSchema,
          conflictHandler: customConflictHandler,
        },
        animal_situations: {
          schema: animalSituationSchema,
          conflictHandler: customConflictHandler,
        },
        semen_doses: {
          schema: semenDoseSchema,
          conflictHandler: customConflictHandler,
        },
        clients: {
          schema: clientSchema,
          conflictHandler: customConflictHandler,
        },
        movements: {
          schema: movementSchema,
          conflictHandler: customConflictHandler,
        },
        sales: {
          schema: saleSchema,
          conflictHandler: customConflictHandler,
        },
        deaths: {
          schema: deathSchema,
          conflictHandler: customConflictHandler,
        },
        exchanges: {
          schema: exchangeSchema,
          conflictHandler: customConflictHandler,
        },
        organization_settings: {
          schema: organizationSettingsSchema,
          conflictHandler: customConflictHandler,
        },
      });
    } catch (err: any) {
      console.error("[RxDB] Failed to add collections:", err);

      try {
        await db.close();
      } catch (closeErr) {
        console.error(
          "[RxDB] Failed to close db after collection error",
          closeErr,
        );
      }

      if (err.message?.includes("schema") || err.name === "RxError") {
        console.warn(
          "[RxDB] Schema mismatch detected. You might need to increment collection version or DB_VERSION.",
        );
      }
      throw err;
    }

    setupReplication(db).catch((err: Error) => {
      console.error("[RxDB] Replication setup failed:", err);
    });

    return db;
  } catch (err) {
    console.error("[RxDB] Error creating database:", err);
    throw err;
  }
}

export async function getDatabase(): Promise<MyDatabase> {
  if (typeof window === "undefined") {
    return null as any;
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = createDatabase()
    .then((db) => {
      dbInstance = db;
      return db;
    })
    .catch(async (error) => {
      console.error("[RxDB] Critical initialization error:", error);
      dbPromise = null;
      dbInstance = null;
      throw error;
    });

  return dbPromise as Promise<MyDatabase>;
}

export async function clearAllDatabases(): Promise<void> {
  if (typeof window === "undefined") return;

  console.log("[RxDB] Starting full local database purge...");

  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      dbPromise = null;
    } catch (err) {
      console.error("[RxDB] Error destroying current instance:", err);
    }
  }

  try {
    localStorage.clear();
    console.log("[RxDB] LocalStorage cleared");
  } catch (e) {}

  try {
    if (window.indexedDB && (window.indexedDB as any).databases) {
      const dbs = await (window.indexedDB as any).databases();

      for (const dbInfo of dbs) {
        const name = dbInfo.name;
        if (!name) continue;

        const shouldDelete =
          name.includes("indi_ouro") ||
          name.includes("rxdb") ||
          name.includes("dexie") ||
          name.includes("offline-sync");

        if (shouldDelete) {
          console.log(`[RxDB] Purging IndexedDB: ${name}`);
          await new Promise<void>((resolve, reject) => {
            const request = window.indexedDB.deleteDatabase(name);
            request.onsuccess = () => {
              console.log(`[RxDB] IndexedDB deleted: ${name}`);
              resolve();
            };
            request.onerror = (event) => {
              console.error("[RxDB] Failed to delete IndexedDB:", name, event);
              // Mesmo em caso de erro, seguimos para evitar travar o reset
              resolve();
            };
            request.onblocked = () => {
              console.warn(
                "[RxDB] Delete blocked for IndexedDB:",
                name,
                "- close other tabs if possible.",
              );
            };
          });
        }
      }
    } else {
      const commonNames = [
        "indi_ouro_db",
        "indi_ouro_db_v1",
        "indi_ouro_db_v2",
        "indi_ouro_db_v3",
        "indi_ouro_db_v4",
        "indi_ouro_db_v5",
        "indi_ouro_db_v6",
        "indi_ouro_db_v7",
        "indi_ouro_db_v8",
        "indi_ouro_db_v9",
        "indi_ouro_db_v10",
        "indi_ouro_db_v11",
        "indi_ouro_db_v12",
        "indi_ouro_db_v13",
        "indi_ouro_db_v14",
        "indi_ouro_db_v15",
        "indi_ouro_db_v16",
        "indi_ouro_db_v17",
        "offline-sync-queue",
      ];
      for (const name of commonNames) {
        await new Promise<void>((resolve) => {
          const request = window.indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }
    }
    console.log("[RxDB] Full purge complete.");
  } catch (err) {
    console.error("[RxDB] Critical error during database cleanup:", err);
  }
}

export function isDatabaseReady(): boolean {
  return dbInstance !== null;
}
