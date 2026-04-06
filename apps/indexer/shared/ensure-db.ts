import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DB_PATH } from "../types/config";

/**
 * External DB source URL. Leave empty and set DB_DOWNLOAD_URL env var at runtime.
 * Supports any direct-download URL, including Google Drive direct links.
 */
const DB_DOWNLOAD_URL = "";

function resolveDownloadUrl() {
  const fromEnv = process.env.DB_DOWNLOAD_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DB_DOWNLOAD_URL;
}

export async function ensureDbPresent() {
  if (existsSync(DB_PATH)) return;

  const downloadUrl = resolveDownloadUrl();
  if (!downloadUrl) {
    throw new Error(
      "[DB] Missing local database and no download URL configured. Set DB_DOWNLOAD_URL env var or update shared/ensure-db.ts.",
    );
  }

  const dataDir = path.dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  console.log(`[DB] Local DB not found. Downloading from external source...`);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(
      `[DB] Download failed: HTTP ${response.status} ${response.statusText}. Check your URL permissions/direct-download format.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      "[DB] Download returned HTML, not a SQLite file. If using Google Drive, use a direct-download link.",
    );
  }

  const dbBytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(DB_PATH, dbBytes);
  console.log(`[DB] Database downloaded to: ${DB_PATH}`);
}
