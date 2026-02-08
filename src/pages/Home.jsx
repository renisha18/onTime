import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-intro">
        <h1> Lets make spillting money easier! </h1>
        <p>
          Create shared expenses, split bills fairly, and track who owes what —
          all in one place. Add an expense, assign participants, and let the app
          handle the math.
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