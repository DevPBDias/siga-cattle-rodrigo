import { getDatabase } from "@/db/client";
import { Animal } from "@/types/animal.type";
import { ReproductionEvent } from "@/types/reproduction_event.type";
import { ReportDefinition, ReportGeneratorParams } from "./types";
import { generateReproductionPDF } from "../generators/reproduction";

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "---";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return "---";
  }
}

function calculateAge(birthDate: string | Date | undefined): string {
  if (!birthDate) return "---";
  const date = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(date.getTime())) return "---";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));

  if (diffMonths < 12) {
    return `${diffMonths} meses`;
  }

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  if (months === 0) {
    return `${years} ${years === 1 ? "ano" : "anos"}`;
  }

  return `${years}a ${months}m`;
}

async function generateReproductionReport(
  params: ReportGeneratorParams,
): Promise<void> {
  const { filters } = params;

  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized");

  // Fetch farms for mapping farm_id to farm_name
  const farmDocs = await db.farms
    .find({
      selector: { _deleted: { $eq: false } },
    })
    .exec();
  const farms = farmDocs.map((doc) => doc.toJSON());
  const farmMap = new Map(
    farms.map((f: { id: string; farm_name?: string }) => [
      f.id,
      f.farm_name || "",
    ]),
  );

  const animalSelector: any = {
    _deleted: { $eq: false },
    sex: { $eq: "F" },
  };

  if (
    filters.farmIds &&
    filters.farmIds.length > 0 &&
    filters.farmFilterMode !== "all"
  ) {
    // @ts-ignore
    animalSelector.farm_id =
      filters.farmIds.length === 1
        ? { $eq: filters.farmIds[0] }
        : { $in: filters.farmIds };
  } else if (filters.farmId && filters.farmFilterMode === "specific") {
    animalSelector.farm_id = { $eq: filters.farmId };
  }

  if (
    filters.animalState &&
    filters.animalStateFilterMode === "specific" &&
    filters.animalState !== "Ambos"
  ) {
    // @ts-ignore
    animalSelector.animal_state = { $eq: filters.animalState };
  }

  const animalDocs = await db.animals
    .find({
      selector: animalSelector,
    })
    .exec();

  const animals = animalDocs.map((doc) => doc.toJSON() as Animal);
  const animalRgns = animals.map((a) => a.rgn);

  const showFarmColumn = !filters.farmId || filters.farmFilterMode === "all";

  const animalMap = new Map(
    animals.map((a) => [
      a.rgn,
      { ...a, farmName: farmMap.get(a.farm_id || "") || "---" },
    ]),
  );

  const selector: Record<string, any> = {
    _deleted: { $eq: false },
    rgn: { $in: animalRgns },
  };

  // Fetch all events for the animals, then filter by management date in JS
  // (needed because filter must match d10_date OR d11_date)
  const eventDocs = await db.reproduction_events
    .find({
      selector,
      sort: [{ rgn: "asc" as const }],
    })
    .exec();

  const allDbEvents = eventDocs.map((doc) => doc.toJSON() as ReproductionEvent);
  let events = allDbEvents;

  if (filters.managementDates && filters.managementDates.length > 0) {
    const dateSet = new Set(filters.managementDates);
    events = events.filter(
      (e) =>
        (e.d10_date && dateSet.has(e.d10_date)) ||
        (e.d11_date && dateSet.has(e.d11_date)),
    );
  } else if (filters.startDate || filters.endDate) {
    events = events.filter((e) => {
      const pivot = e.d10_date || e.d11_date;
      if (!pivot) return false;
      if (filters.startDate && pivot < filters.startDate) return false;
      if (filters.endDate && pivot > filters.endDate) return false;
      return true;
    });
  }

  // Verificar se todas as datas do ano selecionado foram marcadas
  const allYearDates = Array.from(
    new Set(
      allDbEvents
        .flatMap((e) => [e.d10_date, e.d11_date])
        .filter((d): d is string => !!d && (!filters.year || d.startsWith(filters.year!))),
    ),
  );

  const isAllYearSelected =
    Boolean(filters.year) &&
    allYearDates.length > 0 &&
    filters.managementDates &&
    filters.managementDates.length > 0 &&
    (allYearDates.every((d) => filters.managementDates!.includes(d)) ||
      (filters.managementDates.every((d) => d.startsWith(filters.year!)) &&
        filters.managementDates.length >= allYearDates.length));

  let managementDateText = "Todas as datas";
  if (isAllYearSelected) {
    managementDateText = `Todas as inseminações de ${filters.year}`;
  } else if (filters.managementDates?.length) {
    if (filters.managementDates.length <= 3) {
      managementDateText = filters.managementDates.map((d) => formatDate(d)).join(", ");
    } else if (filters.year && filters.managementDates.every((d) => d.startsWith(filters.year!))) {
      managementDateText = `Inseminações de ${filters.year} (${filters.managementDates.length} datas)`;
    } else {
      managementDateText = `${filters.managementDates.length} datas selecionadas`;
    }
  } else if (filters.startDate) {
    managementDateText = `${formatDate(filters.startDate)} a ${formatDate(filters.endDate)}`;
  }

  const reportData = {
    farmName:
      filters.farmNames && filters.farmNames.length > 0
        ? filters.farmNames.join(", ")
        : filters.farmName || "Todas as Fazendas",
    showFarmColumn,
    managementDate: managementDateText,
    data: events
      .map((event) => {
        const animal = animalMap.get(event.rgn);
        return {
          rgn: event.rgn || "---",
          farmName: showFarmColumn ? animal?.farmName || "---" : undefined,
          idade: calculateAge(animal?.born_date),
          classification: animal?.classification || "---",
          bull_name: event.bull_name || "---",
          d0_date: formatDate(event.d0_date),
          d8_date: formatDate(event.d8_date),
          d10_date: formatDate(event.d10_date),
          resync_bull: event.resync_bull || "---",
          resync_d0: formatDate(event.d22_date),
          resync_d8: formatDate(event.d30_date),
          diagnostic_d30: event.diagnostic_d30 || "---",
          resync_d10: formatDate(event.d32_date),
        };
      }),
    reportDate: new Date().toLocaleDateString("pt-BR"),
    systemName: "Rico Ouro",
  };

  await generateReproductionPDF(reportData);
}

export const reproductionDefinition: ReportDefinition = {
  id: "reproduction",
  title: "Reprodução",
  description:
    "Lista os eventos de manejo reprodutivo dos animais (de uma fazenda específica ou todas) em um período",
  icon: "Heart",
  requiredFilters: ["managementDates"],
  allowColumnSelection: false,
  generate: generateReproductionReport,
};
