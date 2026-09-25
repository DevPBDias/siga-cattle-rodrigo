import { createReplication } from "./base";
import { ReproductionEvent } from "@/types/reproduction_event.type";
import { cleanSupabaseDocument } from "@/lib/supabase/auth-helper";

export const reproductionEventReplication = createReplication<ReproductionEvent>({
  collectionName: "reproduction_events",
  tableName: "reproduction_events",
  replicationIdentifier: "reproduction-events-replication-v14",

  mapToSupabase: (doc) => ({
    event_id: doc.event_id,
    rgn: doc.rgn,
    event_type: doc.event_type,
    productive_status: doc.productive_status ?? null,
    age: doc.age ?? null,
    evaluation_date: doc.evaluation_date ?? null,
    body_score: doc.body_score ?? null,
    gestational_condition: doc.gestational_condition ?? null,
    ovary_size: doc.ovary_size ?? null,
    ovary_structure: doc.ovary_structure ?? null,
    cycle_stage: doc.cycle_stage ?? null,
    protocol_name: doc.protocol_name ?? null,
    d0_date: doc.d0_date,
    d8_date: doc.d8_date ?? null,
    d10_date: doc.d10_date ?? null,
    d11_date: doc.d11_date ?? null,
    bull_name: doc.bull_name ?? null,
    d22_date: doc.d22_date ?? null,
    d30_date: doc.d30_date ?? null,
    diagnostic_d30: doc.diagnostic_d30 ?? null,
    d32_date: doc.d32_date ?? null,
    resync_bull: doc.resync_bull ?? null,
    calving_start_date: doc.calving_start_date ?? null,
    calving_end_date: doc.calving_end_date ?? null,
    natural_mating_d35_entry: doc.natural_mating_d35_entry ?? null,
    natural_mating_bull: doc.natural_mating_bull ?? null,
    natural_mating_d80_exit: doc.natural_mating_d80_exit ?? null,
    d110_date: doc.d110_date ?? null,
    final_diagnostic: doc.final_diagnostic ?? null,
    pregnancy_origin: doc.pregnancy_origin ?? null,
    created_at: doc.created_at ?? null,
    updated_at: doc.updated_at,
    _deleted: doc._deleted,
  }),

  mapFromSupabase: (doc) => {
    const cleaned = cleanSupabaseDocument(doc);
    delete cleaned.id; // Remove Supabase-specific ID as we use event_id
    return cleaned as unknown as ReproductionEvent;
  },
});

export async function replicateReproductionEventsNew(
  db: Parameters<typeof reproductionEventReplication>[0],
  supabaseUrl: string,
  supabaseKey: string
) {
  return reproductionEventReplication(db, supabaseUrl, supabaseKey);
}

