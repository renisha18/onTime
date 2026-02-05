import { useAccount, useReadContract } from 'wagmi';
import { getBillSplitContract } from '../utils/contracts';

export default function ExpenseList() {
  const { address } = useAccount();
  
  // Read user's expenses
  const { data: expenseIds } = useReadContract({
    ...getBillSplitContract(),
    functionName: 'getUserExpenses',
    args: [address],
  });
  
  if (!expenseIds || expenseIds.length === 0) {
    return <div>No expenses yet</div>;
  }
  
  return (
    <div>
      <h1>Your Expenses</h1>
      {expenseIds.map((id) => (
        <ExpenseCard key={id.toString()} expenseId={id} />
      ))}
    </div>
  );
}

function ExpenseCard({ expenseId }) {
  const { data: expense } = useReadContract({
    ...getBillSplitContract(),
    functionName: 'getExpense',
    args: [expenseId],
  });
  
  if (!expense) return <div>Loading...</div>;
  
  const [id, payer, description, totalAmount, amountPerPerson, participants, createdAt, isSettled] = expense;
  
  return (
    <div style={styles.card}>
      <h3>{description}</h3>
      <p>Total: {(Number(totalAmount) / 1e18).toFixed(2)} ETH</p>
      <p>Your share: {(Number(amountPerPerson) / 1e18).toFixed(2)} ETH</p>
      <p>Status: {isSettled ? '✅ Settled' : '⏳ Pending'}</p>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '16px',
  },
};