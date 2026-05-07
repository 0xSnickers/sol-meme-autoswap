import { desc, eq } from 'drizzle-orm';

export function createRadarPositionRepository({ db, schema }) {
  const positions = schema.positions;
  if (!positions) {
    throw new Error('Drizzle schema 缺少 positions 表定义');
  }

  return {
    async listAll() {
      return db.select().from(positions).orderBy(desc(positions.updatedAt));
    },

    async listByStatus(status = 'open', limit = 20) {
      let query = db
        .select()
        .from(positions)
        .where(eq(positions.status, status))
        .orderBy(desc(positions.updatedAt));

      if (limit && Number(limit) > 0) {
        query = query.limit(limit);
      }

      return query;
    },

    async countByStatus(status = 'open') {
      const rows = await db.select().from(positions).where(eq(positions.status, status));
      return rows.length;
    },

    async findOpenPosition(chain, address) {
      const rows = await db
        .select()
        .from(positions)
        .where(eq(positions.status, 'open'))
        .orderBy(desc(positions.openedAt), desc(positions.id));

      return (
        rows.find((row) => row.chain === chain && row.address === address) || null
      );
    },

    async insertMany(rows = []) {
      if (!rows.length) {
        return;
      }

      await db
        .insert(positions)
        .values(rows)
        .onConflictDoNothing({
          target: [positions.chain, positions.address, positions.entrySignalCount],
        });
    },

    async updateById(id, updates = {}) {
      await db.update(positions).set(updates).where(eq(positions.id, id));
    },

    async syncOpenPaperTradeSettings(settings = {}, options = {}) {
      const takeProfitSteps = Array.isArray(settings.takeProfitSteps) ? settings.takeProfitSteps : [];
      await db
        .update(positions)
        .set({
          stopLossPct: Number(settings.stopLossPercent || 0),
          takeProfitPct: Number(
            takeProfitSteps[0]?.targetPercent || options.legacyTakeProfitPercent || 0
          ),
          tpPlanJson: JSON.stringify(takeProfitSteps),
        })
        .where(eq(positions.status, 'open'));
    },
  };
}
