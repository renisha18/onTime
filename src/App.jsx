import { useAccount } from 'wagmi';
import ConnectButton from './components/Connect';
import Profile from './components/profile';

function App() {
  const { isConnected } = useAccount();

  return (
    <div style={styles.app}>
      {!isConnected ? (
        // LANDING SCREEN
        <div style={styles.landing}>
          <h1 style={styles.title}>onTime</h1>
          <p style={styles.tagline}>Painless payments, rewarded.</p>
          <ConnectButton />
        </div>
      ) : (
        // AFTER CONNECT
        <Profile />
      )}
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  landing: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '48px',
    fontWeight: '800',
  },
  tagline: {
    fontSize: '18px',
    color: '#555',
    marginBottom: '20px',
  },
};

export default App;