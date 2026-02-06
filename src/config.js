// src/config.js
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Wagmi configuration for wallet connection
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(), // MetaMask and other injected wallets
  ],
  transports: {
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
})