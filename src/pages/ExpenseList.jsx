import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { getBillSplitContract } from '../utils/contracts';
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
      <h1 style={styles.title}>Your Expenses</h1>
      
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
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash 
  });

  // Handle successful payment
  if (isSuccess && isPaying) {
    setIsPaying(false);
    refetchExpense();
    refetchPaymentStatus();
    onPaymentComplete?.();
  }

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
    if (timeDiff < 60) return { amount: 2, label: '⚡ Instant', color: '#10b981' };
    if (timeDiff < 86400) return { amount: 1, label: '🔥 Fast', color: '#f59e0b' };
    return { amount: 0, label: '', color: '' };
  };

  const reward = getPaymentReward();

  // Handle off-chain payment notification via Nitrolite
  const handleOffChainPayment = async () => {
    if (!nitroliteClient) {
      console.warn('⚠️ [ExpenseCard] Nitrolite not available, use regular payment');
      return false;
    }

    try {
      console.log('⚡ [ExpenseCard] Sending off-chain payment notification...');
      setOffChainPaymentPending(true);

      // Send payment notification off-chain
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

  // Handle full payment (off-chain notification + on-chain settlement)
  const handlePayExpense = async () => {
    if (!currentUserAddress || userHasPaid) return;

    setIsPaying(true);

    try {
      console.log('💰 [ExpenseCard] Processing payment...');
      console.log('💰 [ExpenseCard] Expense ID:', expenseId.toString());
      console.log('💰 [ExpenseCard] Amount:', shareEth, 'ETH');

      // Step 1: Try off-chain notification first (if Nitrolite available)
      if (nitroliteClient) {
        console.log('⚡ [ExpenseCard] Attempting gasless notification...');
        await handleOffChainPayment();
      }

      // Step 2: Execute on-chain payment
      console.log('💰 [ExpenseCard] Executing on-chain payment...');
      const contract = getBillSplitContract();

      await writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: 'payExpense',
        args: [expenseId],
        value: amountPerPerson,
      });

      console.log('✅ [ExpenseCard] Payment transaction submitted');
    } catch (err) {
      console.error('❌ [ExpenseCard] Payment failed:', err);
      setIsPaying(false);
      alert('Payment failed: ' + (err.shortMessage || err.message || 'Unknown error'));
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
                ⚡ Yellow Network enabled - payment notification will be sent off-chain first
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
        {hash && isPaying && (
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
  title: {
    fontSize: '32px',
    marginBottom: '24px',
    color: '#1a1a1a',
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
