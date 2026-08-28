import { useState } from 'react';
import { PolicyConfig } from '../types';

type Props = { config: PolicyConfig; onSave: (config: PolicyConfig) => void };

export function PolicySettings({ config, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [slippage, setSlippage] = useState(String(config.maxSlippageBps / 100));
  const [impact, setImpact] = useState(String(config.maxPriceImpactBps / 100));

  const save = () => {
    const nextSlippage = Number(slippage);
    const nextImpact = Number(impact);
    if (!Number.isFinite(nextSlippage) || nextSlippage < 0 || nextSlippage > 100) return;
    if (!Number.isFinite(nextImpact) || nextImpact < 0 || nextImpact > 100) return;
    onSave({ ...config, maxSlippageBps: Math.round(nextSlippage * 100), maxPriceImpactBps: Math.round(nextImpact * 100) });
    setOpen(false);
  };

  return (
    <div className="policy-settings">
      <button className="settings-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        Safety policy {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="settings-panel">
          <p>These local limits are enforced deterministically before approval.</p>
          <label>Max slippage (%)<input type="number" min="0" max="100" step="0.1" value={slippage} onChange={e => setSlippage(e.target.value)} /></label>
          <label>Max price impact (%)<input type="number" min="0" max="100" step="0.1" value={impact} onChange={e => setImpact(e.target.value)} /></label>
          <button className="btn-save-settings" onClick={save}>Save policy</button>
        </div>
      )}
    </div>
  );
}
