import { readFileSync } from "node:fs";
import path from "node:path";
import { extractOffice } from "../lib/team-cards/office.ts";
import { extractOcrPasses } from "../lib/team-cards/rows.ts";
import { recognizeWindowsImage } from "../lib/team-cards/windows-ocr.ts";
import type { TeamCardExtract } from "../lib/team-cards/model.ts";

const root = path.resolve(import.meta.dirname, "..");
const fixtures = path.join(root, "scripts", "fixtures", "team-cards");

function expect(extract: TeamCardExtract, section: string | null, ids: string[]) {
  if (extract.section !== section) {
    throw new Error(`Section was ${extract.section ?? "empty"}, expected ${section ?? "empty"}.`);
  }
  if (extract.rows.map((row) => row.studentId).join(",") !== ids.join(",")) {
    throw new Error(`IDs were ${extract.rows.map((row) => row.studentId).join(",")}`);
  }
}

const marathon = extractOffice(
  "marathon-entry.docx",
  readFileSync(path.join(fixtures, "marathon-entry.docx"))
);
expect(marathon, "sports-fiesta", [
  "11001", "11002", "11003", "11004", "11005", "11006", "11007", "11008",
  "11009", "11010", "11011", "11012", "11013", "11014", "11015",
]);
if (marathon.rows.some((row) => row.jerseyNo)) throw new Error("Marathon jersey should be empty.");

const tennis = extractOffice(
  "table-tennis-entry.docx",
  readFileSync(path.join(fixtures, "table-tennis-entry.docx"))
);
expect(tennis, "sports-fiesta", ["12001", "12002", "12003"]);
if (tennis.rows.some((row) => row.jerseyNo)) throw new Error("Table tennis jersey should be empty.");

const csv = extractOffice(
  "card.csv",
  new TextEncoder().encode("Event,Name,Student ID,Jersey\nMarathon,Sample Athlete,13001,7\nMarathon,Test Player,13002,12\nMarathon,Sample Athlete,13001,9\n")
);
expect(csv, "inter-university", ["13001", "13002"]);
if (csv.rows[0]?.jerseyNo !== "7" || csv.rows[1]?.jerseyNo !== "12") throw new Error("CSV jersey mismatch.");
if (csv.warnings.length === 0) throw new Error("CSV duplicate warning missing.");

const photoName = "team-card.png";
const words = await recognizeWindowsImage(photoName, readFileSync(path.join(fixtures, photoName)));
const photo = extractOcrPasses(words);
console.log(`photo section=${photo.section} rows=${photo.rows.length}`);
for (const row of photo.rows) console.log(`${row.studentId} | ${row.fullName} | ${row.jerseyNo ?? ""}`);
for (const warning of photo.warnings) console.log("warn: " + warning);
expect(photo, "inter-university", ["21001", "21002", "21003", "21004", "21005", "21006", "21007", "21008"]);
if (photo.rows.some((row) => row.jerseyNo)) throw new Error("Photo jersey should be empty.");
if (!photo.warnings.some((warning) => warning.includes("Kavindi"))) {
  throw new Error("The unreadable student ID was not reported.");
}

console.log("typescript team card fixtures passed");
