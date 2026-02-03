import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Simple config - just MetaMask support
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(), // This detects MetaMask automatically
  ],
  transports: {
    [sepolia.id]: http(), // Use public RPC
  },
});