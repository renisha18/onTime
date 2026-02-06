import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { parseEther, formatEther } from 'viem';
import { getBillSplitContract, getArcTokenContract } from '../utils/contracts';
// Import Nitrolite helper
import { initializeNitrolite, createSession, sendPayment, closeSession } from '../utils/nitroliteHelper';

export default function CreateExpensePage() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  
  const [totalAmount, setTotalAmount] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState(['']);
  
  // Nitrolite/Yellow Network state
  const [nitroliteClient, setNitroliteClient] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [paymentTracking, setPaymentTracking] = useState({});
  const [expenseCreationTime, setExpenseCreationTime] = useState(null);

  // Contract interaction
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash 
  });

  // Read Arc balance
  const { data: arcBalance } = useReadContract({
    ...getArcTokenContract(),
    functionName: 'balanceOf',
    args: [address],
  });

  // Initialize Nitrolite client when wallet connects
  useEffect(() => {
    console.log('🔄 Wallet connection changed:', { isConnected, address });
    if (isConnected && address) {
      console.log('🟡 Wallet connected - initializing Nitrolite...');
      initializeNitroliteClient();
    } else {
      console.log('⚠️ Wallet not connected - skipping Nitrolite initialization');
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      navigate('/');
    }
  }, [isConnected, navigate]);

  useEffect(() => {
    if (error) {
      console.error('Transaction error:', error);
      alert('Error: ' + error.message);
    }
  }, [error]);

  useEffect(() => {
    if (isSuccess && sessionId) {
      // Don't navigate immediately, wait for payments to be tracked
      const timer = setTimeout(() => {
        closeNitroliteSession();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, navigate, sessionId]);

  // Initialize Nitrolite Client using helper
  const initializeNitroliteClient = async () => {
    console.log('🔄 [CreateExpense] Initializing Nitrolite...');
    const client = await initializeNitrolite(address);
    
    if (client) {
      setNitroliteClient(client);
      console.log('✅ [CreateExpense] Nitrolite ready!');
    } else {
      setNitroliteClient(null);
      console.log('⚠️ [CreateExpense] Nitrolite initialization failed - continuing without it');
    }
  };

  // Create Application Session using Nitrolite helper
  const openNitroliteSession = async () => {
    console.log('🔄 [CreateExpense] Opening session...');
    console.log('🔄 [CreateExpense] Client available:', !!nitroliteClient);
    
    if (!nitroliteClient) {
      console.warn('⚠️ [CreateExpense] Nitrolite client not initialized');
      return null;
    }

    const sessionId = await createSession(nitroliteClient, {
      purpose: 'expense-payment',
      description: description,
      totalAmount: totalAmount,
      createdBy: address,
    });

    if (sessionId) {
      setSessionId(sessionId);
      setSessionActive(true);
      setExpenseCreationTime(Date.now());
      console.log('✅ [CreateExpense] Session opened:', sessionId);
    }

    return sessionId;
  };

  // Track payment in Nitrolite session using helper
  const trackPayment = async (participantAddress, amount, paymentTime) => {
    if (!nitroliteClient || !sessionId) {
      console.warn('⚠️ [CreateExpense] No active Nitrolite session for payment tracking');
      return;
    }

    console.log(`🔄 [CreateExpense] Tracking payment for ${participantAddress}...`);

    const payment = await sendPayment(nitroliteClient, sessionId, {
      from: address,
      to: participantAddress,
      amount: amount.toString(),
      timestamp: paymentTime,
      expenseDescription: description,
    });

    if (!payment) {
      console.warn('⚠️ [CreateExpense] Payment tracking failed');
      return;
    }

    // Calculate Arc rewards based on payment timing
    const timeDiff = (paymentTime - expenseCreationTime) / 1000; // in seconds
    let arcReward = 0;
    
    if (timeDiff < 60) { // Instant payment (< 1 minute)
      arcReward = 2;
    } else if (timeDiff < 86400) { // Within 24 hours
      arcReward = 1;
    }

    // Update payment tracking
    setPaymentTracking(prev => ({
      ...prev,
      [participantAddress]: {
        paid: true,
        amount: amount.toString(),
        time: paymentTime,
        arcReward: arcReward,
        offChainMsgId: payment.messageId || payment.id || 'tracked',
      }
    }));

    console.log(`✅ [CreateExpense] Payment tracked. Arc reward: ${arcReward}`);
    return payment;
  };

  // Close Nitrolite session using helper
  const closeNitroliteSession = async () => {
    if (!nitroliteClient || !sessionId) {
      console.warn('⚠️ [CreateExpense] No active Nitrolite session to close');
      navigate('/');
      return;
    }

    console.log('🔄 [CreateExpense] Closing session...');

    const success = await closeSession(nitroliteClient, sessionId);

    if (success) {
      // Award Arc tokens based on payment tracking
      await awardArcTokens();
      console.log('🎉 [CreateExpense] Arc tokens awarded!');
    }

    setSessionActive(false);
    setSessionId(null);
    
    console.log('✅ [CreateExpense] Session cleanup complete');
    
    // Navigate after settlement
    setTimeout(() => navigate('/'), 2000);
  };

  // Award Arc tokens to participants based on payment timing
  const awardArcTokens = async () => {
    try {
      const arcContract = getArcTokenContract();
      
      for (const [participant, tracking] of Object.entries(paymentTracking)) {
        if (tracking.arcReward > 0) {
          console.log(`🪙 Awarding ${tracking.arcReward} ARC to ${participant}`);
          
          // This would be a contract call to mint/transfer Arc tokens
          await writeContract({
            address: arcContract.address,
            abi: arcContract.abi,
            functionName: 'mint', // or 'transfer' depending on your contract
            args: [participant, parseEther(tracking.arcReward.toString())],
          });
        }
      }
    } catch (err) {
      console.error('❌ Failed to award Arc tokens:', err);
    }
  };

  const addParticipant = () => {
    setParticipants([...participants, '']);
  };

  const updateParticipant = (index, value) => {
    const updated = [...participants];
    updated[index] = value;
    setParticipants(updated);
  };

  const removeParticipant = (index) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('=== CREATE EXPENSE WITH YELLOW DEBUG ===');
    console.log('Connected:', isConnected);
    console.log('Address:', address);
    console.log('Description:', description);
    console.log('Amount:', totalAmount);

    if (!isConnected || !address) {
      alert('Please connect wallet first');
      return;
    }

    if (!description.trim()) {
      alert('Please enter description');
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      alert('Please enter valid amount');
      return;
    }

    const validParticipants = participants.filter(p => p.trim());
    
    if (validParticipants.length === 0) {
      alert('Please add at least one participant');
      return;
    }

    const allParticipants = [address, ...validParticipants];
    console.log('All participants:', allParticipants);

    try {
      // Step 1: Create Nitrolite session for gasless off-chain messaging
      const newSessionId = await openNitroliteSession();
      
      if (!newSessionId) {
        console.warn('⚠️ Proceeding without Nitrolite session');
      }

      // Step 2: Create expense on-chain (or track in Yellow session)
      const contract = getBillSplitContract();
      console.log('Contract config:', contract);
      
      const amountWei = parseEther(totalAmount);
      console.log('Amount in wei:', amountWei.toString());

      await writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: 'createExpense',
        args: [
          allParticipants,
          amountWei,
          description,
        ],
      });

      console.log('✅ Expense created, Nitrolite session active for payments');
      
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error: ' + (err.message || 'Failed to create expense'));
      
      // Close session on error
      if (sessionId) {
        await closeNitroliteSession();
      }
    }
  };

  // Simulate payment (for testing)
  const simulatePayment = async (participantAddress) => {
    const perPersonAmount = parseEther(totalAmount) / BigInt(participants.filter(p => p.trim()).length + 1);
    await trackPayment(participantAddress, perPersonAmount, Date.now());
  };

  const numPeople = participants.filter(p => p.trim()).length + 1;
  const perPerson = totalAmount ? (parseFloat(totalAmount) / numPeople).toFixed(4) : '0.0000';
  const arcTokens = arcBalance ? (Number(arcBalance) / 1e18).toFixed(2) : '0.00';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Create New Expense</h1>

      {/* Yellow Session Status */}
      {sessionActive && (
        <div style={styles.yellowBanner}>
          <span style={styles.yellowIcon}>⚡</span>
          <div>
            <p style={styles.yellowLabel}>Yellow Session Active</p>
            <p style={styles.yellowStatus}>Gasless payments enabled • Session ID: {sessionId?.slice(0, 8)}...</p>
          </div>
        </div>
      )}

      {/* Arc Balance Badge */}
      <div style={styles.arcBanner}>
        <span style={styles.arcIcon}>🪙</span>
        <div>
          <p style={styles.arcLabel}>Your Arc Rewards</p>
          <p style={styles.arcAmount}>{arcTokens} ARC</p>
        </div>
        <div style={styles.arcInfo}>
          <p style={{ fontSize: '11px', margin: 0 }}>⚡ Pay instantly: +2 ARC</p>
          <p style={{ fontSize: '11px', margin: 0 }}>🔥 Pay within 24h: +1 ARC</p>
        </div>
      </div>
      
      <div style={styles.form}>
        {/* Description */}
        <div style={styles.field}>
          <label style={styles.label}>What's this for?</label>
          <input
            type="text"
            placeholder="e.g., Dinner at Olive Garden"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        {/* Total Amount */}
        <div style={styles.field}>
          <label style={styles.label}>Total Amount (ETH)</label>
          <input
            type="number"
            step="0.0001"
            placeholder="0.001"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            style={styles.input}
            required
          />
          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
            Minimum: 0.001 ETH (~$2.50)
          </p>
        </div>

        {/* Participants */}
        <div style={styles.field}>
          <label style={styles.label}>Split with (ENS names or addresses)</label>
          
          <div style={styles.participantRow}>
            <input
              type="text"
              value={`You (${address?.slice(0, 6)}...${address?.slice(-4)})`}
              disabled
              style={{ ...styles.input, backgroundColor: '#f0f0f0' }}
            />
          </div>

          {participants.map((p, i) => (
            <div key={i} style={styles.participantRow}>
              <input
                type="text"
                placeholder="alice.eth or 0x742d..."
                value={p}
                onChange={(e) => updateParticipant(i, e.target.value)}
                style={styles.input}
              />
              <button
                type="button"
                onClick={() => removeParticipant(i)}
                style={styles.removeBtn}
              >
                ✕
              </button>
              {/* Show payment status if tracked */}
              {paymentTracking[p] && (
                <span style={styles.paidBadge}>
                  ✅ +{paymentTracking[p].arcReward} ARC
                </span>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addParticipant}
            style={styles.addBtn}
          >
            + Add Person
          </button>
        </div>

        {/* Summary */}
        <div style={styles.summary}>
          <h3 style={{ margin: '0 0 12px 0' }}>Split Summary</h3>
          <p>Total: <strong>{totalAmount || '0.0000'} ETH</strong></p>
          <p>Split between: <strong>{numPeople} people</strong></p>
          <p>Each person owes: <strong>{perPerson} ETH</strong></p>
          {sessionActive && (
            <p style={{ color: '#059669', fontWeight: '600', marginTop: '8px' }}>
              ⚡ Gas-free payments via Yellow Network
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          style={{
            ...styles.submitBtn,
            opacity: (isPending || isConfirming) ? 0.6 : 1,
            cursor: (isPending || isConfirming) ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSubmit}
          disabled={isPending || isConfirming}
        >
          {isPending && '⏳ Waiting for wallet approval...'}
          {isConfirming && '⏳ Confirming transaction...'}
          {!isPending && !isConfirming && '🚀 Create Expense (Gas-Free)'}
        </button>

        {/* Transaction Status */}
        {hash && (
          <div style={styles.status}>
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

        {isSuccess && sessionActive && (
          <div style={styles.success}>
            <p style={{ margin: '0 0 8px 0', fontSize: '20px' }}>🎉 Expense created!</p>
            <p style={{ margin: 0 }}>Yellow session active. Payments will be tracked off-chain.</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>Session will auto-settle when complete...</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    fontSize: '32px',
    marginBottom: '16px',
  },
  yellowBanner: {
    backgroundColor: '#FEF3C7',
    border: '2px solid #F59E0B',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  yellowIcon: {
    fontSize: '32px',
  },
  yellowLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400E',
    margin: '0 0 4px 0',
  },
  yellowStatus: {
    fontSize: '12px',
    color: '#92400E',
    margin: 0,
  },
  arcBanner: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    borderRadius: '16px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    color: 'white',
  },
  arcIcon: {
    fontSize: '40px',
  },
  arcLabel: {
    fontSize: '12px',
    opacity: 0.9,
    margin: '0 0 4px 0',
  },
  arcAmount: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
  },
  arcInfo: {
    marginLeft: 'auto',
    textAlign: 'right',
    opacity: 0.9,
  },
  form: {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '16px',
  },
  participantRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  removeBtn: {
    backgroundColor: '#EF4444',
    color: 'white',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    flexShrink: 0,
  },
  paidBadge: {
    backgroundColor: '#10B981',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  addBtn: {
    backgroundColor: '#E0E7FF',
    color: '#0E76FD',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  summary: {
    backgroundColor: '#F0F9FF',
    padding: '20px',
    borderRadius: '12px',
    border: '2px dashed #0E76FD',
  },
  submitBtn: {
    backgroundColor: '#0E76FD',
    color: 'white',
    border: 'none',
    padding: '18px',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  status: {
    backgroundColor: '#E0F2FE',
    padding: '16px',
    borderRadius: '12px',
    textAlign: 'center',
    border: '2px solid #0284C7',
  },
  success: {
    backgroundColor: '#D1FAE5',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    color: '#065F46',
    border: '2px solid #10B981',
  },
  link: {
    color: '#0E76FD',
    textDecoration: 'none',
    fontWeight: '600',
  },
};
