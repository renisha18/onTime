// src/components/LinkContracts.jsx
// Debug version with extensive logging

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { getArcTokenContract, getBillSplitContract } from '../utils/contracts';

export default function LinkContracts() {
  console.log('🔵 [LinkContracts] Component rendering...');
  
  const arcToken = getArcTokenContract();
  const billSplit = getBillSplitContract();

  console.log('🔵 [LinkContracts] ArcToken:', arcToken.address);
  console.log('🔵 [LinkContracts] BillSplit:', billSplit.address);

  // Read current linked address
  const { data: currentBillSplit } = useReadContract({
    address: arcToken.address,
    abi: arcToken.abi,
    functionName: 'billSplitContract',
  });

  console.log('🔵 [LinkContracts] Current linked address:', currentBillSplit);

  // Write contract
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  console.log('🔵 [LinkContracts] isPending:', isPending);
  console.log('🔵 [LinkContracts] isConfirming:', isConfirming);
  console.log('🔵 [LinkContracts] isSuccess:', isSuccess);
  console.log('🔵 [LinkContracts] writeError:', writeError);

  const handleLink = async () => {
    console.log('🟡 [LinkContracts] ========== LINK BUTTON CLICKED ==========');
    
    try {
      console.log('🟡 [LinkContracts] Preparing transaction...');
      console.log('🟡 [LinkContracts] ArcToken address:', arcToken.address);
      console.log('🟡 [LinkContracts] Function: setBillSplitContract');
      console.log('🟡 [LinkContracts] Argument:', billSplit.address);
      
      // Check if function exists in ABI
      const hasFunction = arcToken.abi.some(item => 
        item.type === 'function' && item.name === 'setBillSplitContract'
      );
      console.log('🟡 [LinkContracts] Has setBillSplitContract in ABI:', hasFunction);
      
      if (!hasFunction) {
        console.error('❌ [LinkContracts] setBillSplitContract not found in ABI!');
        alert('Error: setBillSplitContract function not found in ABI');
        return;
      }

      console.log('🟡 [LinkContracts] Calling writeContract...');
      
      const result = await writeContract({
        address: arcToken.address,
        abi: arcToken.abi,
        functionName: 'setBillSplitContract',
        args: [billSplit.address],
      });

      console.log('✅ [LinkContracts] writeContract returned:', result);
    } catch (err) {
      console.error('❌ [LinkContracts] Error in handleLink:', err);
      console.error('❌ [LinkContracts] Error name:', err.name);
      console.error('❌ [LinkContracts] Error message:', err.message);
      console.error('❌ [LinkContracts] Full error:', err);
      alert('Error: ' + (err.shortMessage || err.message || 'Unknown error'));
    }
  };

  const isNotSet = !currentBillSplit || currentBillSplit === '0x0000000000000000000000000000000000000000';
  const isLinked = currentBillSplit?.toLowerCase() === billSplit.address.toLowerCase();
  const isWrongAddress = currentBillSplit && !isNotSet && !isLinked;

  console.log('🔵 [LinkContracts] isNotSet:', isNotSet);
  console.log('🔵 [LinkContracts] isLinked:', isLinked);
  console.log('🔵 [LinkContracts] isWrongAddress:', isWrongAddress);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>⚙️ Contract Linking Status</h3>
      
      <div style={styles.info}>
        <p><strong>ArcToken Address:</strong></p>
        <code style={styles.address}>{arcToken.address}</code>
      </div>

      <div style={styles.info}>
        <p><strong>BillSplit Address:</strong></p>
        <code style={styles.address}>{billSplit.address}</code>
      </div>

      <div style={styles.info}>
        <p><strong>Currently Linked To:</strong></p>
        <code style={styles.address}>
          {isNotSet ? '(not set yet)' : currentBillSplit}
        </code>
      </div>

      <div style={styles.status}>
        {isLinked && (
          <div style={styles.successBox}>
            ✅ Contracts are properly linked! You can remove this component now.
          </div>
        )}

        {isWrongAddress && (
          <div style={styles.errorBox}>
            ❌ Linked to wrong address! You may need to redeploy ArcToken.
            <br />
            Expected: {billSplit.address}
            <br />
            Got: {currentBillSplit}
          </div>
        )}

        {isNotSet && (
          <div style={styles.warningBox}>
            ⚠️ Contracts not linked yet. Click the button below to link them.
          </div>
        )}
      </div>

      {writeError && (
        <div style={styles.errorBox}>
          ❌ Error: {writeError.shortMessage || writeError.message}
        </div>
      )}

      {!isLinked && !isWrongAddress && (
        <button
          onClick={handleLink}
          disabled={isPending || isConfirming}
          style={{
            ...styles.button,
            opacity: (isPending || isConfirming) ? 0.6 : 1,
            cursor: (isPending || isConfirming) ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending && '⏳ Waiting for approval...'}
          {isConfirming && '⏳ Confirming...'}
          {!isPending && !isConfirming && '🔗 Link Contracts (Click Me!)'}
        </button>
      )}

      {hash && (
        <div style={styles.txInfo}>
          <p style={{ margin: '0 0 8px 0' }}>✅ Transaction submitted!</p>
          <a 
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            View on Sepolia Etherscan →
          </a>
        </div>
      )}

      {isSuccess && (
        <div style={styles.successBox}>
          🎉 Transaction confirmed! Refresh the page to see the update.
        </div>
      )}

      {/* Debug Info */}
      <details style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
        <summary style={{ cursor: 'pointer' }}>Debug Info (Check Console)</summary>
        <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
          <p>Open browser console (F12) to see detailed logs</p>
          <p>Look for messages starting with [LinkContracts]</p>
        </div>
      </details>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '20px auto',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '2px solid #0E76FD',
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    color: '#1a1a1a',
  },
  info: {
    marginBottom: '16px',
  },
  address: {
    display: 'block',
    backgroundColor: '#f3f4f6',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'monospace',
    marginTop: '4px',
    wordBreak: 'break-all',
  },
  status: {
    marginTop: '20px',
    marginBottom: '20px',
  },
  successBox: {
    backgroundColor: '#d1fae5',
    border: '2px solid #10b981',
    padding: '12px',
    borderRadius: '8px',
    color: '#065f46',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    border: '2px solid #ef4444',
    padding: '12px',
    borderRadius: '8px',
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: '12px',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    border: '2px solid #f59e0b',
    padding: '12px',
    borderRadius: '8px',
    color: '#92400e',
    fontWeight: '600',
  },
  button: {
    width: '100%',
    backgroundColor: '#0E76FD',
    color: 'white',
    border: 'none',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  txInfo: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#e0f2fe',
    borderRadius: '8px',
    textAlign: 'center',
    border: '2px solid #0284c7',
  },
  link: {
    color: '#0E76FD',
    textDecoration: 'none',
    fontWeight: '600',
  },
};
