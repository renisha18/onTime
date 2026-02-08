import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { parseEther, formatEther } from 'viem';
import { getBillSplitContract, getArcTokenContract } from '../utils/contracts';
import { initializeNitrolite, createSession, sendPayment, closeSession } from '../utils/nitroliteHelper';
import './CreateExpense.css';

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
    <div className="create-container">
  <h1 className="create-title">Create New Expense</h1>

  {/* Yellow Session Status */}
  {sessionActive && (
    <div className="dark-card session-card">
      <span className="icon-yellow">⚡</span>
      <div>
        <p className="session-label">Yellow Session Active</p>
        <p className="session-status">
          Gasless payments enabled • Session ID: {sessionId?.slice(0, 8)}...
        </p>
      </div>
    </div>
  )}

  {/* Arc Balance */}
  <div className="arc-banner">
    <span className="arc-icon">🪙</span>
    <div>
      <p className="arc-label">Your Arc Rewards</p>
      <p className="arc-amount">{arcTokens} ARC</p>
    </div>
    <div className="arc-info">
      <p>⚡ Pay instantly: +2 ARC</p>
      <p>🔥 Pay within 24h: +1 ARC</p>
    </div>
  </div>

  <div className="dark-card form-card">
    {/* Description */}
    <div className="form-field">
      <label>What’s this for?</label>
      <input
        className="dark-input"
        placeholder="Enter expense details"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
    </div>

    {/* Amount */}
    <div className="form-field">
      <label>Total Amount (ETH)</label>
      <input
        className="dark-input"
        type="number"
        step="0.0001"
        placeholder="Enter the amount"
        value={totalAmount}
        onChange={(e) => setTotalAmount(e.target.value)}
        required
      />
      <p className="hint-text">Minimum: 0.001 ETH (~$2.50)</p>
    </div>

    {/* Participants */}
    <div className="form-field">
      <label>Split with</label>

      <div className="participant-row">
        <input
          className="dark-input"
          disabled
          value={`You (${address?.slice(0, 6)}...${address?.slice(-4)})`}
        />
      </div>

      {participants.map((p, i) => (
        <div key={i} className="participant-row">
          <input
            className="dark-input"
            placeholder="Enter your friends name"
            value={p}
            onChange={(e) => updateParticipant(i, e.target.value)}
          />
          <button className="remove-btn" onClick={() => removeParticipant(i)}>✕</button>
          {paymentTracking[p] && (
            <span className="paid-badge">
              ✅ +{paymentTracking[p].arcReward} ARC
            </span>
          )}
        </div>
      ))}

      <button className="add-btn" onClick={addParticipant}>+ Add Person</button>
    </div>

    {/* Summary */}
    <div className="summary-box">
      <h3>Split Summary</h3>
      <p>Total: <strong>{totalAmount || '0.0000'} ETH</strong></p>
      <p>People: <strong>{numPeople}</strong></p>
      <p>Each owes: <strong>{perPerson} ETH</strong></p>
      {sessionActive && <p className="success-text">⚡ Gas-free via Yellow</p>}
    </div>

    {/* Submit */}
    <button
      className={`primary-btn ${(isPending || isConfirming) && 'disabled'}`}
      onClick={handleSubmit}
      disabled={isPending || isConfirming}
    >
      {isPending && '⏳ Wallet approval...'}
      {isConfirming && '⏳ Confirming...'}
      {!isPending && !isConfirming && '🚀 Create Expense (Gas-Free)'}
    </button>

    {/* Success */}
    {isSuccess && (
      <div className="success-box">
        <p className="success-title">🎉 Expense created!</p>
        <p>Yellow session active. Payments tracked off-chain.</p>
      </div>
    )}
  </div>
</div>
  );
}

