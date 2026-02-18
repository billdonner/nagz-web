import { useState } from "react";
import { useAuth } from "../auth";
import { customInstance } from "../api/axios-instance";

// Dev-only credentials — only available in development builds
const DEV_FAMILY_ID = "93803dda-64e6-491c-b460-02ab3b72c465";

const DEV_USERS = [
  { name: "Andrew", role: "guardian", token: "dev:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
  { name: "Katherine", role: "guardian", token: "dev:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
  { name: "George", role: "child", token: "dev:cccccccc-cccc-cccc-cccc-cccccccccccc" },
  { name: "Teddy", role: "child", token: "dev:dddddddd-dddd-dddd-dddd-dddddddddddd" },
  { name: "Will", role: "child", token: "dev:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" },
];

function DevLogin() {
  const { login } = useAuth();

  return (
    <>
      <p className="page-hint">Sign in as a family member:</p>
      <div className="login-buttons">
        {DEV_USERS.map((u) => (
          <button
            key={u.token}
            className="login-user-btn"
            onClick={() => {
              localStorage.setItem("nagz_family_id", DEV_FAMILY_ID);
              login(u.token);
            }}
          >
            <span className="login-user-name">
              {u.name}
            </span>
            <span className="login-user-role">{u.role}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function ProdLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await customInstance<{
        access_token: string;
        user: { id: string; family_memberships?: { family_id: string }[] };
      }>({
        method: "POST",
        url: "/api/v1/auth/login",
        data: { email, password },
      });
      const familyId = resp.user.family_memberships?.[0]?.family_id;
      if (familyId) {
        localStorage.setItem("nagz_family_id", familyId);
      }
      login(resp.access_token);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="login-input"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="login-input"
      />
      {error && <p className="login-error">{error}</p>}
      <button type="submit" className="login-submit-btn" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

export default function Login() {
  return (
    <div className="login-container">
      <h1>Nagz</h1>
      <p>Family nagging system</p>
      {import.meta.env.DEV ? <DevLogin /> : <ProdLogin />}
    </div>
  );
}
