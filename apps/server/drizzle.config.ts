import { defineConfig } from 'drizzle-kit';

// Drizzle Kit only generates SQL migrations from the schema (`npm run db:generate`); they are
// applied by `npm run db:migrate` (src/db/migrate.ts), never by `drizzle-kit push`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
});
