'use client';

import { useEffect, useMemo, useState } from 'react';

function normalizeSettings(settings) {
  const fallbackSteps = [
    { targetPercent: 40, sellPercent: 50 },
    { targetPercent: 100, sellPercent: 30 },
  ];
  const steps = Array.isArray(settings?.takeProfitSteps) ? settings.takeProfitSteps : [];
  return {
    stopLossPercent: Number(settings?.stopLossPercent ?? 40),
    trailingStartPercent: Number(settings?.trailingStartPercent ?? 70),
    trailingStopPercent: Number(settings?.trailingStopPercent ?? 20),
    timeStopHours: Number(settings?.timeStopHours ?? 12),
    takeProfitSteps: steps.length > 0 ? steps : fallbackSteps,
  };
}

export default function StrategySettingsLauncher({
  settings,
  onSaved,
  locked = false,
  openPositionCount = 0,
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
      setForm(normalizedSettings);
      setError('');
    }
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
      const response = await fetch('/api/signals/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stopLossPercent: Number(form.stopLossPercent),
          trailingStartPercent: Number(form.trailingStartPercent),
          trailingStopPercent: Number(form.trailingStopPercent),
          timeStopHours: Number(form.timeStopHours),
          takeProfitSteps: form.takeProfitSteps.map((step) => ({
            targetPercent: Number(step.targetPercent),
            sellPercent: Number(step.sellPercent),
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || '保存失败');
      }
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
      <button
        type="button"
        className="nav-link nav-action-btn"
        onClick={() => setOpen(true)}
        disabled={locked}
        title={locked ? lockMessage : '修改策略参数'}
      >
        {locked ? '策略参数已锁定' : '策略参数'}
      </button>

      {open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="strategy-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-modal-header">
              <div>
                <h3 id="strategy-settings-title">止盈止损参数</h3>
                <p>{locked ? lockMessage : '当前仅允许在没有持仓时修改，修改后会应用到后续开仓。'}</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>

            <div className="settings-form-grid">
              <label className="settings-field">
                <span>止损</span>
                <div className="settings-input-wrap">
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

              <label className="settings-field">
                <span>时间止损</span>
                <div className="settings-input-wrap">
                  <input
                    type="number"
                    min="1"
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

              <label className="settings-field">
                <span>Trailing 启动</span>
                <div className="settings-input-wrap">
                  <input
                    type="number"
                    min="10"
                    max="300"
                    step="1"
                    value={form.trailingStartPercent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        trailingStartPercent: event.target.value,
                      }))
                    }
                  />
                  <em>%</em>
                </div>
              </label>

              <label className="settings-field">
                <span>Trailing 回撤</span>
                <div className="settings-input-wrap">
                  <input
                    type="number"
                    min="5"
                    max="80"
                    step="1"
                    value={form.trailingStopPercent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        trailingStopPercent: event.target.value,
                      }))
                    }
                  />
                  <em>%</em>
                </div>
              </label>

              {form.takeProfitSteps.map((step, index) => (
                <div key={`tp-step-${index}`} className="settings-step-card">
                  <strong>止盈 {index + 1}</strong>
                  <label className="settings-field">
                    <span>触发涨幅</span>
                    <div className="settings-input-wrap">
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
                  <label className="settings-field">
                    <span>卖出仓位</span>
                    <div className="settings-input-wrap">
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
              ))}
            </div>

            {error ? <div className="error-state settings-error">{error}</div> : null}

            <div className="settings-modal-footer">
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
