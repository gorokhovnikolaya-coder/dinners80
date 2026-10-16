/**
 * `BOT_TOKEN` from the environment: the bot token lives only in the server environment and `.env`
 * (never in git or the client bundle). Init data is checked with it.
 */
export function botToken(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const token = env.BOT_TOKEN;
  if (token === undefined || token.trim() === '') {
    throw new Error(
      'BOT_TOKEN is not set: put the bot token (a test bot locally) into .env or the environment',
    );
  }
  return token.trim();
}

/**
 * `MEDIA_URL`: public base URL of media files (nginx serves `/media/content/*` photos of the
 * content); `/media` on our own domain by default. A trailing slash is dropped.
 */
export function mediaUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const url = env.MEDIA_URL?.trim();
  return (url === undefined || url === '' ? '/media' : url).replace(/\/+$/, '');
}
