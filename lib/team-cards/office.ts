import { strFromU8 } from "fflate";
import Papa from "papaparse";
import type { TeamCardExtract, TeamCardSourceKind } from "./model";
import { buildExtract, rowsFromTables } from "./rows";
import { unzipLimited } from "../zip-limit";

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function texts(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => decodeXml(match[1]));
}

function blocks(xml: string, name: string): string[] {
  const open = `<${name}`;
  const close = `</${name}>`;
  const found: string[] = [];
  let from = 0;
  while (from < xml.length) {
    const start = xml.indexOf(open, from);
    if (start < 0) break;
    const boundary = xml[start + open.length];
    if (boundary !== ">" && boundary !== " " && boundary !== "/" && boundary !== "\n" && boundary !== "\r" && boundary !== "\t") {
      from = start + open.length;
      continue;
    }
    const end = xml.indexOf(close, start + open.length);
    if (end < 0) break;
    found.push(xml.slice(start, end + close.length));
    from = end + close.length;
  }
  return found;
}

export function readDocx(bytes: Uint8Array): { tables: string[][][]; text: string } {
  const xml = xmlEntry(bytes, ["word/document.xml"]);
  const text = texts(xml).join(" ");
  const tables: string[][][] = [];
  for (const table of blocks(xml, "w:tbl")) {
    const rows: string[][] = [];
    for (const row of blocks(table, "w:tr")) {
      const cells: string[] = [];
      for (const cell of blocks(row, "w:tc")) {
        cells.push(
          texts(cell)
            .join("")
            .replace(/\s+/g, " ")
            .trim()
        );
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }
  return { tables, text };
}

function xmlEntry(bytes: Uint8Array, names: string[]): string {
  const files = unzipLimited(bytes, (name) => names.includes(name));
  for (const name of names) {
    const file = files[name];
    if (file) return strFromU8(file);
  }
  throw new Error("This file does not contain a readable table.");
}

function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref) {
    if (!/[A-Za-z]/.test(char)) break;
    index = index * 26 + char.toUpperCase().charCodeAt(0) - 64;
  }
  return index - 1;
}

function sharedStrings(xml: string): string[] {
  return blocks(xml, "si").map((item) =>
    [...item.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((match) => decodeXml(match[1])).join("")
  );
}

export function readXlsx(bytes: Uint8Array): { tables: string[][][]; text: string } {
  const files = unzipLimited(
    bytes,
    (name) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
  );
  const sheetName = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort()[0];
  const sheetFile = sheetName ? files[sheetName] : undefined;
  if (!sheetFile) throw new Error("This workbook does not contain a readable sheet.");
  const sheet = strFromU8(sheetFile);
  const sharedFile = files["xl/sharedStrings.xml"];
  const shared = sharedFile ? sharedStrings(strFromU8(sharedFile)) : [];
  const rows: string[][] = [];

  for (const row of blocks(sheet, "row")) {
    const inner = row.slice(row.indexOf(">") + 1);
    const cells: string[] = [];
    for (const cell of blocks(inner, "c")) {
      const tagEnd = cell.indexOf(">");
      const tag = cell.slice(0, tagEnd);
      const body = cell.slice(tagEnd + 1);
      const ref = /r="([A-Z]+)\d+"/i.exec(tag);
      const index = ref ? columnIndex(ref[1]) : cells.length;
      const kind = /t="([^"]+)"/.exec(tag)?.[1] ?? "";
      let value = "";
      if (kind === "inlineStr") {
        value = [...body.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
      } else {
        const rawStart = body.indexOf("<v");
        const raw = rawStart < 0 ? "" : body.slice(body.indexOf(">", rawStart) + 1, body.indexOf("</v>"));
        value = kind === "s" ? (shared[Number(raw)] ?? "") : decodeXml(raw);
      }
      while (cells.length < index) cells.push("");
      cells[index] = value.replace(/\s+/g, " ").trim();
    }
    if (cells.some((cell) => cell.length > 0)) rows.push(cells);
  }

  return { tables: rows.length ? [rows] : [], text: rows.flat().join(" ") };
}

export function readCsv(text: string): { tables: string[][][]; text: string } {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: false });
  const rows = parsed.data
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? "").replace(/\s+/g, " ").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
  return { tables: rows.length ? [rows] : [], text: rows.flat().join(" ") };
}

export function sourceKindFor(fileName: string): TeamCardSourceKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "csv") return "csv";
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "heic" || ext === "heif") {
    return "image";
  }
  return null;
}

export function extractOffice(fileName: string, bytes: Uint8Array): TeamCardExtract {
  const sourceKind = sourceKindFor(fileName);
  if (sourceKind === "docx") {
    const doc = readDocx(bytes);
    return buildExtract(sourceKind, doc.text, rowsFromTables(doc.tables));
  }
  if (sourceKind === "xlsx") {
    const book = readXlsx(bytes);
    return buildExtract(sourceKind, book.text, rowsFromTables(book.tables));
  }
  if (sourceKind === "csv") {
    const table = readCsv(new TextDecoder().decode(bytes));
    return buildExtract(sourceKind, table.text, rowsFromTables(table.tables));
  }
  throw new Error("Use a Word, Excel, or CSV team card.");
}
