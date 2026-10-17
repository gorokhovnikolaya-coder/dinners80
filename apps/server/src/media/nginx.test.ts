import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { signCookPhotoUrl } from './signedLink.ts';
import { MediaStorage } from './storage.ts';

/**
 * The nginx side of the photos (`deploy/nginx/templates/media.conf.template`) in the official
 * nginx image, with links signed by the server code: `npm run test:nginx` (needs Docker).
 * Skipped in `npm run check`.
 */
describe.skipIf(process.env.TEST_NGINX !== '1')('nginx media locations', () => {
  const IMAGE = 'nginx:1.28-alpine';
  const KEY = 'test-media-key-0123456789abcdefghijklmnop';
  const repo = fileURLToPath(new URL('../../../../', import.meta.url));
  // Inside the repository (`.data/` is ignored by git): Docker may not see the system temp folder.
  const root = join(repo, '.data', `nginx-test-${randomUUID()}`);
  const storage = new MediaStorage(root);
  const userId = randomUUID();
  const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  let container = '';
  let base = '';
  let photoPath = '';
  let otherPhotoPath = '';
  let card = '';

  const status = async (url: string) => (await fetch(url)).status;
  const docker = (...args: string[]) =>
    execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  beforeAll(async () => {
    mkdirSync(root, { recursive: true });
    photoPath = await storage.saveCookPhoto(userId, photo);
    otherPhotoPath = await storage.saveCookPhoto(randomUUID(), photo);
    card = await storage.saveShareCard(photo);
    container = docker(
      'run',
      '-d',
      '--rm',
      '-p',
      '127.0.0.1::80',
      '-e',
      `MEDIA_SIGNING_KEY=${KEY}`,
      '-e',
      'NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx',
      '-v',
      `${join(repo, 'deploy/nginx/templates')}:/etc/nginx/templates:ro`,
      '-v',
      `${join(repo, 'deploy/nginx/test/server.conf')}:/etc/nginx/conf.d/default.conf:ro`,
      '-v',
      `${root}:/srv/media:ro`,
      IMAGE,
    );
    const address = docker('port', container, '80/tcp').split('\n')[0] ?? '';
    base = `http://${address}/media`;
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fetch(`${base}/share/${card}`);
        break;
      } catch (error) {
        if (attempt > 50) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }, 60_000);

  afterAll(() => {
    if (container !== '') docker('stop', container);
    rmSync(root, { recursive: true, force: true });
  });

  it('opens a private photo by a link signed by the server', async () => {
    const response = await fetch(signCookPhotoUrl(base, photoPath, KEY, new Date()));
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(photo);
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
  });

  it('does not open a photo without a signature, with another one or with a wrong key', async () => {
    const plain = `${base}/cooks/${photoPath}`;
    expect(await status(plain)).toBe(403);
    expect(await status(`${plain}?md5=AAAAAAAAAAAAAAAAAAAAAA&expires=9999999999`)).toBe(403);
    // The link to the user's photo does not open someone else's one.
    const signed = new URL(signCookPhotoUrl(base, photoPath, KEY, new Date()));
    expect(await status(`${base}/cooks/${otherPhotoPath}${signed.search}`)).toBe(403);
    expect(await status(signCookPhotoUrl(base, photoPath, `${KEY}x`, new Date()))).toBe(403);
    expect(await status(`${base}/cooks/${userId}/`)).toBe(403);
  });

  it('does not open an expired link', async () => {
    const hourAndSecondAgo = new Date(Date.now() - 3601 * 1000);
    expect(await status(signCookPhotoUrl(base, photoPath, KEY, hourAndSecondAgo))).toBe(410);
  });

  it('serves share cards publicly, without listing the folder', async () => {
    expect(await status(`${base}/share/${card}`)).toBe(200);
    expect(await status(`${base}/share/`)).toBe(403);
  });
});
