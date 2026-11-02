import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const allow = new Set(["000000000V", "000000000v", "0700000000"]);
const patterns = [
  { name: "12-digit NIC", re: /(?<!\d)(?:19|20)\d{10}(?!\d)/g },
  { name: "9-digit NIC", re: /(?<!\d)\d{9}[VvXx](?![A-Za-z0-9])/g },
  { name: "mobile", re: /(?<!\d)0?7\d{8}(?!\d)/g },
];

const textExt = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cs", ".sql", ".csv", ".md",
  ".json", ".xml", ".csproj", ".yml", ".yaml", ".ps1", ".razor", ".html", ".css",
  ".toml", ".txt", ".example",
]);

function hits(text) {
  const found = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.re)) {
      if (!allow.has(match[0])) found.push(pattern.name);
    }
  }
  return found;
}

function zipXml(bytes) {
  const view = Buffer.from(bytes);
  const chunks = [];
  let offset = 0;
  while (offset + 30 < view.length && view.readUInt32LE(offset) === 0x04034b50) {
    const method = view.readUInt16LE(offset + 8);
    const compressed = view.readUInt32LE(offset + 18);
    const nameLen = view.readUInt16LE(offset + 26);
    const extraLen = view.readUInt16LE(offset + 28);
    const name = view.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const start = offset + 30 + nameLen + extraLen;
    const data = view.subarray(start, start + compressed);
    offset = start + compressed;
    if (!name.endsWith(".xml")) continue;
    if (method === 0) chunks.push(data.toString("utf8"));
    else if (method === 8) chunks.push(inflateRawSync(data).toString("utf8"));
  }
  return chunks.join("\n");
}

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((file) => file !== "package-lock.json" && !file.startsWith("graphify-out/"));

const failures = [];
for (const file of files) {
  const lower = file.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  let text = "";
  if (textExt.has(ext) || lower.endsWith(".env.example")) {
    if (!existsSync(file)) continue;
    text = readFileSync(file, "utf8");
  } else if (ext === ".docx" || ext === ".xlsx") {
    if (!existsSync(file)) continue;
    text = zipXml(readFileSync(file));
  } else {
    continue;
  }
  const found = hits(text);
  if (found.length > 0) failures.push(`${file}: ${[...new Set(found)].join(", ")}`);
}

if (failures.length > 0) {
  console.error("Personal-data patterns found in tracked files:");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`pii scan passed (${files.length} tracked files)`);
