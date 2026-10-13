// Display-only: preserve the raw History instants and UTC query contract.
export function createHistoryDateFormatter(timeZone: string): { format(date: Date): string } {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    calendar: "gregory", numberingSystem: "latn", timeZone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return {
    format(date: Date): string {
      const parts = formatter.formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
      return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
    },
  };
}
