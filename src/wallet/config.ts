import { createConfig, http, fallback } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: fallback([
        http(import.meta.env.VITE_RPC_FALLBACK || 'https://ethereum-sepolia-rpc.publicnode.com'),
        http(import.meta.env.VITE_RPC_PRIMARY || 'https://1rpc.io/sepolia'),
      ]),
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    appName: 'IntentFi',
    appDescription: 'AI-assisted on-chain intent execution',
  }),
);
