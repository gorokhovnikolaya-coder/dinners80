import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Folders of `MEDIA_DIR` (ТЗ, «Фото»): private photos of cooks and public share cards. */
export const COOKS_DIR = 'cooks';
export const SHARE_DIR = 'share';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHOTO_FILE_RE = /^[0-9a-f-]{36}\.jpg$/;

/** JPEG files start with the SOI marker and the first segment marker (`FF D8 FF`). */
export function isJpeg(data: Uint8Array): boolean {
  return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

/**
 * Uploaded files on the disk: `cooks/{user_id}/{uuid}.jpg` and `share/{uuid}.jpg` in `MEDIA_DIR`.
 * Names are generated here (never taken from the request), so a path cannot leave the folder.
 */
export class MediaStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /** Saves a cook photo of the user; returns `{user_id}/{uuid}.jpg` (as `cooks.photo_path`). */
  async saveCookPhoto(userId: string, data: Uint8Array): Promise<string> {
    if (!UUID_RE.test(userId)) throw new Error('Invalid user id');
    const dir = join(this.root, COOKS_DIR, userId);
    await mkdir(dir, { recursive: true, mode: 0o755 });
    const name = `${randomUUID()}.jpg`;
    await writeFile(join(dir, name), data, { flag: 'wx', mode: 0o644 });
    return `${userId}/${name}`;
  }

  /** Saves a share card; returns `{uuid}.jpg` in `share/`. */
  async saveShareCard(data: Uint8Array): Promise<string> {
    const dir = join(this.root, SHARE_DIR);
    await mkdir(dir, { recursive: true, mode: 0o755 });
    const name = `${randomUUID()}.jpg`;
    await writeFile(join(dir, name), data, { flag: 'wx', mode: 0o644 });
    return name;
  }

  /** Whether the share card `{uuid}.jpg` exists (the worker deletes old ones, task 21). */
  async shareCardExists(name: string): Promise<boolean> {
    if (!PHOTO_FILE_RE.test(name)) return false;
    try {
      return (await stat(join(this.root, SHARE_DIR, name))).isFile();
    } catch {
      return false;
    }
  }

  /** Deletes the share card `{uuid}.jpg`, if it is there. */
  async deleteShareCard(name: string): Promise<void> {
    if (!PHOTO_FILE_RE.test(name)) return;
    await rm(join(this.root, SHARE_DIR, name), { force: true });
  }

  /**
   * Deletes share cards changed before `before` (the worker, ТЗ: older than 30 days); returns
   * their names. Files with other names are left alone.
   */
  async deleteShareCardsBefore(before: Date): Promise<string[]> {
    const dir = join(this.root, SHARE_DIR);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return [];
    }
    const deleted: string[] = [];
    for (const name of names) {
      if (!PHOTO_FILE_RE.test(name)) continue;
      const path = join(dir, name);
      try {
        const info = await stat(path);
        if (!info.isFile() || info.mtimeMs >= before.getTime()) continue;
        await rm(path, { force: true });
        deleted.push(name);
      } catch {
        // Deleted meanwhile: nothing to do.
      }
    }
    return deleted;
  }

  /** Whether the cook photo `{user_id}/{uuid}.jpg` exists. */
  async cookPhotoExists(photoPath: string): Promise<boolean> {
    const [userId, name, ...rest] = photoPath.split('/');
    if (rest.length > 0 || !UUID_RE.test(userId ?? '') || !PHOTO_FILE_RE.test(name ?? ''))
      return false;
    try {
      return (await stat(join(this.root, COOKS_DIR, photoPath))).isFile();
    } catch {
      return false;
    }
  }

  /** Cook photos the user uploaded after `since` (by the file time). */
  async cookPhotosSince(userId: string, since: Date): Promise<number> {
    if (!UUID_RE.test(userId)) return 0;
    const dir = join(this.root, COOKS_DIR, userId);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return 0;
    }
    const times = await Promise.all(
      names
        .filter((name) => PHOTO_FILE_RE.test(name))
        .map(async (name) => (await stat(join(dir, name))).mtimeMs),
    );
    return times.filter((time) => time > since.getTime()).length;
  }
}
