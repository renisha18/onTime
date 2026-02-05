import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <>
      <button onClick={() => navigate("/createexpense")}>
        Create Expense
      </button>

      <button>
        View Expense History
      </button>
    </>
  );
}

export default Home;