/**
 * CSV encoding that is safe to open in spreadsheet software.
 *
 * Formula injection: a cell beginning with = + - @ (or tab / carriage return,
 * which some apps strip before evaluating) can execute as a formula. Such cells
 * are prefixed with a single quote so they are shown as text.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function neutraliseFormula(value: string): string {
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value;
}

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? neutraliseFormula(value) : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvRow(values: ReadonlyArray<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(',');
}

/** Restricts a filename to a safe character set for Content-Disposition. */
export function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
}
