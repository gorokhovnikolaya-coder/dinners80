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
