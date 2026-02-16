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

      <div className="login-help">
        <p>Dev tokens for the Donner family:</p>
        <table className="token-table">
          <tbody>
            <tr><td>Andrew</td><td className="role-label">guardian</td><td><code>dev:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa</code></td></tr>
            <tr><td>Katherine</td><td className="role-label">guardian</td><td><code>dev:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb</code></td></tr>
            <tr><td>George</td><td className="role-label">child</td><td><code>dev:cccccccc-cccc-cccc-cccc-cccccccccccc</code></td></tr>
            <tr><td>Teddy</td><td className="role-label">child</td><td><code>dev:dddddddd-dddd-dddd-dddd-dddddddddddd</code></td></tr>
            <tr><td>Will</td><td className="role-label">child</td><td><code>dev:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee</code></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
