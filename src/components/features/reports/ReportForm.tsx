"use client";

import React, { useMemo } from "react";
import { useReports } from "@/context/ReportsContext";
import { useFarms } from "@/hooks/db/farms/useFarms";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckSquare, Square } from "lucide-react";
import {
  GenderFilterValue,
  AnimalStateFilterValue,
} from "@/lib/pdf/definitions/types";
import { useReproductionEvents } from "@/hooks/db/reproduction_event/useReproductionEvents";
import { useStatuses } from "@/hooks/db/statuses/useStatuses";
import { useAnimals } from "@/hooks/db/animals/useAnimals";
import { Checkbox } from "@/components/ui/checkbox";
import { reproductionByCowDefinition } from "@/lib/pdf/definitions/reproductionByCow.definition";
import {
  ANIMAL_REPORT_AVAILABLE_COLUMNS,
  REPRODUCTION_REPORT_AVAILABLE_COLUMNS,
  MAX_SELECTABLE_COLUMNS,
} from "@/lib/pdf/definitions/availableColumns";
import { ReportCheckboxItem } from "./ReportCheckboxItem";
import { FarmFilterModal } from "./FarmFilterModal";
import { SexFilterModal } from "./SexFilterModal";
import { StatusFilterModal } from "./StatusFilterModal";
import { ClassFilterModal } from "./ClassFilterModal";
import { SocietyFilterModal } from "./SocietyFilterModal";
import { AnimalStateFilterModal } from "./AnimalStateFilterModal";
import { TableColumn } from "@/lib/pdf/types";

export function ReportForm() {
  const {
    selectedReport,
    filters,
    isGenerating,
    validationErrors,
    updateFilters,
    toggleColumn,
    generateReport,
  } = useReports();

  // Hooks must be called unconditionally (before any early returns)
  const { data: farms = [] } = useFarms();
  const { data: statuses = [] } = useStatuses();
  const { data: allEvents = [] } = useReproductionEvents();
  const { data: animals = [] } = useAnimals();

  const [farmModalOpen, setFarmModalOpen] = React.useState(false);
  const [sexModalOpen, setSexModalOpen] = React.useState(false);
  const [statusModalOpen, setStatusModalOpen] = React.useState(false);
  const [classModalOpen, setClassModalOpen] = React.useState(false);
  const [societyModalOpen, setSocietyModalOpen] = React.useState(false);
  const [animalStateModalOpen, setAnimalStateModalOpen] = React.useState(false);
  const [isGeneratingCowReport, setIsGeneratingCowReport] = React.useState(false);

  // Filter animals by selected farm (or all if no farm selected or filterMode is "all")
  const farmAnimals = useMemo(() => {
    if (
      (!filters.farmId && (!filters.farmIds || filters.farmIds.length === 0)) ||
      filters.farmFilterMode === "all"
    ) {
      return animals;
    }
    // Multi-farm support
    if (filters.farmIds && filters.farmIds.length > 0) {
      const farmIdSet = new Set(filters.farmIds);
      return animals.filter((a) => a.farm_id && farmIdSet.has(a.farm_id));
    }
    return animals.filter((a) => a.farm_id === filters.farmId);
  }, [animals, filters.farmId, filters.farmIds, filters.farmFilterMode]);

  const farmAnimalRgns = useMemo(
    () => new Set(farmAnimals.map((a) => a.rgn)),
    [farmAnimals],
  );

  // Filter events by farm animals (or all if no farm selected or filterMode is "all")
  const farmEvents = useMemo(() => {
    if (!filters.farmId || filters.farmFilterMode === "all") {
      return allEvents;
    }
    return allEvents.filter((e) => farmAnimalRgns.has(e.rgn));
  }, [allEvents, farmAnimalRgns, filters.farmId, filters.farmFilterMode]);

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          farmEvents
            .flatMap((e) => [
              e.d10_date ? e.d10_date.split("-")[0] : null,
              (e as any).d11_date ? (e as any).d11_date.split("-")[0] : null,
            ])
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [farmEvents],
  );

  const availableDatesForYear = useMemo(
    () =>
      Array.from(
        new Set(
          farmEvents.flatMap((e) => {
            const dates: string[] = [];
            if (e.d10_date && (!filters.year || e.d10_date.startsWith(filters.year!)))
              dates.push(e.d10_date);
            if (
              (e as any).d11_date &&
              (!filters.year || (e as any).d11_date.startsWith(filters.year!))
            )
              dates.push((e as any).d11_date);
            return dates;
          }),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [farmEvents, filters.year],
  );

  const availableSocieties = useMemo(
    () =>
      Array.from(
        new Set(animals.map((a) => a.partnership).filter(Boolean)),
      ) as string[],
    [animals],
  );

  if (!selectedReport) return null;

  // Handle farm filter from modal
  const handleFarmFilterConfirm = (
    farmIds: string[],
    farmNames: string[],
    filterMode: "all" | "specific" | "multiple",
  ) => {
    updateFilters({
      farmId: farmIds.length === 1 ? farmIds[0] : undefined,
      farmIds,
      farmName: farmNames.length === 1 ? farmNames[0] : undefined,
      farmNames,
      farmFilterMode: filterMode,
    });
  };

  // Handle sex filter from modal
  const handleSexFilterConfirm = (
    sex: GenderFilterValue | undefined,
    filterMode: "all" | "specific",
  ) => {
    updateFilters({
      sex: sex || "Ambos",
      sexFilterMode: filterMode,
    });
  };

  // Handle status filter from modal
  const handleStatusFilterConfirm = (
    status: string | undefined,
    filterMode: "all" | "specific",
  ) => {
    updateFilters({
      status: status || "Todos",
      statusFilterMode: filterMode,
    });
  };

  // Handle class filter from modal
  const handleClassFilterConfirm = (
    classes: string[] | undefined,
    filterMode: "all" | "specific",
  ) => {
    updateFilters({
      classes: classes || [],
      classFilterMode: filterMode,
    });
  };

  // Handle society filter from modal
  const handleSocietyFilterConfirm = (
    society: string | undefined,
    filterMode: "all" | "specific",
  ) => {
    updateFilters({
      society: society || "",
      societyFilterMode: filterMode,
    });
  };

  // Handle animal state filter from modal
  const handleAnimalStateFilterConfirm = (
    animalState: AnimalStateFilterValue | undefined,
    filterMode: "all" | "specific",
  ) => {
    updateFilters({
      animalState: animalState || "Ambos",
      animalStateFilterMode: filterMode,
    });
  };

  // Custom toggle for filter columns - opens modal instead
  const handleColumnToggle = (column: TableColumn) => {
    if (column.dataKey === "farmName") {
      // Se está desmarcando, remover filtro
      const isChecked =
        filters.selectedColumns?.some((c) => c.dataKey === "farmName") ?? false;
      if (isChecked) {
        updateFilters({
          farmId: undefined,
          farmIds: [],
          farmName: undefined,
          farmNames: [],
          farmFilterMode: undefined,
        });
        toggleColumn(column);
      } else {
        // Se está marcando, abrir modal
        setFarmModalOpen(true);
      }
    } else if (column.dataKey === "sex") {
      // Se está desmarcando, remover filtro
      const isChecked =
        filters.selectedColumns?.some((c) => c.dataKey === "sex") ?? false;
      if (isChecked) {
        updateFilters({
          sex: undefined,
          sexFilterMode: undefined,
        });
        toggleColumn(column);
      } else {
        // Se está marcando, abrir modal
        setSexModalOpen(true);
      }
    } else if (column.dataKey === "status") {
      // Se está desmarcando, remover filtro
      const isChecked =
        filters.selectedColumns?.some((c) => c.dataKey === "status") ?? false;
      if (isChecked) {
        updateFilters({
          status: undefined,
          statusFilterMode: undefined,
        });
        toggleColumn(column);
      } else {
        // Se está marcando, abrir modal
        setStatusModalOpen(true);
      }
    } else if (column.dataKey === "classification") {
      // Se está desmarcando, remover filtro
      const isChecked =
        filters.selectedColumns?.some((c) => c.dataKey === "classification") ??
        false;
      if (isChecked) {
        updateFilters({
          classes: [],
          classFilterMode: undefined,
        });
        toggleColumn(column);
      } else {
        // Se está marcando, abrir modal
        setClassModalOpen(true);
      }
    } else if (column.dataKey === "society") {
      // Se está desmarcando, remover filtro
      const isChecked =
        filters.selectedColumns?.some((c) => c.dataKey === "society") ?? false;
      if (isChecked) {
        updateFilters({
          society: undefined,
          societyFilterMode: undefined,
        });
        toggleColumn(column);
      } else {
        // Se está marcando, abrir modal
        setSocietyModalOpen(true);
      }
    } else if (column.dataKey === "animalState") {
      // Se está desmarcando, remover filtro
      const isChecked =
        filters.selectedColumns?.some((c) => c.dataKey === "animalState") ??
        false;
      if (isChecked) {
        updateFilters({
          animalState: undefined,
          animalStateFilterMode: undefined,
        });
        toggleColumn(column);
      } else {
        // Se está marcando, abrir modal
        setAnimalStateModalOpen(true);
      }
    } else {
      toggleColumn(column);
    }
  };

  // Get validation error for a field
  const getError = (field: string): string | undefined => {
    return validationErrors.find((e) => e.field === field)?.message;
  };

  const isClassColumnSelected =
    filters.selectedColumns?.some((c) => c.dataKey === "classification") ??
    false;
  const isSocietyColumnSelected =
    filters.selectedColumns?.some((c) => c.dataKey === "society") ?? false;

  const effectiveMaxColumns = MAX_SELECTABLE_COLUMNS;
  const columnCount = filters.selectedColumns?.length || 0;
  const maxColumnsReached = columnCount >= effectiveMaxColumns;

  const handleYearChange = (year: string) => {
    updateFilters({ year, managementDates: [] });
  };

  const toggleManagementDate = (date: string) => {
    const currentDates = filters.managementDates || [];
    if (currentDates.includes(date)) {
      updateFilters({
        managementDates: currentDates.filter((d) => d !== date),
      });
    } else {
      updateFilters({ managementDates: [...currentDates, date] });
    }
  };

  const areAllDatesSelected = useMemo(() => {
    if (!availableDatesForYear.length) return false;
    const selected = filters.managementDates || [];
    return availableDatesForYear.every((d) => selected.includes(d));
  }, [availableDatesForYear, filters.managementDates]);

  const handleToggleAllDatesForYear = () => {
    if (areAllDatesSelected) {
      updateFilters({ managementDates: [] });
    } else {
      updateFilters({ managementDates: [...availableDatesForYear] });
    }
  };

  const handleGenerateReproductionByCowReport = async () => {
    setIsGeneratingCowReport(true);
    try {
      await reproductionByCowDefinition.generate({ filters });
    } catch (error) {
      console.error("[ReportForm] Error generating reproduction by cow report:", error);
    } finally {
      setIsGeneratingCowReport(false);
    }
  };

  return (
    <div className="w-full border border-border rounded-xl p-6 space-y-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-black text-primary uppercase tracking-tight">
          {selectedReport.title}
        </h2>
        <p className="text-xs text-muted-foreground italic">
          {selectedReport.description}
        </p>
      </div>

      <div className="space-y-4 w-full">
        <h3 className="font-bold text-[11px] uppercase text-muted-foreground border-b border-border/60 pb-1 mb-2">
          Filtros do Relatório
        </h3>

        <div className="flex flex-col md:flex-row gap-4 w-full">
          {/* Reproduction Year Filter */}
          {selectedReport.id === "reproduction" && (
            <div className="space-y-1 md:w-32">
              <Label
                htmlFor="year"
                className="text-[10px] font-bold uppercase text-primary tracking-tight"
              >
                Ano
              </Label>
              <Select
                value={filters.year || ""}
                onValueChange={handleYearChange}
              >
                <SelectTrigger
                  id="year"
                  className="w-full h-11 bg-muted/40 border-0 focus:ring-primary"
                >
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-xl">
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year} className="rounded-lg">
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Reproduction Management Dates Checklist */}
        {selectedReport.id === "reproduction" &&
          filters.year &&
          availableDatesForYear.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-bold uppercase text-primary tracking-tight">
                    Datas de Manejo
                  </Label>
                  {filters.managementDates && filters.managementDates.length > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {filters.managementDates.length} de {availableDatesForYear.length} selecionada{filters.managementDates.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAllDatesForYear}
                  className="h-7 px-2.5 text-xs font-bold text-primary border-primary/40 hover:bg-primary/10 transition-colors"
                >
                  {areAllDatesSelected ? (
                    <>
                      <Square className="w-3.5 h-3.5 mr-1 text-primary" />
                      Desmarcar todas
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 mr-1 text-primary" />
                      Selecionar todas de {filters.year}
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-muted/30 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 border border-border/30 max-h-48 overflow-y-auto">
                {availableDatesForYear.map((date) => (
                  <div
                    key={date}
                    className="flex items-center space-x-2 bg-white/50 dark:bg-zinc-800/50 p-2 rounded-lg border border-border/40 transition-colors hover:border-primary/40"
                  >
                    <Checkbox
                      id={`date-${date}`}
                      checked={filters.managementDates?.includes(date)}
                      onCheckedChange={() => toggleManagementDate(date)}
                      className="rounded-md border-primary/40 text-primary focus-visible:ring-primary"
                    />
                    <Label
                      htmlFor={`date-${date}`}
                      className="text-[11px] font-bold text-muted-foreground cursor-pointer select-none"
                    >
                      {new Date(date).toLocaleDateString("pt-BR", {
                        timeZone: "UTC",
                      })}
                    </Label>
                  </div>
                ))}
              </div>
              {getError("managementDates") && (
                <p className="text-xs text-red-500 flex items-center gap-1.5 px-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {getError("managementDates")}
                </p>
              )}
            </div>
          )}
      </div>

      {/* Sorting Option - Only for animals-by-farm report */}
      {selectedReport.id === "animals-by-farm" && (
        <div className="space-y-2 pt-2">
          <Label className="text-[10px] font-bold uppercase text-primary tracking-tight">
            Ordenar por
          </Label>
          <div className="flex gap-3">
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                filters.sortBy === "rgn" || !filters.sortBy
                  ? "bg-primary/10 border-primary text-primary font-bold"
                  : "bg-muted/40 border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="sortBy"
                value="rgn"
                checked={filters.sortBy === "rgn" || !filters.sortBy}
                onChange={() => updateFilters({ sortBy: "rgn" })}
                className="sr-only"
              />
              <span className="text-xs">RGN</span>
            </label>
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                filters.sortBy === "classification"
                  ? "bg-primary/10 border-primary text-primary font-bold"
                  : "bg-muted/40 border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="sortBy"
                value="classification"
                checked={filters.sortBy === "classification"}
                onChange={() => updateFilters({ sortBy: "classification" })}
                className="sr-only"
              />
              <span className="text-xs">Classe</span>
            </label>
          </div>
        </div>
      )}

      {/* Column Selection */}
      {selectedReport.allowColumnSelection && (
        <div className="space-y-4 pt-4 border-t border-border/40">
          <div className="flex justify-between items-end">
            <div>
              <Label className="text-[10px] font-bold uppercase text-primary tracking-tight">
                Colunas de Dados
              </Label>
              <p className="text-[10px] text-muted-foreground italic leading-tight">
                RGD / RGN é sempre incluída primeiro. Máximo de{" "}
                {effectiveMaxColumns} colunas.
              </p>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                maxColumnsReached
                  ? "bg-amber-100 text-amber-700"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {columnCount} / {effectiveMaxColumns}
            </span>
          </div>

          <div className="bg-muted/30 rounded-xl px-1.5 py-2 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1 border border-border/30">
            {(selectedReport.id === "reproduction"
              ? REPRODUCTION_REPORT_AVAILABLE_COLUMNS
              : ANIMAL_REPORT_AVAILABLE_COLUMNS
            ).map((column) => {
              const isChecked =
                filters.selectedColumns?.some(
                  (c) => c.dataKey === column.dataKey,
                ) ?? false;

              // Default check for disabled state
              const isDisabled = maxColumnsReached && !isChecked;

              return (
                <div key={column.dataKey} className="flex items-center">
                  <ReportCheckboxItem
                    id={column.dataKey}
                    label={column.header}
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={() => handleColumnToggle(column)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Modals */}
      <FarmFilterModal
        open={farmModalOpen}
        onOpenChange={setFarmModalOpen}
        farms={farms}
        currentFarmIds={
          filters.farmIds || (filters.farmId ? [filters.farmId] : [])
        }
        currentFilterMode={filters.farmFilterMode || "all"}
        onConfirm={(farmIds, farmNames, filterMode) => {
          handleFarmFilterConfirm(farmIds, farmNames, filterMode);
          const isFarmColumnSelected =
            filters.selectedColumns?.some((c) => c.dataKey === "farmName") ??
            false;
          if (!isFarmColumnSelected) {
            toggleColumn({ header: "FAZENDA", dataKey: "farmName" });
          }
        }}
      />

      <SexFilterModal
        open={sexModalOpen}
        onOpenChange={setSexModalOpen}
        currentSex={filters.sex}
        currentFilterMode={filters.sexFilterMode || "all"}
        onConfirm={(sex, filterMode) => {
          handleSexFilterConfirm(sex, filterMode);
          const isSexColumnSelected =
            filters.selectedColumns?.some((c) => c.dataKey === "sex") ?? false;
          if (!isSexColumnSelected) {
            toggleColumn({ header: "SEXO", dataKey: "sex" });
          }
        }}
      />

      <StatusFilterModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        statuses={statuses}
        currentStatus={filters.status}
        currentFilterMode={filters.statusFilterMode || "all"}
        onConfirm={(status, filterMode) => {
          handleStatusFilterConfirm(status, filterMode);
          const isStatusColumnSelected =
            filters.selectedColumns?.some((c) => c.dataKey === "status") ??
            false;
          if (!isStatusColumnSelected) {
            toggleColumn({ header: "STATUS", dataKey: "status" });
          }
        }}
      />

      <ClassFilterModal
        open={classModalOpen}
        onOpenChange={setClassModalOpen}
        currentClasses={filters.classes}
        currentFilterMode={filters.classFilterMode || "all"}
        onConfirm={(classes, filterMode) => {
          handleClassFilterConfirm(classes, filterMode);
          if (!isClassColumnSelected) {
            toggleColumn({ header: "CLASSE", dataKey: "classification" });
          }
        }}
      />

      <SocietyFilterModal
        open={societyModalOpen}
        onOpenChange={setSocietyModalOpen}
        societies={availableSocieties}
        currentSociety={filters.society}
        currentFilterMode={filters.societyFilterMode || "all"}
        onConfirm={(society, filterMode) => {
          handleSocietyFilterConfirm(society, filterMode);
          if (!isSocietyColumnSelected) {
            toggleColumn({ header: "SOCIEDADE", dataKey: "society" });
          }
        }}
      />

      <AnimalStateFilterModal
        open={animalStateModalOpen}
        onOpenChange={setAnimalStateModalOpen}
        currentValue={filters.animalState}
        currentFilterMode={filters.animalStateFilterMode || "all"}
        onConfirm={(animalState, filterMode) => {
          handleAnimalStateFilterConfirm(animalState, filterMode || "all");
          const isAnimalStateColumnSelected =
            filters.selectedColumns?.some((c) => c.dataKey === "animalState") ??
            false;
          if (!isAnimalStateColumnSelected) {
            toggleColumn({ header: "ATIVIDADE", dataKey: "animalState" });
          }
        }}
      />

      <div className="pt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <Button
          onClick={generateReport}
          disabled={isGenerating || isGeneratingCowReport}
          className="h-11 px-10 uppercase font-black text-xs tracking-wider shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Gerando Relatório...
            </>
          ) : (
            "Gerar Relatório"
          )}
        </Button>

        {selectedReport.id === "reproduction" && (
          <Button
            onClick={handleGenerateReproductionByCowReport}
            disabled={isGenerating || isGeneratingCowReport}
            variant="secondary"
            className="h-11 px-6 uppercase font-black text-xs tracking-wider shadow-lg w-full md:w-auto"
          >
            {isGeneratingCowReport ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando relatório por vaca...
              </>
            ) : (
              "Gerar relatório por vaca"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
