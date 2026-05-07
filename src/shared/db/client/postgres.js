import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getDrizzleSchema } from '../schema/index.js';

export function createPostgresDrizzleClient({ connectionString }) {
  const schema = getDrizzleSchema('postgres');
  const maxConnections = Math.max(
    1,
    Number(
      process.env.SIGNAL_POSTGRES_MAX_CONNECTIONS ||
        process.env.RADAR_POSTGRES_MAX_CONNECTIONS ||
        5
    )
  );
  const client = postgres(connectionString, {
    max: maxConnections,
    prepare: false,
  });
  const db = drizzle(client, { schema });

  return {
    driver: 'postgres',
    connectionString,
    client,
    db,
    schema,
  };
}
