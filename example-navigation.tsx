// React Router approach (what you're referencing):
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();

<button
  onClick={() => navigate("/gaming")}
  style={{ backgroundColor: "blue" }}
>
  Gaming
</button>

// Current Wouter approach (what this project uses):
import { useLocation } from "wouter";

const [, setLocation] = useLocation();

<button
  onClick={() => setLocation("/gaming")}
  style={{ backgroundColor: "blue" }}
>
  Gaming
</button>

// Alternative Wouter approach using Link component:
import { Link } from "wouter";

<Link href="/gaming">
  <button style={{ backgroundColor: "blue" }}>
    Gaming
  </button>
</Link>