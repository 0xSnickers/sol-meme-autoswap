import { desc, eq, and } from 'drizzle-orm';

export function createTradeIntentRepository({ db, schema }) {
  const tradeIntents = schema.tradeIntents;
  if (!tradeIntents) {
    return {
      async listRecent() {
        return [];
      },

      async insertMany() {},

      async listScores() {
        return [];
      },
    };
  }

  return {
    async listRecent(limit = null) {
      let query = db.select().from(tradeIntents).orderBy(desc(tradeIntents.createdAt), desc(tradeIntents.id));
      if (limit && Number(limit) > 0) {
        query = query.limit(Number(limit));
      }
      return query;
    },

    async listScores(chain, address, limit = null) {
      let query = db
        .select({ tradeScore: tradeIntents.tradeScore })
        .from(tradeIntents)
        .where(
          and(
            eq(tradeIntents.chain, chain),
            eq(tradeIntents.address, address)
          )
        )
        .orderBy(desc(tradeIntents.createdAt), desc(tradeIntents.id));

      if (limit && Number(limit) > 0) {
        query = query.limit(Number(limit));
      }

      return query;
    },

    async insertMany(rows = []) {
      if (!rows.length) {
        return;
      }

      await db
        .insert(tradeIntents)
        .values(rows)
        .onConflictDoNothing({
          target: [tradeIntents.chain, tradeIntents.address, tradeIntents.signalCount],
        });
    },
  };
}
