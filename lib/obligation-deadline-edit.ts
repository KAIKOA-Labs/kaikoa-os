/** Browser-local wall time; no default date and no rounding of unchanged instants. */
export function deadlineInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part: number, size = 2) => String(part).padStart(size, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function deadlineValue(input: string, original: string | null): string | null {
  if (!input) return null;
  if (original && input === deadlineInput(original)) return original;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input)) throw new Error("Enter a complete date and time.");
  const normalized = input.length === 16 ? `${input}:00` : input;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1 || deadlineInput(date.toISOString()) !== normalized) {
    throw new Error("This date or local time is invalid. Check the date and timezone.");
  }
  const iso = date.toISOString();
  if (!/^\d{4}-/.test(iso) || iso.startsWith("0000-")) throw new Error("Enter a date in years 0001 through 9999.");
  return iso;
}
