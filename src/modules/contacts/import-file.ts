/**
 * Contact-list file import (.csv / .xlsx). Pure parsing only: everything
 * here returns rows of trimmed cells; the consent gate, phone normalizing,
 * dedupe and the never-resurrect-an-opt-out rule all stay in the one
 * import pipeline in contacts/actions.ts (invariant 2 has a single door).
 */

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_IMPORT_ROWS = 2000;

/** Minimal quote-aware CSV: handles "a, b", doubled quotes, blank lines. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

/** "Name, Phone, Email" on top of an export — drop it, keep real people. */
export function looksLikeHeader(row: string[]): boolean {
  if (row.length === 0) return false;
  const joined = row.join(" ").toLowerCase();
  const mentionsColumns = /\b(name|phone|mobile|number|email|contact)\b/.test(joined);
  const hasDigits = row.some((c) => /\d{4,}/.test(c));
  return mentionsColumns && !hasDigits;
}

export type UploadRows = { rows: string[][] } | { error: string };

const CSV_NAME = /\.(csv|txt)$/i;
const EXCEL_NAME = /\.(xlsx|xls)$/i;

/** File → rows of cells. Never throws; unknown/oversized files come back
 * as a friendly error string for the form. */
export async function rowsFromUpload(file: File): Promise<UploadRows> {
  if (file.size === 0) return { error: "That file is empty." };
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { error: "That file is too large — 2 MB max. Split the list and import in parts." };
  }

  let rows: string[][];
  if (EXCEL_NAME.test(file.name) || file.type.includes("spreadsheetml") || file.type === "application/vnd.ms-excel") {
    try {
      // Server-only dependency; loaded lazily so it never enters a client bundle.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return { error: "That spreadsheet has no sheets." };
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      rows = raw
        .map((r) => r.map((c) => String(c ?? "").trim()))
        .filter((r) => r.some(Boolean));
    } catch {
      return { error: "Couldn't read that spreadsheet — export it as CSV and try again." };
    }
  } else if (CSV_NAME.test(file.name) || file.type.startsWith("text/") || file.type === "application/csv" || file.type === "") {
    rows = parseCsvText(await file.text());
  } else {
    return { error: "Upload a .csv or Excel (.xlsx) file." };
  }

  if (rows.length > 0 && looksLikeHeader(rows[0])) rows = rows.slice(1);
  if (rows.length === 0) return { error: "No contact rows found in that file." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `That's ${rows.length} rows — the limit is ${MAX_IMPORT_ROWS} per import. Split the file and go again.` };
  }
  return { rows };
}
