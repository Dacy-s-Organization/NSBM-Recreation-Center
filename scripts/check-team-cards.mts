import { readFileSync } from "node:fs";
import path from "node:path";
import { extractOffice } from "../lib/team-cards/office.ts";
import { extractOcrPasses } from "../lib/team-cards/rows.ts";
import { recognizeWindowsImage } from "../lib/team-cards/windows-ocr.ts";
import type { TeamCardExtract } from "../lib/team-cards/model.ts";

const root = path.resolve(import.meta.dirname, "..");
const templates = path.join(root, "Team_Card_Templates");

function expect(extract: TeamCardExtract, section: string | null, ids: string[]) {
  if (extract.section !== section) {
    throw new Error(`Section was ${extract.section ?? "empty"}, expected ${section ?? "empty"}.`);
  }
  if (extract.rows.map((row) => row.studentId).join(",") !== ids.join(",")) {
    throw new Error(`IDs were ${extract.rows.map((row) => row.studentId).join(",")}`);
  }
}

const marathon = extractOffice(
  "Team Cards (Entry Forms) - Marathon_Template New.docx",
  readFileSync(path.join(templates, "Team Cards (Entry Forms) - Marathon_Template New.docx"))
);
expect(marathon, "sports-fiesta", [
  ***REMOVED***
***REMOVED***
]);
if (marathon.rows.some((row) => row.jerseyNo)) throw new Error("Marathon jersey should be empty.");

const tennis = extractOffice(
  "TT - Girls entry (3) (2).docx",
  readFileSync(path.join(templates, "TT - Girls entry (3) (2).docx"))
);
expect(tennis, "sports-fiesta", ["00000", "00000", "00000", ]);
if (tennis.rows.some((row) => row.jerseyNo)) throw new Error("Table tennis jersey should be empty.");

const csv = extractOffice(
  "card.csv",
  new TextEncoder().encode("Event,Name,Student ID,Jersey\nMarathon,Amal Perera,40515,7\nMarathon,Nimal Silva,40571,12\nMarathon,Amal Perera,40515,9\n")
);
expect(csv, "inter-university", ["40515", "40571"]);
if (csv.rows[0]?.jerseyNo !== "7" || csv.rows[1]?.jerseyNo !== "12") throw new Error("CSV jersey mismatch.");
if (csv.warnings.length === 0) throw new Error("CSV duplicate warning missing.");

const photoName = "photo_1_2026-10-04_19-59-03.jpg";
const words = await recognizeWindowsImage(photoName, readFileSync(path.join(templates, photoName)));
const photo = extractOcrPasses(words);
console.log(`photo section=${photo.section} rows=${photo.rows.length}`);
for (const row of photo.rows) console.log(`${row.studentId} | ${row.fullName} | ${row.jerseyNo ?? ""}`);
for (const warning of photo.warnings) console.log("warn: " + warning);
expect(photo, "inter-university", ["00000", "00000", "00000", "00000", "00000", "00000", "00000", "00000", ]);
if (photo.rows.some((row) => row.jerseyNo)) throw new Error("Photo jersey should be empty.");
if (!photo.warnings.some((warning) => warning.includes("Sample")) || !photo.warnings.some((warning) => warning.includes("Sample"))) {
  throw new Error("The two unreadable student IDs were not reported.");
}

console.log("typescript team card fixtures passed");
