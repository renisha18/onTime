import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { getBillSplitContract, getArcTokenContract } from '../utils/contracts';
import { initializeNitrolite, sendPayment } from '../utils/Nitrolitehelper';

export default function ExpenseList() {
  const { address, isConnected } = useAccount();
  const [nitroliteClient, setNitroliteClient] = useState(null);

  // Initialize Nitrolite when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      console.log('🔄 [ExpenseList] Initializing Nitrolite for payments...');
      initializeNitrolite(address).then(client => {
        if (client) {
          setNitroliteClient(client);
          console.log('✅ [ExpenseList] Nitrolite ready for gasless payments');
        }
      });
    }
  }, [isConnected, address]);

  // Read user's expenses
  const { data: expenseIds, refetch } = useReadContract({
    ...getBillSplitContract(),
    functionName: 'getUserExpenses',
    args: [address],
  });

  // Read user's Arc rewards
  const { data: totalRewards } = useReadContract({
    ...getBillSplitContract(),
    functionName: 'getUserRewards',
    args: [address],
  });

  const arcRewards = totalRewards ? (Number(totalRewards) / 1e18).toFixed(2) : '0.00';

  if (!expenseIds || expenseIds.length === 0) {
    return (
      <div style={styles.emptyState}>
        <h2>No expenses yet</h2>
        <p>Create an expense to get started!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Your Expenses</h1>
        
        {/* Arc Balance Display */}
        <div style={styles.arcBadge}>
          🪙 Total Arc Rewards: <strong>{arcRewards} ARC</strong>
        </div>
      </div>
      
      {/* Nitrolite Status Banner */}
      {nitroliteClient && (
        <div style={styles.nitroliteStatus}>
          ⚡ Gasless payments enabled via Yellow Network
        </div>
      )}

      <div style={styles.list}>
        {expenseIds.map((id) => (
          <ExpenseCard 
            key={id.toString()} 
            expenseId={id} 
            currentUserAddress={address}
            nitroliteClient={nitroliteClient}
            onPaymentComplete={refetch}
          />
        ))}
      </div>
    </div>
  );
}

function ExpenseCard({ expenseId, currentUserAddress, nitroliteClient, onPaymentComplete }) {
  const [isPaying, setIsPaying] = useState(false);
  const [offChainPaymentPending, setOffChainPaymentPending] = useState(false);

  // Read expense details
  const { data: expense, refetch: refetchExpense } = useReadContract({
    ...getBillSplitContract(),
    functionName: 'getExpense',
    args: [expenseId],
  });

  // Check if current user has paid
  const { data: hasPaid, refetch: refetchPaymentStatus } = useReadContract({
    ...getBillSplitContract(),
    functionName: 'hasPaid',
    args: [expenseId, currentUserAddress],
  });

  // Write contract for payment
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash 
  });

  // Log any write errors
  useEffect(() => {
    if (writeError) {
      console.error('❌ [ExpenseCard] Write contract error:', writeError);
      alert('Transaction error: ' + (writeError.shortMessage || writeError.message));
      setIsPaying(false);
    }
  }, [writeError]);

  // Handle successful payment
  useEffect(() => {
    if (isSuccess && isPaying) {
      console.log('✅ [ExpenseCard] Payment confirmed!');
      setIsPaying(false);
      refetchExpense();
      refetchPaymentStatus();
      onPaymentComplete?.();
    }
  }, [isSuccess, isPaying]);

  if (!expense) {
    return (
      <div style={styles.card}>
        <p>Loading expense...</p>
      </div>
    );
  }

  // Parse expense data
  const [id, payer, description, totalAmount, amountPerPerson, participants, createdAt, isSettled] = expense;

  const totalEth = formatEther(totalAmount);
  const shareEth = formatEther(amountPerPerson);
  const isPayer = payer.toLowerCase() === currentUserAddress?.toLowerCase();
  const userHasPaid = hasPaid || isPayer;

  // Calculate payment timing for Arc rewards
  const getPaymentReward = () => {
    const timeDiff = (Date.now() - Number(createdAt) * 1000) / 1000;
    if (timeDiff < 3600) return { amount: 2, label: '⚡ Instant', color: '#10b981' };
    if (timeDiff < 86400) return { amount: 1, label: '🔥 Fast', color: '#f59e0b' };
    if (timeDiff < 604800) return { amount: 0.5, label: '💨 Normal', color: '#06b6d4' };
    return { amount: 0, label: '', color: '' };
  };

  const reward = getPaymentReward();

  // Handle off-chain payment notification via Nitrolite
  const handleOffChainPayment = async () => {
    if (!nitroliteClient) {
      console.warn('⚠️ [ExpenseCard] Nitrolite not available');
      return false;
    }

    try {
      console.log('⚡ [ExpenseCard] Sending off-chain payment notification...');
      setOffChainPaymentPending(true);

      const result = await sendPayment(nitroliteClient, expenseId.toString(), {
        from: currentUserAddress,
        expenseId: expenseId.toString(),
        amount: amountPerPerson.toString(),
        timestamp: Date.now(),
        description: description,
      });

      if (result) {
        console.log('✅ [ExpenseCard] Off-chain payment notification sent');
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('❌ [ExpenseCard] Off-chain payment failed:', err);
      return false;
    } finally {
      setOffChainPaymentPending(false);
    }
  };

  // Handle full payment with extensive debugging
  const handlePayExpense = async () => {
    console.log('🔵 [ExpenseCard] ========== PAY BUTTON CLICKED ==========');
    console.log('🔵 [ExpenseCard] Current user:', currentUserAddress);
    console.log('🔵 [ExpenseCard] User has paid:', userHasPaid);
    console.log('🔵 [ExpenseCard] Is payer:', isPayer);
    console.log('🔵 [ExpenseCard] Is paying:', isPaying);

    if (!currentUserAddress) {
      console.error('❌ [ExpenseCard] No wallet address');
      alert('Please connect your wallet first');
      return;
    }

    if (userHasPaid) {
      console.warn('⚠️ [ExpenseCard] User already paid, early return');
      return;
    }

    if (isPaying) {
      console.warn('⚠️ [ExpenseCard] Payment already in progress');
      return;
    }

    setIsPaying(true);
    console.log('💰 [ExpenseCard] Starting payment process...');

    try {
      console.log('💰 [ExpenseCard] Payment details:');
      console.log('  - Expense ID:', expenseId.toString());
      console.log('  - Expense ID type:', typeof expenseId);
      console.log('  - Amount:', shareEth, 'ETH');
      console.log('  - Amount (wei):', amountPerPerson.toString());
      console.log('  - Amount type:', typeof amountPerPerson);

      // Step 1: Try off-chain notification first (if Nitrolite available)
      if (nitroliteClient) {
        console.log('⚡ [ExpenseCard] Attempting gasless notification...');
        await handleOffChainPayment();
      }

      // Step 2: Get contract details
      console.log('💰 [ExpenseCard] Getting contract details...');
      const contract = getBillSplitContract();
      console.log('💰 [ExpenseCard] Contract address:', contract.address);
      console.log('💰 [ExpenseCard] ABI length:', contract.abi.length);
      
      // Check if settleExpense exists in ABI
      const hasSettleExpense = contract.abi.some(item => 
        item.type === 'function' && item.name === 'settleExpense'
      );
      console.log('💰 [ExpenseCard] Has settleExpense in ABI:', hasSettleExpense);

      if (!hasSettleExpense) {
        console.error('❌ [ExpenseCard] settleExpense not found in ABI!');
        console.log('Available functions:', contract.abi
          .filter(item => item.type === 'function')
          .map(f => f.name)
        );
        alert('Contract ABI error: settleExpense function not found');
        setIsPaying(false);
        return;
      }

      // Step 3: Prepare transaction parameters with type safety
      console.log('💰 [ExpenseCard] Preparing transaction parameters...');
      
      const txParams = {
        address: contract.address,
        abi: contract.abi,
        functionName: 'settleExpense',
        args: [expenseId], // Keep as BigInt
        value: amountPerPerson, // Keep as BigInt
      };

      console.log('💰 [ExpenseCard] Transaction parameters:');
      console.log('  - address:', txParams.address);
      console.log('  - functionName:', txParams.functionName);
      console.log('  - args:', txParams.args);
      console.log('  - args[0] (expenseId):', txParams.args[0].toString(), typeof txParams.args[0]);
      console.log('  - value:', txParams.value.toString(), typeof txParams.value);

      // Step 4: Execute on-chain payment
      console.log('💰 [ExpenseCard] Calling writeContract...');
      
      await writeContract(txParams);

      console.log('✅ [ExpenseCard] writeContract called successfully');
      console.log('💰 [ExpenseCard] Waiting for MetaMask approval...');
    } catch (err) {
      console.error('❌ [ExpenseCard] Payment failed:', err);
      console.error('❌ [ExpenseCard] Error name:', err.name);
      console.error('❌ [ExpenseCard] Error message:', err.message);
      console.error('❌ [ExpenseCard] Error stack:', err.stack);
      setIsPaying(false);
      
      if (err.message?.includes('User rejected')) {
        alert('Transaction cancelled');
      } else {
        alert('Payment failed: ' + (err.shortMessage || err.message || 'Unknown error'));
      }
    }
  };

  const numParticipants = participants.length;
  const participantsList = participants.map(p => 
    `${p.slice(0, 6)}...${p.slice(-4)}`
  ).join(', ');

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{description}</h3>
        {isSettled ? (
          <span style={styles.badgeSettled}>✅ Settled</span>
        ) : userHasPaid ? (
          <span style={styles.badgePaid}>✅ Paid</span>
        ) : (
          <span style={styles.badgePending}>⏳ Pending</span>
        )}
      </div>

      {/* Details */}
      <div style={styles.cardBody}>
        <div style={styles.amountSection}>
          <div style={styles.amountRow}>
            <span style={styles.label}>Total Amount:</span>
            <span style={styles.amount}>{Number(totalEth).toFixed(4)} ETH</span>
          </div>
          <div style={styles.amountRow}>
            <span style={styles.label}>Your Share:</span>
            <span style={styles.amountHighlight}>{Number(shareEth).toFixed(4)} ETH</span>
          </div>
          <div style={styles.amountRow}>
            <span style={styles.label}>Split Between:</span>
            <span style={styles.value}>{numParticipants} people</span>
          </div>
        </div>

        <div style={styles.participantsSection}>
          <p style={styles.participantsLabel}>Participants:</p>
          <p style={styles.participantsList}>{participantsList}</p>
        </div>

        {isPayer && (
          <div style={styles.payerBadge}>
            👑 You created this expense
          </div>
        )}

        {/* Arc Reward Info */}
        {!userHasPaid && reward.amount > 0 && (
          <div style={{...styles.rewardBanner, borderLeft: `4px solid ${reward.color}`}}>
            {reward.label} Pay now and earn +{reward.amount} ARC tokens! 🪙
          </div>
        )}

        {/* Payment Button */}
        {!userHasPaid && !isPayer && (
          <>
            <button
              onClick={handlePayExpense}
              disabled={isPending || isConfirming || offChainPaymentPending}
              style={{
                ...styles.payButton,
                opacity: (isPending || isConfirming || offChainPaymentPending) ? 0.6 : 1,
                cursor: (isPending || isConfirming || offChainPaymentPending) ? 'not-allowed' : 'pointer',
              }}
            >
              {offChainPaymentPending && '⚡ Sending gasless notification...'}
              {isPending && '⏳ Waiting for wallet approval...'}
              {isConfirming && '⏳ Confirming payment...'}
              {!isPending && !isConfirming && !offChainPaymentPending && (
                <>
                  {nitroliteClient ? '⚡' : '💳'} Pay {Number(shareEth).toFixed(4)} ETH
                  {nitroliteClient && ' (Gasless)'}
                </>
              )}
            </button>
            
            {nitroliteClient && (
              <p style={styles.gaslessNote}>
                ⚡ Yellow Network enabled - payment notification sent off-chain first
              </p>
            )}
          </>
        )}

        {/* Already Paid Message */}
        {userHasPaid && !isPayer && (
          <div style={styles.paidMessage}>
            ✅ You've paid your share
            {reward.amount > 0 && ` - Earned ${reward.amount} ARC!`}
          </div>
        )}

        {/* Transaction Status */}
        {hash && (
          <div style={styles.txStatus}>
            <p style={{ margin: '0 0 8px 0' }}>✅ Payment transaction submitted!</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.txLink}
            >
              View on Sepolia Etherscan →
            </a>
          </div>
        )}

        {/* Debug Info (remove in production) */}
        <details style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
          <summary style={{ cursor: 'pointer' }}>Debug Info</summary>
          <div style={{ marginTop: '8px', fontFamily: 'monospace' }}>
            <p>Expense ID: {expenseId.toString()}</p>
            <p>Your Address: {currentUserAddress}</p>
            <p>Has Paid: {String(hasPaid)}</p>
            <p>Is Payer: {String(isPayer)}</p>
            <p>Amount Per Person: {amountPerPerson.toString()} wei</p>
          </div>
        </details>
      </div>

      {/* Footer */}
      <div style={styles.cardFooter}>
        <span style={styles.timestamp}>
          Created: {new Date(Number(createdAt) * 1000).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '32px',
    margin: 0,
    color: '#1a1a1a',
  },
  arcBadge: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
  },
  nitroliteStatus: {
    backgroundColor: '#fef3c7',
    border: '2px solid #f59e0b',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '24px',
    textAlign: 'center',
    fontWeight: '600',
    color: '#92400e',
  },
  emptyState: {
    maxWidth: '600px',
    margin: '100px auto',
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#f9fafb',
    borderRadius: '16px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    margin: 0,
    fontSize: '20px',
    color: '#1a1a1a',
  },
  badgeSettled: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
  },
  badgePaid: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
  },
  cardBody: {
    padding: '20px',
  },
  amountSection: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  amountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#6b7280',
  },
  amount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  amountHighlight: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0E76FD',
  },
  value: {
    fontSize: '14px',
    color: '#1a1a1a',
  },
  participantsSection: {
    marginBottom: '16px',
  },
  participantsLabel: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 8px 0',
  },
  participantsList: {
    fontSize: '14px',
    color: '#1a1a1a',
    margin: 0,
    wordBreak: 'break-all',
  },
  payerBadge: {
    backgroundColor: '#fef3c7',
    border: '2px solid #fbbf24',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400e',
    marginBottom: '16px',
    textAlign: 'center',
  },
  rewardBanner: {
    backgroundColor: '#f3f4f6',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '16px',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  payButton: {
    width: '100%',
    backgroundColor: '#0E76FD',
    color: 'white',
    border: 'none',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  gaslessNote: {
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: '8px',
  },
  paidMessage: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '16px',
    borderRadius: '12px',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '600',
  },
  txStatus: {
    backgroundColor: '#e0f2fe',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px',
    textAlign: 'center',
    border: '2px solid #0284c7',
  },
  txLink: {
    color: '#0E76FD',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
  },
  cardFooter: {
    padding: '12px 20px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  timestamp: {
    fontSize: '12px',
    color: '#6b7280',
  },
};
