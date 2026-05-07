import { desc, eq } from 'drizzle-orm';

export function createNarrativeRepository({ db, schema }) {
  const narratives = schema.narratives;
  if (!narratives) {
    return {
      async findByTheme() {
        return null;
      },
      async listRecent() {
        return [];
      },
      async insert() {
        return null;
      },
      async updateById() {},
      async updateByTheme() {},
    };
  }

  return {
    async findByTheme(theme) {
      const rows = await db.select().from(narratives).where(eq(narratives.theme, theme)).limit(1);
      return rows[0] || null;
    },

    async listRecent(limit = 1000) {
      return db
        .select()
        .from(narratives)
        .orderBy(desc(narratives.lastSeenAt), desc(narratives.id))
        .limit(limit);
    },

    async insert(row) {
      if (!row) {
        return null;
      }

      await db.insert(narratives).values(row);
      return this.findByTheme(row.theme);
    },

    async updateById(id, updates = {}) {
      if (id == null) {
        return;
      }
      await db.update(narratives).set(updates).where(eq(narratives.id, id));
    },

    async updateByTheme(theme, updates = {}) {
      await db.update(narratives).set(updates).where(eq(narratives.theme, theme));
    },
  };
}
