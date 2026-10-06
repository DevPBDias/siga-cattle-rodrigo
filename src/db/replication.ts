import { MyDatabase } from "./collections";
import { replicateAnimalsNew as replicateAnimals } from "./replication/animal.replication";
import { replicateSemenDosesNew as replicateSemenDoses } from "./replication/semenDose.replication";
import { replicateFarmsNew as replicateFarms } from "./replication/farm.replication";
import { replicateVaccinesNew as replicateVaccines } from "./replication/vaccine.replication";
import { replicateAnimalMetricWeightNew as replicateAnimalMetricWeight } from "./replication/metric.replication";
import { replicateAnimalMetricCENew as replicateAnimalMetricCE } from "./replication/metric.replication";
import { replicateAnimalVaccinesNew as replicateAnimalVaccines } from "./replication/animalVaccine.replication";
import { replicateReproductionEventsNew as replicateReproductionEvents } from "./replication/reproduction.replication";
import { replicateAnimalStatusesNew as replicateAnimalStatuses } from "./replication/status.replication";
import { replicateAnimalSituationsNew as replicateAnimalSituations } from "./replication/situation.replication";
import { replicateClientsNew as replicateClients } from "./replication/client.replication";
import { replicateMovementsNew as replicateMovements } from "./replication/movement.replication";
import { replicateSalesNew as replicateSales } from "./replication/sale.replication";
import { replicateDeathsNew as replicateDeaths } from "./replication/death.replication";
import { replicateExchangesNew as replicateExchanges } from "./replication/exchange.replication";
import { replicateOrganizationSettingsNew as replicateOrganizationSettings } from "./replication/organization_settings.replication";
import { SyncLogger } from "@/lib/sync/syncLogger";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("placeholder") || key === "placeholder") {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes("supabase")) {
      SyncLogger.error("config", "Invalid Supabase URL format", { url });
      return null;
    }
  } catch (error) {
    SyncLogger.error("config", "Invalid Supabase URL", { url });
    return null;
  }

  return { url, key };
}

async function checkSupabaseHealth(_url: string, _key: string): Promise<boolean> {
  // Use navigator.onLine as a lightweight connectivity check.
  // Avoids hitting the Supabase REST API directly, which logs 401 errors
  // in the browser console that cannot be suppressed from JavaScript.
  // The replication framework handles retries automatically when offline.
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (isOnline) {
    SyncLogger.info("health", "Network check: ✅ Online");
  } else {
    SyncLogger.warn("health", "Network check: ❌ Offline");
  }

  return isOnline;
}

export async function setupReplication(db: MyDatabase) {
  SyncLogger.info("setup", "Setting up replication...");

  const config = getSupabaseConfig();

  if (!config) {
    SyncLogger.warn(
      "setup",
      "Supabase not configured properly. Replication disabled. " +
        "This is normal in development if you haven't set up Supabase yet. " +
        "The app will work in offline-only mode.",
    );
    return;
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = config;

  // Aguarda um pouco para garantir que o banco local esteja totalmente inicializado
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Bug #3 fix: Aguardar health check (non-blocking mas informativo)
  const isHealthy = await checkSupabaseHealth(SUPABASE_URL, SUPABASE_KEY);
  if (!isHealthy) {
    SyncLogger.warn(
      "setup",
      "Supabase unreachable initially. Replication will start anyway and retry automatically when online.",
    );
  }

  try {
    // Verifica quantos dados locais existem antes de iniciar a replicação
    const animalsCount = await db.animals.count().exec();
    const vaccinesCount = await db.vaccines.count().exec();
    const farmsCount = await db.farms.count().exec();
    const clientsCount = await db.clients.count().exec();

    SyncLogger.info("setup", "Local DB data counts before sync", {
      animals: animalsCount,
      vaccines: vaccinesCount,
      farms: farmsCount,
      clients: clientsCount,
    });

    // Se há dados locais, prioriza o uso do banco local
    if (animalsCount > 0 || vaccinesCount > 0 || farmsCount > 0) {
      SyncLogger.info(
        "setup",
        "Local data detected. Replication will merge with local data.",
      );
    }

    const animalsReplication = await replicateAnimals(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const vaccinesReplication = await replicateVaccines(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const farmsReplication = await replicateFarms(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const animalMetricsWeightReplication = await replicateAnimalMetricWeight(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const animalMetricsCEReplication = await replicateAnimalMetricCE(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const animalVaccinesReplication = await replicateAnimalVaccines(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const reproductionEventsReplication = await replicateReproductionEvents(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const animalStatusesReplication = await replicateAnimalStatuses(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const animalSituationsReplication = await replicateAnimalSituations(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const semenDosesReplication = await replicateSemenDoses(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const clientsReplication = await replicateClients(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const movementsReplication = await replicateMovements(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const salesReplication = await replicateSales(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const deathsReplication = await replicateDeaths(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const exchangesReplication = await replicateExchanges(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    const organizationSettingsReplication = await replicateOrganizationSettings(
      db,
      SUPABASE_URL,
      SUPABASE_KEY,
    );

    (
      db as {
        replications: {
          animals: typeof animalsReplication;
          vaccines: typeof vaccinesReplication;
          farms: typeof farmsReplication;
          animal_metrics_weight: typeof animalMetricsWeightReplication;
          animal_metrics_ce: typeof animalMetricsCEReplication;
          animal_vaccines: typeof animalVaccinesReplication;
          reproduction_events: typeof reproductionEventsReplication;
          animal_statuses: typeof animalStatusesReplication;
          animal_situations: typeof animalSituationsReplication;
          semen_doses: typeof semenDosesReplication;
          clients: typeof clientsReplication;
          movements: typeof movementsReplication;
          sales: typeof salesReplication;
          deaths: typeof deathsReplication;
          exchanges: typeof exchangesReplication;
          organization_settings: typeof organizationSettingsReplication;
        };
      }
    ).replications = {
      animals: animalsReplication,
      vaccines: vaccinesReplication,
      farms: farmsReplication,
      animal_metrics_weight: animalMetricsWeightReplication,
      animal_metrics_ce: animalMetricsCEReplication,
      animal_vaccines: animalVaccinesReplication,
      reproduction_events: reproductionEventsReplication,
      animal_statuses: animalStatusesReplication,
      animal_situations: animalSituationsReplication,
      semen_doses: semenDosesReplication,
      clients: clientsReplication,
      movements: movementsReplication,
      sales: salesReplication,
      deaths: deathsReplication,
      exchanges: exchangesReplication,
      organization_settings: organizationSettingsReplication,
    };

    SyncLogger.info("setup", "Replication setup complete");

    // Inicia a replicação manualmente após um delay para garantir que o banco local esteja pronto
    setTimeout(() => {
      SyncLogger.info("setup", "Starting all replications...");

      // Verifica novamente os dados locais antes de iniciar
      db.animals
        .count()
        .exec()
        .then((count) => {
          SyncLogger.info(
            "setup",
            `Animals local count before starting replication: ${count}`,
          );
        });

      // Inicia TODAS as replicações (incluindo deaths e exchanges)
      animalsReplication.start();
      vaccinesReplication.start();
      farmsReplication.start();
      animalMetricsWeightReplication.start();
      animalMetricsCEReplication.start();
      animalVaccinesReplication.start();
      reproductionEventsReplication.start();
      animalStatusesReplication.start();
      animalSituationsReplication.start();
      semenDosesReplication.start();
      clientsReplication.start();
      movementsReplication.start();
      salesReplication.start();
      deathsReplication.start();
      exchangesReplication.start();
      organizationSettingsReplication.start();

      SyncLogger.info("setup", "All 16 replications started ✅");
    }, 500);

    // Monitoramento de erros por coleção
    const monitoredCollections = [
      { name: "animals", rep: animalsReplication },
      { name: "vaccines", rep: vaccinesReplication },
      { name: "farms", rep: farmsReplication },
      { name: "metrics_weight", rep: animalMetricsWeightReplication },
      { name: "metrics_ce", rep: animalMetricsCEReplication },
      { name: "animal_vaccines", rep: animalVaccinesReplication },
      { name: "reproduction", rep: reproductionEventsReplication },
      { name: "statuses", rep: animalStatusesReplication },
      { name: "situations", rep: animalSituationsReplication },
      { name: "semen_doses", rep: semenDosesReplication },
      { name: "clients", rep: clientsReplication },
      { name: "movements", rep: movementsReplication },
      { name: "sales", rep: salesReplication },
      { name: "deaths", rep: deathsReplication },
      { name: "exchanges", rep: exchangesReplication },
      { name: "organization_settings", rep: organizationSettingsReplication },
    ];

    const errorCounts: Record<string, number> = {};
    const MAX_ERRORS = 5;

    for (const { name, rep } of monitoredCollections) {
      errorCounts[name] = 0;

      rep.error$.subscribe((error) => {
        if (error) {
          errorCounts[name]++;
          SyncLogger.error(
            name,
            `Replication error (${errorCounts[name]}/${MAX_ERRORS})`,
            error,
          );

          if (errorCounts[name] >= MAX_ERRORS) {
            SyncLogger.warn(
              name,
              "High error rate, but keeping replication alive for retry.",
            );
          }
        }
      });

      rep.active$.subscribe((active: boolean) => {
        if (active) {
          errorCounts[name] = 0; // Reset error count on successful activity
        }
      });
    }
  } catch (error) {
    SyncLogger.error("setup", "Replication setup error", error);
    console.warn("⚠️ App will continue in offline-only mode");
  }
}

/**
 * Global utility to force a full re-sync of all active replications.
 */
export function forceSyncAll(db: MyDatabase) {
  if (!db || !(db as any).replications) {
    SyncLogger.warn(
      "manual-sync",
      "Cannot force sync: replications not initialized",
    );
    return;
  }

  SyncLogger.info("manual-sync", "Triggering reSync for all collections...");
  const replications = (db as any).replications;
  Object.entries(replications).forEach(([name, rep]: [string, any]) => {
    if (rep && typeof rep.reSync === "function") {
      rep.reSync();
      SyncLogger.info("manual-sync", `reSync triggered for ${name}`);
    }
  });
}
