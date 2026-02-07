import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { getENSName, getENSAvatar, shortenAddress } from '../utils/ens';
import './Profile.css';

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
    <div className="profile-container">
      <div className="profile-card">
        {loading ? (
          <p className="profile-loading">Loading your identity…</p>
        ) : (
          <div className="profile-header">
            {avatar ? (
              <img src={avatar} alt="ENS Avatar" className="profile-avatar" />
            ) : (
              <div className="profile-avatar-fallback">
                {(ensName || '?').charAt(0).toUpperCase()}
              </div>
            )}

            <div className="profile-name-block">
              <div className="profile-name">
                Hi, {ensName || shortenAddress(address)}
              </div>
              <div className="profile-address">
                {shortenAddress(address)}
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && !ensName && (
        <div className="profile-ens-prompt">
          <p>Want an ENS name?</p>
          <a
            href="https://app.ens.domains"
            target="_blank"
            rel="noopener noreferrer"
          >
            Register on Sepolia →
          </a>
        </div>
      )}
    </div>
  );
}