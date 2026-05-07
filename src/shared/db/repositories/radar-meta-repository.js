import { eq, inArray } from 'drizzle-orm';

export function createRadarMetaRepository({ db, schema }) {
  const meta = schema.meta;
  if (!meta) {
    throw new Error('Drizzle schema 缺少 meta 表定义');
  }

  return {
    async getValue(key, fallback = null) {
      const rows = await db.select({ value: meta.value }).from(meta).where(eq(meta.key, key)).limit(1);
      return rows[0]?.value ?? fallback;
    },

    async getValues(keys = [], fallbackByKey = {}) {
      const uniqueKeys = [...new Set(keys.filter(Boolean))];
      if (!uniqueKeys.length) {
        return { ...fallbackByKey };
      }

      const rows = await db
        .select({ key: meta.key, value: meta.value })
        .from(meta)
        .where(inArray(meta.key, uniqueKeys));

      const result = { ...fallbackByKey };
      for (const key of uniqueKeys) {
        if (!(key in result)) {
          result[key] = null;
        }
      }
      for (const row of rows) {
        result[row.key] = row.value;
      }

      return result;
    },

    async setValue(key, value) {
      await this.setValues([{ key, value }]);
      return value;
    },

    async setValues(entries = []) {
      if (!entries.length) {
        return;
      }

      const keys = entries.map((entry) => entry.key);
      await db.delete(meta).where(inArray(meta.key, keys));
      await db.insert(meta).values(entries);
    },
  };
}
