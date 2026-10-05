import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { OcrWord } from "./model";

const TIMEOUT_MS = 60_000;

export async function recognizeWindowsImage(fileName: string, bytes: Uint8Array): Promise<OcrWord[][]> {
  if (process.platform !== "win32") {
    throw new Error(
      "Image reading is only available when this website is running on Windows. Word, Excel, and CSV files still work."
    );
  }

  const ext = path.extname(fileName).toLowerCase() || ".img";
  const dir = await mkdtemp(path.join(tmpdir(), "rec-ocr-"));
  const imagePath = path.join(dir, `card${ext}`);
  await writeFile(imagePath, bytes);

  try {
    return await runScript(imagePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runScript(imagePath: string): Promise<OcrWord[][]> {
  const script = path.join(process.cwd(), "scripts", "windows-ocr.ps1");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-ImagePath", imagePath],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Reading this image took too long. Try a smaller photo."));
    }, TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(cleanOcrError(stderr || stdout)));
        return;
      }
      try {
        const cleaned = stdout.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
        const parsed = JSON.parse(cleaned) as { passes?: OcrWord[][] } | OcrWord[];
        if (Array.isArray(parsed)) resolve([parsed]);
        else resolve(Array.isArray(parsed.passes) ? parsed.passes : []);
      } catch {
        reject(new Error("Windows OCR did not return a readable result."));
      }
    });
  });
}

function cleanOcrError(raw: string): string {
  const line = raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("At ") && !item.startsWith("+"));
  if (!line) return "Windows could not read this image.";
  if (/english ocr language/i.test(line)) return line;
  if (/could not open|heif|codec|decoder/i.test(line)) {
    return "Windows could not open this image. For an HEIC photo, install the HEIF Image Extensions from the Microsoft Store.";
  }
  return line;
}
