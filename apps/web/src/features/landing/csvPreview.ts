/** Mirrors the server's CSV cell rules (apps/api/src/utils/csv.ts) for the landing-page illustration. */
export function csvPreviewCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
