import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { parseEther, formatEther } from 'viem';
import { getBillSplitContract, getArcTokenContract } from '../utils/contracts';

export default function CreateExpensePage() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  
  const [totalAmount, setTotalAmount] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState(['']);

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
    if (isSuccess) {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, navigate]);

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
    console.log('=== CREATE EXPENSE DEBUG ===');
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

      console.log('writeContract executed, waiting for MetaMask...');
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error: ' + (err.message || 'Failed to create expense'));
    }
  };

  const numPeople = participants.filter(p => p.trim()).length + 1;
  const perPerson = totalAmount ? (parseFloat(totalAmount) / numPeople).toFixed(4) : '0.0000';
  const arcTokens = arcBalance ? (Number(arcBalance) / 1e18).toFixed(2) : '0.00';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Create New Expense</h1>

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
          {!isPending && !isConfirming && '🚀 Create & Share Expense'}
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

        {isSuccess && (
          <div style={styles.success}>
            <p style={{ margin: '0 0 8px 0', fontSize: '20px' }}>🎉 Expense created!</p>
            <p style={{ margin: 0 }}>Redirecting to home...</p>
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
