import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MediaStorage, isJpeg } from './storage.ts';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

describe('isJpeg', () => {
  it('checks the JPEG signature', () => {
    expect(isJpeg(JPEG)).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false);
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });
});

describe('MediaStorage', () => {
  let root = '';
  let storage: MediaStorage;
  const userId = randomUUID();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tma80-media-'));
    storage = new MediaStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('saves a cook photo into the user folder under a new name', async () => {
    const path = await storage.saveCookPhoto(userId, JPEG);
    expect(path).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.jpg$`));
    expect(new Uint8Array(await readFile(join(root, 'cooks', path)))).toEqual(JPEG);
    expect(await storage.cookPhotoExists(path)).toBe(true);
    expect(await storage.saveCookPhoto(userId, JPEG)).not.toBe(path);
  });

  it('rejects a bad user id and unknown or malformed photo paths', async () => {
    await expect(storage.saveCookPhoto('../x', JPEG)).rejects.toThrow();
    expect(await storage.cookPhotoExists(`${userId}/${randomUUID()}.jpg`)).toBe(false);
    for (const path of ['../etc/passwd', `${userId}/../../x.jpg`, userId, 'a/b/c.jpg'])
      expect(await storage.cookPhotoExists(path)).toBe(false);
  });

  it('counts the photos of the last day', async () => {
    expect(await storage.cookPhotosSince(userId, new Date(0))).toBe(0);
    const old = await storage.saveCookPhoto(userId, JPEG);
    await storage.saveCookPhoto(userId, JPEG);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(join(root, 'cooks', old), twoDaysAgo, twoDaysAgo);
    expect(await storage.cookPhotosSince(userId, new Date(Date.now() - 24 * 60 * 60 * 1000))).toBe(
      1,
    );
  });

  it('saves a share card into the public folder', async () => {
    const name = await storage.saveShareCard(JPEG);
    expect(name).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(new Uint8Array(await readFile(join(root, 'share', name)))).toEqual(JPEG);
  });
});
