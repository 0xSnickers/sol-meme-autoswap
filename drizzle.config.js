import 'dotenv/config';
import './src/lib/signal-env.js';
import { resolvePostgresConnectionString, resolveSignalDbDriver, resolveSqliteDatabasePath } from './src/shared/db/client/index.js';

const driver = resolveSignalDbDriver(process.env);

export default {
  out: './src/shared/db/migrations',
  schema:
    driver === 'postgres'
      ? './src/shared/db/schema/postgres-schema.js'
      : './src/shared/db/schema/sqlite-schema.js',
  dialect: driver === 'postgres' ? 'postgresql' : 'sqlite',
  dbCredentials:
    driver === 'postgres'
      ? {
          url: resolvePostgresConnectionString(process.env),
        }
      : {
          url: resolveSqliteDatabasePath(process.env),
        },
  verbose: true,
  strict: true,
};
