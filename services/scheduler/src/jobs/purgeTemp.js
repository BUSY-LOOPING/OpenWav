import fs from 'fs/promises';
import path from 'path';

const TEMP_DIR = process.env.TEMP_DOWNLOAD_PATH || '/app/temp';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function purgeTempFiles() {
  let entries;
  try {
    entries = await fs.readdir(TEMP_DIR);
  } catch {
    console.warn(`[purgeTemp] Temp dir not accessible: ${TEMP_DIR}`);
    return;
  }

  let deleted = 0;
  const now = Date.now();

  for (const file of entries) {
    const filePath = path.join(TEMP_DIR, file);
    try {
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        await fs.unlink(filePath);
        deleted++;
      }
    } catch (err) {
      console.warn(`[purgeTemp] Could not delete ${file}:`, err.message);
    }
  }

  console.log(`[purgeTemp] Deleted ${deleted} temp file(s)`);
}