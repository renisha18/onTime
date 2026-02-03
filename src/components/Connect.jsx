import { useAccount, useConnect, useDisconnect } from 'wagmi';

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const shortenAddress = (addr) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (isConnected) {
    return (
      <div style={styles.connectedContainer}>
        <span style={styles.address}>{shortenAddress(address)}</span>
        <button onClick={() => disconnect()} style={styles.disconnectButton}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      style={styles.connectButton}
    >
      Connect Wallet
    </button>
  );
}

const styles = {
  connectedContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  address: {
    backgroundColor: '#E0E7FF',
    padding: '8px 16px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  connectButton: {
    backgroundColor: '#000000',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};