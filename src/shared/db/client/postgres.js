import { getTableName } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getDrizzleSchema } from '../schema/index.js';

const POSTGRES_REQUIRED_SCHEMA_KEYS = [
  'meta',
  'alerts',
  'positions',
  'tradeIntents',
  'narratives',
  'tokensSeen',
  'runtimeState',
];

function getRequiredTableNames(schema) {
  return POSTGRES_REQUIRED_SCHEMA_KEYS.map((key) => schema[key]).filter(Boolean).map(getTableName);
}

export async function ensurePostgresSchemaReady(drizzleClient) {
  if (!drizzleClient || drizzleClient.driver !== 'postgres') {
    return;
  }

  const requiredTables = getRequiredTableNames(drizzleClient.schema);
  const rows = await drizzleClient.client`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${requiredTables})
  `;
  const existingTables = new Set(rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));

  if (!missingTables.length) {
    return;
  }

  throw new Error(
    `当前 PostgreSQL 数据库尚未初始化，缺少表: ${missingTables.join(', ')}。请先执行 npm run db:push`
  );
}

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
