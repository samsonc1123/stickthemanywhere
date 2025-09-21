import { useLocation } from "wouter";

export function NavigationExample() {
  const [, setLocation] = useLocation(); // Wouter's equivalent to useNavigate

  return (
    <button
      onClick={() => setLocation("/gaming")}
      style={{ backgroundColor: "blue" }}
    >
      Gaming
    </button>
  );
}