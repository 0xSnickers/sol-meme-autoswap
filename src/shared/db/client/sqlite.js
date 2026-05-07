import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDrizzleSchema } from '../schema/index.js';
import { ensureLocalSqliteSchema } from './sqlite-schema-bootstrap.js';

export function createSqliteDrizzleClient({ filePath, backfillPaperPositionState } = {}) {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const client = new Database(resolvedPath);
  ensureLocalSqliteSchema(client, { backfillPaperPositionState });
  const schema = getDrizzleSchema('sqlite');
  const db = drizzle(client, { schema });

  return {
    driver: 'sqlite',
    filePath: resolvedPath,
    client,
    db,
    schema,
  };
}
