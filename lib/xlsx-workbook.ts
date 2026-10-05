import { strFromU8, unzipSync } from "fflate";

export type GridRow = { line: number; cells: string[] };
export type WorkbookSheet = { name: string; rows: GridRow[] };

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

function attr(tag: string, localName: string): string {
  for (const match of tag.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    const name = match[1];
    const local = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
    if (local === localName) return decodeXml(match[2]);
  }
  return "";
}

function textNodes(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/g, "");
  return [...withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

/** Integers stored as 1.23E+4 become plain digits. Values past the safe integer range stay as written. */
export function plainNumber(raw: string): string {
  const text = raw.trim();
  if (/^[-+]?\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "").replace(/^\+/, "");
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)[eE][-+]?\d+$/.test(text)) return text;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return text;
  return String(value);
}

function columnIndex(reference: string): number | null {
  const letters = /^[A-Z]+/i.exec(reference)?.[0];
  if (!letters) return null;
  let index = 0;
  for (const char of letters.toUpperCase()) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function zipText(files: Record<string, Uint8Array>, name: string): string | null {
  const wanted = name.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  for (const [key, bytes] of Object.entries(files)) {
    if (key.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase() === wanted) return strFromU8(bytes);
  }
  return null;
}

function resolveTarget(target: string): string {
  const cleaned = decodeXml(target).replace(/\\/g, "/");
  if (cleaned.startsWith("/")) return cleaned.replace(/^\/+/, "");
  const stack: string[] = [];
  for (const part of ["xl", ...cleaned.split("/")]) {
    if (part === "..") stack.pop();
    else if (part !== "." && part !== "") stack.push(part);
  }
  return stack.join("/");
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]));
}

function sheetRows(xml: string, shared: string[]): GridRow[] {
  const rows: GridRow[] = [];
  let fallbackLine = 0;
  for (const row of xml.matchAll(/<row\b([^>]*)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    fallbackLine += 1;
    const line = Number(attr(row[1], "r")) || fallbackLine;
    const cells: string[] = [];
    let fallbackColumn = 0;
    for (const cell of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = attr(cell[1], "r");
      const column = columnIndex(reference) ?? fallbackColumn;
      const kind = attr(cell[1], "t");
      const inner = cell[2] ?? "";
      let value = "";
      if (kind === "inlineStr") value = textNodes(inner);
      else if (kind !== "e") {
        const raw = decodeXml(/<v[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
        if (kind === "s") value = shared[Number(raw)] ?? "";
        else if (kind === "b") value = raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : raw;
        else value = plainNumber(raw);
      }
      while (cells.length < column) cells.push("");
      cells[column] = value.trim();
      fallbackColumn = column + 1;
    }
    if (cells.some((cell) => cell.length > 0)) rows.push({ line, cells });
  }
  return rows;
}

/** Every worksheet, in workbook order. */
export function readXlsxWorkbook(bytes: Uint8Array): WorkbookSheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This Excel file could not be read.");
  }
  const workbook = zipText(files, "xl/workbook.xml");
  const rels = zipText(files, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("This workbook does not contain a readable sheet.");

  const targets = new Map<string, string>();
  for (const rel of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(rel[1], "Id");
    const target = attr(rel[1], "Target");
    if (id && target) targets.set(id, resolveTarget(target));
  }

  const shared = sharedStrings(zipText(files, "xl/sharedStrings.xml"));
  const sheets: WorkbookSheet[] = [];
  for (const sheet of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = attr(sheet[1], "name");
    const id = attr(sheet[1], "id");
    const target = targets.get(id);
    const xml = target ? zipText(files, target) : null;
    if (!name || !xml) throw new Error(`Sheet "${name || id}" could not be read.`);
    sheets.push({ name, rows: sheetRows(xml, shared) });
  }
  if (sheets.length === 0) throw new Error("This workbook does not contain a readable sheet.");
  return sheets;
}
