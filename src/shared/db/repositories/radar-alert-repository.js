import { desc, sql } from 'drizzle-orm';

export function createRadarAlertRepository({ db, schema }) {
  const alerts = schema.alerts;
  if (!alerts) {
    throw new Error('Drizzle schema 缺少 alerts 表定义');
  }

  return {
    async listRecent(limit = 50) {
      return db.select().from(alerts).orderBy(desc(alerts.pushedAt)).limit(limit);
    },

    async getSummary() {
      const rows = await db
        .select({
          totalPersisted: sql`count(*)`,
          totalPersistedTokens: sql`count(distinct ${alerts.chain} || ':' || ${alerts.address})`,
        })
        .from(alerts);

      return {
        totalPersisted: Number(rows[0]?.totalPersisted || 0),
        totalPersistedTokens: Number(rows[0]?.totalPersistedTokens || 0),
      };
    },

    async countDistinctTokens() {
      return (await this.getSummary()).totalPersistedTokens;
    },

    async countAll() {
      return (await this.getSummary()).totalPersisted;
    },

    async insertMany(rows = []) {
      if (!rows.length) {
        return;
      }

      await db
        .insert(alerts)
        .values(rows)
        .onConflictDoNothing({
          target: [alerts.chain, alerts.address, alerts.signalCount],
        });
    },
  };
}
