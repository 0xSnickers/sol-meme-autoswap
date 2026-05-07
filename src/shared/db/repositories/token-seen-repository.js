import { eq, inArray } from 'drizzle-orm';

export function createTokenSeenRepository({ db, schema }) {
  const tokensSeen = schema.tokensSeen;
  if (!tokensSeen) {
    return {
      async findByAddress() {
        return null;
      },
      async insert() {
        return null;
      },
      async updateByAddress() {},
    };
  }

  return {
    async findByAddress(address) {
      const rows = await db.select().from(tokensSeen).where(eq(tokensSeen.address, address)).limit(1);
      return rows[0] || null;
    },

    async findByAddresses(addresses = []) {
      const uniqueAddresses = [...new Set(addresses.filter(Boolean))];
      if (!uniqueAddresses.length) {
        return [];
      }
      return db.select().from(tokensSeen).where(inArray(tokensSeen.address, uniqueAddresses));
    },

    async insert(row) {
      if (!row) {
        return null;
      }

      await db.insert(tokensSeen).values(row).onConflictDoNothing({
        target: [tokensSeen.address],
      });
      return this.findByAddress(row.address);
    },

    async updateByAddress(address, updates = {}) {
      await db.update(tokensSeen).set(updates).where(eq(tokensSeen.address, address));
    },
  };
}
