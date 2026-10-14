import 'dotenv/config';

// Legacy DATABASE_URL remains supported when no target was selected.
export function configureDatabase(): string {
  const target = process.env.DB_TARGET;
  if (target && !['local', 'cloud'].includes(target)) throw new Error('DB_TARGET must be local or cloud.');
  const url = target === 'local' ? process.env.LOCAL_DATABASE_URL
    : target === 'cloud' ? process.env.CLOUD_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error('Missing database URL for the selected DB_TARGET.');
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Database URL must use PostgreSQL.');
  if (target === 'cloud' && parsed.searchParams.get('sslmode') !== 'verify-full') throw new Error('Cloud database requires sslmode=verify-full.');
  process.env.DATABASE_URL = url;
  return url;
}
