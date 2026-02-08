import { useAccount } from 'wagmi';
import ConnectButton from './components/Connect';
import Profile from './components/profile';
import Home from './pages/Home';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CreateExpensePage from './pages/CreateExpense';
import ExpenseList from './pages/ExpenseList'; 
import LinkContracts from './components/LinkContracts';

function App() {
  const { isConnected } = useAccount();
  return (
    <div style={styles.app}>
      <BrowserRouter>
      {!isConnected ? (
        // LANDING SCREEN
        <div style={styles.landing}>
          <h1 style={styles.title}>onTime</h1>
          <p style={styles.tagline}>Painless payments, rewarded.</p>
          <ConnectButton />
        </div>
      ) : (
        // AFTER CONNECT
       <>
       <Profile/>
       <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/createexpense" element={<CreateExpensePage />} />
              <Route path="/expenses" element={<ExpenseList />} />
       </Routes>
       </>
      )}

</BrowserRouter>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  landing: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',

  },
  title: {
    fontSize: '108px',
    fontWeight: '800',
  },
  tagline: {
    fontSize: '18px',
    color: '#555',
    marginBottom: '20px',
  },
};

export default App;