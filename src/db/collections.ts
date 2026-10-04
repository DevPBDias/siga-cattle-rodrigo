import { RxCollection, RxDatabase } from "rxdb";

import { RxReplicationState } from "rxdb/plugins/replication";
import { AnimalMetric } from "@/types/animal_metrics.type";
import { Animal } from "@/types/animal.type";
import { AnimalVaccine, Vaccine } from "@/types/vaccine.type";
import { Farm } from "@/types/farm.type";
import { ReproductionEvent } from "@/types/reproduction_event.type";
import { AnimalStatus } from "@/types/status.type";
import { AnimalSituation } from "@/types/situation.type";
import { SemenDose } from "@/types/semen_dose.type";
import { Client } from "@/types/client.type";
import { Sale } from "@/types/sale.type";
import { Death } from "@/types/death.type";
import { Exchange } from "@/types/exchange.type";

import { Movement } from "@/types/movement.type";
import { OrganizationSettings } from "@/types/organization_settings.type";

export type AnimalCollection = RxCollection<Animal>;
export type VaccineCollection = RxCollection<Vaccine>;
export type FarmCollection = RxCollection<Farm>;
export type AnimalMetricWeightCollection = RxCollection<AnimalMetric>;
export type AnimalMetricCECollection = RxCollection<AnimalMetric>;
export type AnimalVaccineCollection = RxCollection<AnimalVaccine>;
export type ReproductionCollection = RxCollection<ReproductionEvent>;
export type AnimalStatusCollection = RxCollection<AnimalStatus>;
export type AnimalSituationCollection = RxCollection<AnimalSituation>;
export type SemenDoseCollection = RxCollection<SemenDose>;
export type ClientCollection = RxCollection<Client>;
export type MovementCollection = RxCollection<Movement>;
export type SaleCollection = RxCollection<Sale>;
export type DeathCollection = RxCollection<Death>;
export type ExchangeCollection = RxCollection<Exchange>;
export type OrganizationSettingsCollection = RxCollection<OrganizationSettings>;

export type MyDatabaseCollections = {
  animals: AnimalCollection;
  vaccines: VaccineCollection;
  farms: FarmCollection;
  animal_metrics_weight: AnimalMetricWeightCollection;
  animal_metrics_ce: AnimalMetricCECollection;
  animal_vaccines: AnimalVaccineCollection;
  reproduction_events: ReproductionCollection;
  animal_statuses: AnimalStatusCollection;
  animal_situations: AnimalSituationCollection;
  semen_doses: SemenDoseCollection;
  clients: ClientCollection;
  movements: MovementCollection;
  sales: SaleCollection;
  deaths: DeathCollection;
  exchanges: ExchangeCollection;
  organization_settings: OrganizationSettingsCollection;
};

export type MyDatabase = RxDatabase<MyDatabaseCollections> & {
  replications?: {
    animals: RxReplicationState<Animal, any>;
    vaccines: RxReplicationState<Vaccine, any>;
    farms: RxReplicationState<Farm, any>;
    animal_metrics_weight: RxReplicationState<AnimalMetric, any>;
    animal_metrics_ce: RxReplicationState<AnimalMetric, any>;
    animal_vaccines: RxReplicationState<AnimalVaccine, any>;
    reproduction_events: RxReplicationState<ReproductionEvent, any>;
    animal_statuses: RxReplicationState<AnimalStatus, any>;
    animal_situations: RxReplicationState<AnimalSituation, any>;
    semen_doses: RxReplicationState<SemenDose, any>;
    clients: RxReplicationState<Client, any>;
    movements: RxReplicationState<Movement, any>;
    sales: RxReplicationState<Sale, any>;
    deaths: RxReplicationState<Death, any>;
    exchanges: RxReplicationState<Exchange, any>;
    organization_settings: RxReplicationState<OrganizationSettings, any>;
  };
};
