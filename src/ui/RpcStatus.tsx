import { useState, useEffect } from 'react';
import { getRpcStatus, RpcStatus as RpcStatusType } from '../utils/rpc';

export function RpcStatus() {
  const [status, setStatus] = useState<RpcStatusType | null>(null);

  useEffect(() => {
    getRpcStatus().then(setStatus);
    const interval = setInterval(() => {
      getRpcStatus().then(setStatus);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className={`rpc-status ${status.connected ? 'connected' : 'disconnected'}`}>
      <span className="rpc-dot" />
      <span className="rpc-text">
        {status.connected
          ? `RPC${status.usingFallback ? ' (fallback)' : ''} \u2022 Block ${status.blockNumber?.toString()}`
          : 'RPC disconnected'}
      </span>
    </div>
  );
}
