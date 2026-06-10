"use client";

/**
 * Convierte un arreglo de objetos planos en una cadena CSV compatible con Microsoft Excel.
 * Añade automáticamente el BOM UTF-8 (\ufeff) para asegurar que los caracteres especiales y acentos
 * (como "Válido", "Bodega", "Trazabilidad") se rendericen correctamente en Excel.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  data: T[],
  headers?: { key: keyof T; label: string }[]
) {
  if (!data.length) return;

  const keys = headers ? headers.map(h => h.key) : (Object.keys(data[0]!) as (keyof T)[]);
  const labels = headers ? headers.map(h => h.label) : (Object.keys(data[0]!) as string[]);

  // Cabeceras
  const csvRows = [
    labels.map(label => `"${String(label).replace(/"/g, '""')}"`).join(",")
  ];

  // Filas de datos
  for (const item of data) {
    const values = keys.map(key => {
      const val = item[key];
      const strVal = val === null || val === undefined ? "" : String(val);
      return `"${strVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvContent = "\ufeff" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
