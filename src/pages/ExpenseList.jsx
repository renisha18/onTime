import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { getBillSplitContract } from "../utils/contracts";
import { initializeNitrolite, sendPayment } from "../utils/Nitrolitehelper";
import "./ExpenseList.css";

export default function ExpenseList() {
  const { address, isConnected } = useAccount();
  const [nitroliteClient, setNitroliteClient] = useState(null);

  useEffect(() => {
    if (isConnected && address) {
      initializeNitrolite(address).then(setNitroliteClient);
    }
  }, [isConnected, address]);

  const { data: expenseIds, refetch } = useReadContract({
    ...getBillSplitContract(),
    functionName: "getUserExpenses",
    args: [address],
  });

  const { data: rewards } = useReadContract({
    ...getBillSplitContract(),
    functionName: "getUserRewards",
    args: [address],
  });

  const arcRewards = rewards ? (Number(rewards) / 1e18).toFixed(2) : "0.00";

  if (!expenseIds || expenseIds.length === 0) {
    return (
      <div className="expense-container">
        <div className="empty-state">
          <h2>No expenses yet</h2>
          <p>Create an expense to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expense-container">
      <div className="expense-header">
        <h1 className="expense-title">Your Expenses</h1>
        <div className="arc-badge">
          🪙 Total Arc Rewards: <strong>{arcRewards} ARC</strong>
        </div>
      </div>

      {nitroliteClient && (
        <div className="session-status">
          ⚡ Gasless payments enabled via Yellow Network
        </div>
      )}

      <div className="expense-list">
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

function ExpenseCard({
  expenseId,
  currentUserAddress,
  nitroliteClient,
  onPaymentComplete,
}) {
  const [isPaying, setIsPaying] = useState(false);

  const { data: expense, refetch } = useReadContract({
    ...getBillSplitContract(),
    functionName: "getExpense",
    args: [expenseId],
  });

  const { data: hasPaid } = useReadContract({
    ...getBillSplitContract(),
    functionName: "hasPaid",
    args: [expenseId, currentUserAddress],
  });

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      setIsPaying(false);
      refetch();
      onPaymentComplete?.();
    }
  }, [isSuccess]);

  if (!expense) return null;

  const [
    ,
    payer,
    description,
    totalAmount,
    amountPerPerson,
    participants,
    createdAt,
    isSettled,
  ] = expense;

  const totalEth = formatEther(totalAmount);
  const shareEth = formatEther(amountPerPerson);
  const isPayer =
    payer.toLowerCase() === currentUserAddress?.toLowerCase();
  const userHasPaid = hasPaid || isPayer;

  const handlePay = async () => {
    if (userHasPaid || isPaying) return;
    setIsPaying(true);

    try {
      if (nitroliteClient) {
        await sendPayment(nitroliteClient, expenseId.toString(), {
          from: currentUserAddress,
          amount: amountPerPerson.toString(),
        });
      }

      await writeContract({
        ...getBillSplitContract(),
        functionName: "settleExpense",
        args: [expenseId],
        value: amountPerPerson,
      });
    } catch {
      setIsPaying(false);
    }
  };

  return (
    <div className="expense-card">
      <div className="expense-card-header">
        <h3 className="expense-card-title">{description}</h3>

        {isSettled ? (
          <span className="badge badge-settled">✅ Settled</span>
        ) : userHasPaid ? (
          <span className="badge badge-paid">✅ Paid</span>
        ) : (
          <span className="badge badge-pending">⏳ Pending</span>
        )}
      </div>

      <div className="expense-card-body">
        <div className="amount-box">
          <div className="amount-row">
            <span>Total</span>
            <span>{Number(totalEth).toFixed(4)} ETH</span>
          </div>

          <div className="amount-row highlight">
            <span>Your Share</span>
            <span>{Number(shareEth).toFixed(4)} ETH</span>
          </div>

          <div className="amount-row">
            <span>Participants</span>
            <span>{participants.length}</span>
          </div>
        </div>

        {!userHasPaid && !isPayer && (
          <button
            className="pay-btn"
            onClick={handlePay}
            disabled={isLoading || isPaying}
          >
            {isLoading ? "⏳ Confirming..." : `Pay ${shareEth} ETH`}
          </button>
        )}

        {userHasPaid && !isPayer && (
          <div className="paid-message">✅ You’ve paid</div>
        )}

        {hash && (
          <div className="tx-status">
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan →
            </a>
          </div>
        )}
      </div>

      <div className="expense-card-footer">
        Created: {new Date(Number(createdAt) * 1000).toLocaleString()}
      </div>
    </div>
  );
}