import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-intro">
        <h1> Spilting money made rewarding! </h1>
        <p>
          Create shared expenses, split bills fairly, and track who owes what —
          all in one place. Add an expense, assign participants, and onTime makes sure your friends do the payment. 
        </p>
      </div>

      <div className="home-actions">
        <button onClick={() => navigate("/createexpense")}>
          Create Expense
        </button>

        <button onClick={() => navigate("/expenses")}>
          View Expense History
        </button>
      </div>
    </div>
  );
}

export default Home;