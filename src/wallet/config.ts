import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(import.meta.env.VITE_RPC_PRIMARY || 'https://1rpc.io/sepolia'),
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    appName: 'IntentFi',
    appDescription: 'AI-assisted on-chain intent execution',
  }),
);
