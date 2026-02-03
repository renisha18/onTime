import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';
import { getEnsAvatar, getEnsName } from 'viem/actions';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

export async function getENSName(address) {
  try {
    const ensName = await getEnsName(publicClient, { address });
    return ensName;
  } catch (error) {
    console.error('Error fetching ENS name:', error);
    return null;
  }
}

export async function getENSAvatar(ensName) {
  try {
    const avatar = await getEnsAvatar(publicClient, {
      name: normalize(ensName),
    });
    return avatar;
  } catch (error) {
    console.error('Error fetching ENS avatar:', error);
    return null;
  }
}

export function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}