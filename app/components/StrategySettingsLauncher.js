'use client';

import { useEffect, useMemo, useState } from 'react';
import { withAppBasePath } from '../../src/lib/app-path.js';

const STRATEGY_SETTINGS_STORAGE_KEY = 'vault-strategy-settings';

function normalizeSettings(settings) {
  const fallbackSteps = [
    { targetPercent: 80, sellPercent: 55.56, sellMode: 'recover_principal' },
    { targetPercent: 150, sellPercent: 50, sellMode: 'remaining_percent' },
  ];
  const steps = Array.isArray(settings?.takeProfitSteps) ? settings.takeProfitSteps : [];
  return {
    stopLossPercent: Number(settings?.stopLossPercent ?? 80),
    timeStopHours: Number(settings?.timeStopHours ?? 0),
    tp1ProtectionPercent: Number(settings?.tp1ProtectionPercent ?? 0),
    fastFailureMinutes: Number(settings?.fastFailureMinutes ?? 0),
    fastFailureLossPercent: Number(settings?.fastFailureLossPercent ?? 0),
    takeProfitSteps: steps.length > 0 ? steps : fallbackSteps,
  };
}

function readStoredSettings(fallbackSettings) {
  if (typeof window === 'undefined') {
    return fallbackSettings;
  }

  try {
    const raw = window.localStorage.getItem(STRATEGY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return fallbackSettings;
    }

    return normalizeSettings(JSON.parse(raw));
  } catch {
    return fallbackSettings;
  }
}

function writeStoredSettings(settings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STRATEGY_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeSettings(settings))
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="strategy-settings-icon-svg">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
      />
    </svg>
  );
}

export default function StrategySettingsLauncher({
  settings,
  onSaved,
  locked = false,
  openPositionCount = 0,
  variant = 'default',
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const normalizedSettings = useMemo(() => normalizeSettings(settings), [settings]);
  const [form, setForm] = useState(normalizedSettings);
  const lockMessage =
    locked && openPositionCount > 0
      ? `当前有 ${openPositionCount} 个未平仓持仓，请先清空持仓后再修改参数`
      : '当前有未平仓持仓，请先清空持仓后再修改参数';

  useEffect(() => {
    if (!open) {
      setError('');
      return;
    }

    setForm(readStoredSettings(normalizedSettings));
    setError('');
  }, [normalizedSettings, open]);

  function updateStep(index, key, value) {
    setForm((current) => ({
      ...current,
      takeProfitSteps: current.takeProfitSteps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [key]: value } : step
      ),
    }));
  }

  async function handleSave() {
    if (locked) {
      setError(lockMessage);
      return;
    }

    try {
      setSaving(true);
      setError('');
      const response = await fetch(withAppBasePath('/api/signals/config'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stopLossPercent: Number(form.stopLossPercent),
          timeStopHours: Number(form.timeStopHours),
          tp1ProtectionPercent: Number(form.tp1ProtectionPercent),
          fastFailureMinutes: Number(form.fastFailureMinutes),
          fastFailureLossPercent: Number(form.fastFailureLossPercent),
          takeProfitSteps: form.takeProfitSteps.map((step) => ({
            targetPercent: Number(step.targetPercent),
            sellPercent: Number(step.sellPercent),
            sellMode: step.sellMode,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || '保存失败');
      }
      writeStoredSettings(json.paperTradeSettings);
      onSaved?.(json.paperTradeSettings);
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          className="strategy-settings-icon-btn"
          onClick={() => setOpen(true)}
          disabled={locked}
          title={locked ? lockMessage : '修改策略参数'}
          aria-label={locked ? lockMessage : '修改策略参数'}
        >
          <SettingsIcon />
        </button>
      ) : (
        <button
          type="button"
          className="nav-link nav-action-btn"
          onClick={() => setOpen(true)}
          disabled={locked}
          title={locked ? lockMessage : '修改策略参数'}
        >
          {locked ? '策略参数已锁定' : '策略参数'}
        </button>
      )}

      {open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="settings-modal compact-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="strategy-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-modal-header compact-settings-header">
              <div>
                <h3 id="strategy-settings-title">止盈 / 止损 配置</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn modal-close-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                title="关闭"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-form-grid compact-settings-grid compact-risk-grid">
                <label className="settings-field compact-settings-field">
                  <span>止损</span>
                  <div className="settings-input-wrap compact-settings-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="95"
                      step="1"
                      value={form.stopLossPercent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stopLossPercent: event.target.value,
                        }))
                      }
                    />
                    <em>%</em>
                  </div>
                </label>

                <label className="settings-field compact-settings-field">
                  <span>时限</span>
                  <div className="settings-input-wrap compact-settings-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="168"
                      step="1"
                      value={form.timeStopHours}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          timeStopHours: event.target.value,
                        }))
                      }
                    />
                    <em>h</em>
                  </div>
                </label>

                <label className="settings-field compact-settings-field">
                  <span>TP1 后保护</span>
                  <div className="settings-input-wrap compact-settings-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      value={form.tp1ProtectionPercent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          tp1ProtectionPercent: event.target.value,
                        }))
                      }
                    />
                    <em>%</em>
                  </div>
                </label>

                <label className="settings-field compact-settings-field">
                  <span>快速失败时限</span>
                  <div className="settings-input-wrap compact-settings-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="240"
                      step="1"
                      value={form.fastFailureMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fastFailureMinutes: event.target.value,
                        }))
                      }
                    />
                    <em>m</em>
                  </div>
                </label>

                <label className="settings-field compact-settings-field">
                  <span>快速失败跌幅</span>
                  <div className="settings-input-wrap compact-settings-input-wrap">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      step="1"
                      value={form.fastFailureLossPercent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fastFailureLossPercent: event.target.value,
                        }))
                      }
                    />
                    <em>%</em>
                  </div>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">止盈</div>
              <div className="compact-settings-steps">
                {form.takeProfitSteps.map((step, index) => (
                  <div key={`tp-step-${index}`} className="settings-step-card compact-settings-step-card">
                    <strong>TP{index + 1}</strong>
                    <div className="settings-step-grid">
                      <label className="settings-field compact-settings-field compact-inline-field">
                        <div className="settings-input-wrap compact-settings-input-wrap compact-prefix-input-wrap">
                          <span className="compact-input-prefix">涨幅</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={step.targetPercent}
                            onChange={(event) => updateStep(index, 'targetPercent', event.target.value)}
                          />
                          <em>%</em>
                        </div>
                      </label>
                      <label className="settings-field compact-settings-field compact-inline-field">
                        <div className="settings-input-wrap compact-settings-input-wrap compact-prefix-input-wrap">
                          <span className="compact-input-prefix">卖出</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            value={step.sellPercent}
                            onChange={(event) => updateStep(index, 'sellPercent', event.target.value)}
                          />
                          <em>%</em>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? <div className="error-state settings-error">{error}</div> : null}

            <div className="settings-modal-footer compact-settings-footer">
              <button type="button" className="sort-chip" onClick={() => setOpen(false)} disabled={saving}>
                取消
              </button>
              <button type="button" className="sort-chip active" onClick={handleSave} disabled={saving || locked}>
                {saving ? '保存中...' : '保存参数'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
