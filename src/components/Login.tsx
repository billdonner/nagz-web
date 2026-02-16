import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed.startsWith("dev:")) {
      setError("Token must start with 'dev:' followed by your user UUID");
      return;
    }
    login(trimmed);
  };

  return (
    <div className="login-container">
      <h1>Nagz</h1>
      <p>Family nagging system</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="dev:your-user-uuid"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign In</button>
      </form>
    </div>
  );
}
