import { describe, expect, it } from 'vitest';

import { nonLocalDatabaseReason } from './localDatabase.ts';

describe('nonLocalDatabaseReason', () => {
  it('accepts local hosts and a Unix socket', () => {
    for (const url of [
      'postgres://u:p@localhost:5433/db',
      'postgres://u:p@127.0.0.1:5433/db',
      'postgres://u:p@[::1]:5433/db',
      'postgres://u:p@%2Fvar%2Frun%2Fpostgresql/db',
    ]) {
      expect(nonLocalDatabaseReason(url, {}), url).toBeNull();
    }
  });

  it('refuses a remote host', () => {
    expect(nonLocalDatabaseReason('postgres://u:p@db.example.com/db', {})).toBe(
      'DATABASE_URL points to db.example.com',
    );
  });

  it('reads the host from ?host= like pg does', () => {
    expect(nonLocalDatabaseReason('postgres://u:p@localhost/db?host=prod', {})).toBe(
      'DATABASE_URL points to prod',
    );
  });

  it('refuses hostaddr', () => {
    expect(nonLocalDatabaseReason('postgres://u:p@localhost/db?hostaddr=10.0.0.5', {})).toBe(
      'DATABASE_URL sets hostaddr',
    );
  });

  it('falls back to PGHOST when the URL has no host', () => {
    expect(nonLocalDatabaseReason('postgres:///db', { PGHOST: 'prod' })).toBe(
      'DATABASE_URL points to prod',
    );
    expect(nonLocalDatabaseReason('postgres:///db', {})).toBeNull();
  });
});
