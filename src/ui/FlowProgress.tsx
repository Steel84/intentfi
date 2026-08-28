import { AppState } from './App';

type Props = { state: AppState };
const steps = [
  ['Intent', ['parsing', 'quoting', 'checking-policy', 'simulating', 'ready', 'executing', 'confirmed']],
  ['Live quote', ['quoting', 'checking-policy', 'simulating', 'ready', 'executing', 'confirmed']],
  ['Policy', ['checking-policy', 'simulating', 'ready', 'executing', 'confirmed']],
  ['Preflight', ['simulating', 'ready', 'executing', 'confirmed']],
  ['Approval', ['ready', 'executing', 'confirmed']],
  ['Confirmed', ['confirmed']],
] as const;

export function FlowProgress({ state }: Props) {
  if (state === 'idle' || state === 'error') return null;
  return (
    <div className="flow-progress" aria-label="Swap progress">
      {steps.map(([label, activeStates]) => {
        const active = activeStates.includes(state as never);
        const current = activeStates[0] === state || (label === 'Intent' && state === 'parsing');
        return <span key={label} className={`progress-step ${active ? 'active' : ''} ${current ? 'current' : ''}`}>{active && !current ? '✓ ' : ''}{label}</span>;
      })}
    </div>
  );
}
