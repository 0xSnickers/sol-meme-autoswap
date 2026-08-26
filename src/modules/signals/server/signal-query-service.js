import {
  getPaperTradeSettingsLockState,
  getPersistedSignalSnapshot,
  getRealtimeSignalSnapshot,
  getStoredPaperTradeSettings,
  manuallyCloseStoredPaperPositions,
  updateStoredPaperTradeSettings,
} from '../../../signal-scanner.js';
import {
  canUseDrizzlePersistedSignalQueries,
  readPersistedSignalSnapshotFromDrizzle,
} from '../query/persisted-signal-query-service.js';
import {
  canUseDrizzlePaperTradeSettingsQueries,
  readPaperTradeSettingsFromDrizzle,
  readPaperTradeSettingsLockStateFromDrizzle,
  savePaperTradeSettingsToDrizzle,
} from '../query/paper-trade-settings-query-service.js';
import {
  canUseDrizzleRealtimeSignalQueries,
  readRealtimeSignalSnapshotFromDrizzle,
} from '../query/realtime-signal-query-service.js';

export async function readSignalSnapshot(limit) {
  if (canUseDrizzlePersistedSignalQueries()) {
    return readPersistedSignalSnapshotFromDrizzle(limit);
  }
  return getPersistedSignalSnapshot(limit);
}

export async function readRealtimeSignalSnapshot(limit) {
  if (canUseDrizzleRealtimeSignalQueries()) {
    return readRealtimeSignalSnapshotFromDrizzle(limit);
  }
  return getRealtimeSignalSnapshot(limit);
}

export async function readPaperTradeSettings() {
  if (canUseDrizzlePaperTradeSettingsQueries()) {
    return readPaperTradeSettingsFromDrizzle();
  }
  return getStoredPaperTradeSettings();
}

export async function readPaperTradeSettingsLockState() {
  if (canUseDrizzlePaperTradeSettingsQueries()) {
    return readPaperTradeSettingsLockStateFromDrizzle();
  }
  return getPaperTradeSettingsLockState();
}

export async function savePaperTradeSettings(payload) {
  if (canUseDrizzlePaperTradeSettingsQueries()) {
    return savePaperTradeSettingsToDrizzle(payload, {
      applyToOpenPositions: Boolean(payload?.applyToOpenPositions),
    });
  }
  return updateStoredPaperTradeSettings(payload, {
    applyToOpenPositions: Boolean(payload?.applyToOpenPositions),
  });
}

export async function closePaperPositions(payload) {
  return manuallyCloseStoredPaperPositions(payload);
}
