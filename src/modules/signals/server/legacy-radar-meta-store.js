export function setRadarMeta(db, key, value) {
  db.prepare(`
    INSERT INTO radar_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export function getRadarMeta(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM radar_meta WHERE key = ?').get(key);
  return row?.value ?? fallback;
}
