import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { getENSName, getENSAvatar, shortenAddress } from '../utils/ens';

export default function Profile() {
  const { address, isConnected } = useAccount();
  const [ensName, setEnsName] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchENSData() {
      if (!address) return;

      setLoading(true);
      try {
        const name = await getENSName(address);
        setEnsName(name);

        if (name) {
          const avatarUrl = await getENSAvatar(name);
          setAvatar(avatarUrl);
        }
      } catch (error) {
        console.error('Error loading ENS:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchENSData();
  }, [address]);

  if (!isConnected) return null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {loading ? (
          <p>Heyy hi loading your details </p>
        ) : (
          <>
            <div style={styles.headerRow}>
              {avatar ? (
                <img src={avatar} alt="ENS Avatar" style={styles.smallAvatar} />
              ) : (
                <div style={styles.smallDefaultAvatar}>
                  {(ensName || '?').charAt(0).toUpperCase()}
                </div>
              )}

              <div style={styles.nameBlock}>
                <div style={styles.name}>
                  Hi, {ensName || shortenAddress(address)} 
                </div>
                <div style={styles.address}>
                  {shortenAddress(address)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!loading && !ensName && (
        <div style={styles.prompt}>
          <p>Want an ENS name?</p>
          <a
            href="https://app.ens.domains"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Register on Sepolia →
          </a>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'left',
    gap: '20px',
    marginTop: '40px',
  },
  card: {
    backgroundColor: 'white',
    padding: '12px',
    textAlign: 'left',
    minWidth: '300px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  smallAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid #000307',
  },
  smallDefaultAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#E0E7FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#050505',
  },
  nameBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  address: {
    fontSize: '13px',
    color: '#6B7280',
  },
  prompt: {
    backgroundColor: '#FEF3C7',
    textAlign: 'center',
    padding: '12px',
    borderRadius: '8px',
  },
  link: {
    color: '#0E76FD',
    fontWeight: '600',
  },
};