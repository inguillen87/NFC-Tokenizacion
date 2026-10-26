import type { AppLocale } from "@product/config";

export type DataTableCopy = {
  searchPlaceholder: string; allFilterLabel: string; refreshLabel: string;
  filterLabel: string; countLabel: string; filteredEmptyLabel: string;
  clearFiltersLabel: string; missingStatusLabel: string;
};

export const dataTableCopy: Record<AppLocale, DataTableCopy> = {
  "es-AR": {
    searchPlaceholder: "Buscar", allFilterLabel: "Todos", refreshLabel: "Actualizar",
    filterLabel: "Filtrar por estado", countLabel: "{visible} de {total} filas visibles",
    filteredEmptyLabel: "No hay coincidencias con los filtros actuales.",
    clearFiltersLabel: "Limpiar filtros", missingStatusLabel: "sin filas en esta vista",
  },
  "pt-BR": {
    searchPlaceholder: "Buscar", allFilterLabel: "Todos", refreshLabel: "Atualizar",
    filterLabel: "Filtrar por estado", countLabel: "{visible} de {total} linhas visíveis",
    filteredEmptyLabel: "Nenhum resultado com os filtros atuais.",
    clearFiltersLabel: "Limpar filtros", missingStatusLabel: "sem linhas nesta visualização",
  },
  en: {
    searchPlaceholder: "Search", allFilterLabel: "All", refreshLabel: "Refresh",
    filterLabel: "Filter by status", countLabel: "{visible} of {total} rows visible",
    filteredEmptyLabel: "No matches for the current filters.",
    clearFiltersLabel: "Clear filters", missingStatusLabel: "no rows in this view",
  },
};
