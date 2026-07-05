/**
 * CSV field encoding shared by every export route.
 *
 * RFC-4180 quoting + formula-injection defense (CWE-1236): a leading
 * = + - @ tab or CR would execute as a formula in Excel/Sheets, so it gets a
 * neutralizing apostrophe before the usual quoting.
 */
export function csvField(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

/** Join a row of already-stringified cells into one CSV line. */
export function csvRow(cells: string[]): string {
  return cells.map(csvField).join(",");
}
