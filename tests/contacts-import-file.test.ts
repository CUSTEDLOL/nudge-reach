import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  looksLikeHeader,
  parseCsvText,
  rowsFromUpload,
  MAX_IMPORT_FILE_BYTES,
} from "@/modules/contacts/import-file";

/** Contact import via uploaded .csv / .xlsx (falls into the same
 * consent-gated pipeline as pasted text — invariant 2 untouched). */

function fileOf(name: string, data: BlobPart, type = ""): File {
  return new File([data], name, { type });
}

describe("parseCsvText", () => {
  it("splits simple lines on commas and trims", () => {
    expect(parseCsvText("Priya, 98765, priya@x.com\nRahul,9123")).toEqual([
      ["Priya", "98765", "priya@x.com"],
      ["Rahul", "9123"],
    ]);
  });

  it("respects quoted fields with commas (Excel-style CSV)", () => {
    expect(parseCsvText('"Jain, Vishesh",98765,"a,b@x.com"')).toEqual([
      ["Jain, Vishesh", "98765", "a,b@x.com"],
    ]);
  });

  it("unescapes doubled quotes and skips blank lines", () => {
    expect(parseCsvText('"Say ""hi""",98765\n\n')).toEqual([
      ['Say "hi"', "98765"],
    ]);
  });
});

describe("looksLikeHeader", () => {
  it("detects a header row and leaves data rows alone", () => {
    expect(looksLikeHeader(["Name", "Phone Number", "Email"])).toBe(true);
    expect(looksLikeHeader(["Priya", "9876543210", ""])).toBe(false);
    expect(looksLikeHeader([])).toBe(false);
  });
});

describe("rowsFromUpload", () => {
  it("reads a CSV file, dropping the header row", async () => {
    const res = await rowsFromUpload(
      fileOf("list.csv", "name,phone\nPriya,9876543210", "text/csv")
    );
    expect(res).toEqual({ rows: [["Priya", "9876543210"]] });
  });

  it("reads an .xlsx sheet", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Name", "Phone", "Email"],
        ["Priya", 9876543210, "priya@x.com"],
        ["Rahul", "9123456780", ""],
      ]),
      "Sheet1"
    );
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const res = await rowsFromUpload(
      fileOf("list.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    );
    expect("rows" in res && res.rows).toEqual([
      ["Priya", "9876543210", "priya@x.com"],
      ["Rahul", "9123456780", ""],
    ]);
  });

  it("rejects oversized and unknown files with friendly errors", async () => {
    const big = fileOf("big.csv", new Uint8Array(MAX_IMPORT_FILE_BYTES + 1), "text/csv");
    const tooBig = await rowsFromUpload(big);
    expect("error" in tooBig).toBe(true);

    const weird = await rowsFromUpload(fileOf("notes.pdf", "x", "application/pdf"));
    expect("error" in weird).toBe(true);
  });
});
