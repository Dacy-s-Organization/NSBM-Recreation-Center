import type { OcrWord, TeamCardExtract, TeamCardRow, TeamCardSection, TeamCardSourceKind } from "./model";

type Role = "name" | "id" | "jersey";

const HEADINGS: { role: Role; phrase: string; fiesta?: boolean; inter?: boolean }[] = [
  { role: "name", phrase: "name of athlete", fiesta: true },
  { role: "name", phrase: "player s full name" },
  { role: "name", phrase: "players full name" },
  { role: "name", phrase: "name" },
  { role: "id", phrase: "university student id", inter: true },
  { role: "id", phrase: "university student io", inter: true },
  { role: "id", phrase: "umis id", fiesta: true },
  { role: "id", phrase: "student id", inter: true },
  { role: "id", phrase: "student io", inter: true },
  { role: "jersey", phrase: "jersey no", inter: true },
  { role: "jersey", phrase: "jorsey no", inter: true },
  { role: "jersey", phrase: "jersey", inter: true },
  { role: "jersey", phrase: "jorsey", inter: true },
];

export function normHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headingOf(value: string) {
  const phrase = normHeading(value);
  return HEADINGS.find((heading) => heading.phrase === phrase) ?? null;
}

type ColumnMap = { name: number; id: number; jersey: number | null; flags: HeadingFlags };

export type HeadingFlags = {
  nameOfAthlete: boolean;
  umis: boolean;
  studentId: boolean;
  jersey: boolean;
};

function emptyFlags(): HeadingFlags {
  return { nameOfAthlete: false, umis: false, studentId: false, jersey: false };
}

function mapHeader(cells: string[]): ColumnMap | null {
  const map: Partial<Record<Role, number>> = {};
  const flags = emptyFlags();
  cells.forEach((cell, index) => {
    const heading = headingOf(cell);
    if (!heading || map[heading.role] !== undefined) return;
    map[heading.role] = index;
    if (heading.phrase === "name of athlete") flags.nameOfAthlete = true;
    if (heading.phrase === "umis id") flags.umis = true;
    if (heading.inter && heading.role === "id") flags.studentId = true;
    if (heading.role === "jersey") flags.jersey = true;
  });
  if (map.name === undefined || map.id === undefined) return null;
  return { name: map.name, id: map.id, jersey: map.jersey ?? null, flags };
}

export function rowsFromTables(tables: string[][][]): { rows: string[][]; flags: HeadingFlags } {
  const flags = emptyFlags();
  const rows: string[][] = [];
  let header: ColumnMap | null = null;
  let width = 0;

  for (const table of tables) {
    let tableHeader: ColumnMap | null = null;
    for (const cells of table) {
      const found = mapHeader(cells);
      if (found) {
        tableHeader = found;
        header = found;
        width = cells.length;
        flags.nameOfAthlete ||= found.flags.nameOfAthlete;
        flags.umis ||= found.flags.umis;
        flags.studentId ||= found.flags.studentId;
        flags.jersey ||= found.flags.jersey;
        continue;
      }
      const active = tableHeader ?? (cells.length === width ? header : null);
      if (!active) continue;
      rows.push([
        cells[active.name] ?? "",
        cells[active.id] ?? "",
        active.jersey === null ? "" : (cells[active.jersey] ?? ""),
      ]);
    }
  }

  return { rows, flags };
}

type PlacedWord = OcrWord & { right: number };

function findHeadingSpans(words: PlacedWord[]) {
  const flags = emptyFlags();
  const found: { role: Role; x: number; right: number }[] = [];
  let acc = "";
  let start = 0;

  const phraseStart = (endIndex: number, phrase: string) => {
    let acc = "";
    for (let index = endIndex; index >= start; index--) {
      const piece = normHeading(words[index].text);
      if (!piece) continue;
      acc = acc ? `${piece} ${acc}` : piece;
      if (acc === phrase) return index;
    }
    return endIndex;
  };

  for (let i = 0; i < words.length; i++) {
    const piece = normHeading(words[i].text);
    if (!piece) continue;
    if (!acc) start = i;
    acc = acc ? `${acc} ${piece}` : piece;
    const hits = HEADINGS.filter((heading) => acc === heading.phrase || acc.endsWith(` ${heading.phrase}`)).sort(
      (a, b) => b.phrase.length - a.phrase.length
    );
    const hit = hits[0];
    if (!hit || found.some((item) => item.role === hit.role)) {
      if (hit && found.some((item) => item.role === hit.role)) acc = "";
      continue;
    }
    const index = phraseStart(i, hit.phrase);
    found.push({ role: hit.role, x: words[index].x, right: words[i].right });
    if (hit.phrase === "name of athlete") flags.nameOfAthlete = true;
    if (hit.phrase === "umis id") flags.umis = true;
    if (hit.inter && hit.role === "id") flags.studentId = true;
    if (hit.role === "jersey") flags.jersey = true;
    acc = "";
  }

  return { found, flags };
}

function groupWords(words: OcrWord[]): OcrWord[][] {
  const usable = words.filter((word) => word.text.trim().length > 0);
  const sorted = [...usable].sort((a, b) => a.y - b.y || a.x - b.x);
  const heights = sorted.map((word) => word.height).filter((height) => height > 0).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] || 12;
  const groups: OcrWord[][] = [];

  for (const word of sorted) {
    const current = groups[groups.length - 1];
    if (!current) {
      groups.push([word]);
      continue;
    }
    const bottom = Math.max(...current.map((item) => item.y + item.height));
    const center = word.y + word.height / 2;
    if (center <= bottom + median * 0.45) current.push(word);
    else groups.push([word]);
  }

  return groups;
}

export function rowsFromOcr(words: OcrWord[]): { rows: string[][]; ys: number[]; flags: HeadingFlags; warnings: string[] } {
  const groups = groupWords(words);
  let header: { role: Role; left: number; right: number }[] | null = null;
  const flags = emptyFlags();
  const rows: string[][] = [];
  const ys: number[] = [];

  for (const group of groups) {
    const placed = group
      .map((word) => ({ ...word, right: word.x + word.width }))
      .sort((a, b) => a.x - b.x);
    const spans = findHeadingSpans(placed);
    const name = spans.found.find((item) => item.role === "name");
    const id = spans.found.find((item) => item.role === "id");
    if (name && id && !header) {
      const jersey = spans.found.find((item) => item.role === "jersey");
      const columns = [name, id, ...(jersey ? [jersey] : [])].sort((a, b) => a.x - b.x);
      header = columns.map((column, index) => {
        const previous = columns[index - 1];
        const next = columns[index + 1];
        return {
          role: column.role,
          left: previous ? (previous.right + column.x) / 2 : Number.NEGATIVE_INFINITY,
          right: next ? (column.right + next.x) / 2 : Number.POSITIVE_INFINITY,
        };
      });
      flags.nameOfAthlete ||= spans.flags.nameOfAthlete;
      flags.umis ||= spans.flags.umis;
      flags.studentId ||= spans.flags.studentId;
      flags.jersey ||= spans.flags.jersey;
      continue;
    }
    if (!header) continue;

    const cells: Record<Role, string[]> = { name: [], id: [], jersey: [] };
    for (const word of placed) {
      const center = word.x + word.width / 2;
      const column = header.find((item) => center >= item.left && center < item.right);
      if (!column) continue;
      cells[column.role].push(word.text.trim());
    }
    rows.push([cells.name.join(" "), cells.id.join(" "), cells.jersey.join(" ")]);
    ys.push(group.reduce((sum, word) => sum + word.y, 0) / group.length);
  }

  const warnings = header ? [] : ["Could not find the name and student ID headings on this image."];
  return { rows, ys, flags, warnings };
}

function studentIdFrom(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  const direct = digitsOnly(compact);
  if (direct) return direct;
  const match = value.match(/\b(\d{4,6})\b/);
  return match?.[1] ?? null;
}

function digitsOnly(value: string): string | null {
  const cleaned = value.replaceAll("€", "3").replace(/^['’"•.]+|['’"•.]+$/g, "");
  if (/^\d{4,6}$/.test(cleaned)) return cleaned;
  if (!/^[0-9A-Za-z|öÖ]{4,6}$/.test(cleaned)) return null;
  const repaired = cleaned
    .replace(/[OoQ]/g, "0")
    .replace(/[Il|i]/g, "1")
    .replace(/[Zz]/g, "2")
    .replace(/[Aa]/g, "3")
    .replace(/[Ss]/g, "5")
    .replace(/[GgöÖ]/g, "6")
    .replace(/B/g, "8")
    .replace(/[eq]/g, "9");
  return /^\d{4,6}$/.test(repaired) ? repaired : null;
}

function jerseyFrom(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return null;
  return /^\d{1,3}$/.test(compact) ? compact : null;
}

export function detectSection(text: string, flags: HeadingFlags): TeamCardSection | null {
  const upper = text.toUpperCase();
  const fiesta =
    upper.includes("SPORTS FIESTA") || upper.includes("ENTRY FORM") || (flags.nameOfAthlete && flags.umis);
  const inter = upper.includes("OFFICIAL TEAM CARD") || (flags.studentId && flags.jersey);
  if (fiesta === inter) return null;
  return fiesta ? "sports-fiesta" : "inter-university";
}

export function buildExtract(
  sourceKind: TeamCardSourceKind,
  text: string,
  parsed: { rows: string[][]; flags: HeadingFlags; warnings?: string[] },
  accepted?: number[]
): TeamCardExtract {
  const warnings = [...(parsed.warnings ?? [])];
  const rows: TeamCardRow[] = [];
  const seen = new Set<string>();

  parsed.rows.forEach((cells, index) => {
    const nameCell = cells[0] ?? "";
    const idCell = cells[1] ?? "";
    const jerseyCell = cells[2] ?? "";
    const fullName = nameCell.replace(/\s+/g, " ").trim().replace(/^\d{1,2}\s+/, "");
    const studentId = studentIdFrom(idCell);
    if (!fullName && !studentId) return;
    if (!studentId) {
      if (fullName) warnings.push(`Skipped “${fullName}” because the student ID was missing or not 4 to 6 digits.`);
      return;
    }
    if (!fullName) {
      warnings.push(`Skipped student ID ${studentId} because the name was empty.`);
      return;
    }
    if (seen.has(studentId)) {
      warnings.push(`Student ID ${studentId} was listed more than once. The first row was kept.`);
      return;
    }
    seen.add(studentId);
    const jerseyNo = jerseyFrom(jerseyCell);
    if (jerseyCell.trim() && !jerseyNo) {
      warnings.push(`Jersey for ${studentId} was not a 1 to 3 digit number, so it was left blank.`);
    }
    rows.push({ studentId, fullName, jerseyNo });
    accepted?.push(index);
  });

  return {
    section: detectSection(text, parsed.flags),
    sourceKind,
    rows,
    warnings,
  };
}

export function extractOcrPasses(passes: OcrWord[][]): TeamCardExtract {
  type Slot = { studentId: string; fullName: string; jerseyNo: string | null; rank: number; score: number };
  const slots: Slot[] = [];
  let section: TeamCardExtract["section"] = null;
  const warningLines: string[] = [];
  let cleanOrphans: { name: string; rank: number }[] = [];

  for (const words of passes) {
    const parsed = rowsFromOcr(words);
    const accepted: number[] = [];
    const extract = buildExtract("image", words.map((word) => word.text).join(" "), parsed, accepted);
    if (!section && extract.section) section = extract.section;
    warningLines.push(...extract.warnings);
    const maxY = Math.max(1, ...parsed.ys);
    extract.rows.forEach((row, index) => {
      const rank = parsed.ys[accepted[index]] / maxY;
      const score = [...row.fullName].filter((char) => /\p{L}/u.test(char)).length;
      const existing = slots.findIndex(
        (slot) =>
          slot.studentId === row.studentId ||
          slot.studentId.startsWith(row.studentId) ||
          row.studentId.startsWith(slot.studentId)
      );
      if (existing < 0) {
        slots.push({ studentId: row.studentId, fullName: row.fullName, jerseyNo: row.jerseyNo, rank, score });
        return;
      }
      const current = slots[existing];
      slots[existing] = {
        studentId: row.studentId.length >= current.studentId.length ? row.studentId : current.studentId,
        fullName: score > current.score ? row.fullName : current.fullName,
        jerseyNo: row.jerseyNo ?? current.jerseyNo,
        rank: Math.min(current.rank, rank),
        score: Math.max(current.score, score),
      };
    });

    const orphans: { name: string; rank: number }[] = [];
    parsed.rows.forEach((cells, index) => {
      const name = (cells[0] ?? "").replace(/\s+/g, " ").trim().replace(/^\d{1,2}\s+/, "");
      if (!name || !/^[\p{L}\s.,]+$/u.test(name)) return;
      if (studentIdFrom(cells[1] ?? "")) return;
      orphans.push({ name, rank: parsed.ys[index] / maxY });
    });
    if (orphans.length > 0) cleanOrphans = cleanOrphans.concat(orphans);
  }

  slots.forEach((slot, index) => {
    if (/\p{L}/u.test(slot.fullName)) return;
    let best: { name: string; rank: number } | null = null;
    let bestLetters = 0;
    let bestGap = 0.02;
    for (const orphan of cleanOrphans) {
      const gap = Math.abs(orphan.rank - slot.rank);
      const letters = [...orphan.name].filter((char) => /\p{L}/u.test(char)).length;
      if (gap < 0.02 && (letters > bestLetters || (letters === bestLetters && gap < bestGap))) {
        bestLetters = letters;
        bestGap = gap;
        best = orphan;
      }
    }
    if (!best) return;
    slots[index] = {
      ...slot,
      fullName: best.name,
      score: [...best.name].filter((char) => /\p{L}/u.test(char)).length,
    };
  });

  slots.sort((a, b) => a.rank - b.rank);
  const rows = slots.map(({ studentId, fullName, jerseyNo }) => ({ studentId, fullName, jerseyNo }));
  const warnings = [
    ...new Set(
      warningLines.filter((warning) => {
        if (!warning.startsWith("Skipped") || recovered(warning, rows)) return false;
        const quoted = warning.match(/“(.+?)”/);
        return Boolean(
          quoted &&
            quoted[1].length <= 42 &&
            /\p{L}/u.test(quoted[1]) &&
            !/declaration|signature|contact|official|certify|enrolled|permitted|hereby/i.test(quoted[1])
        );
      })
    ),
  ];
  return { section, sourceKind: "image", rows, warnings };
}

function recovered(warning: string, rows: TeamCardRow[]): boolean {
  const quoted = warning.match(/“(.+?)”/);
  if (!quoted) return false;
  const tokens = quoted[1].match(/[A-Za-z]{4,}/g) ?? [];
  return tokens.some((token) => rows.some((row) => row.fullName.toLowerCase().includes(token.toLowerCase())));
}
