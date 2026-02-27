import { useState } from "react";
import { useAuth } from "../auth";
import { customInstance, extractErrorMessage } from "../api/axios-instance";

// Dev-only credentials — tree-shaken out of production builds
const DEV_FAMILY_ID = import.meta.env.DEV
  ? "93803dda-64e6-491c-b460-02ab3b72c465"
  : "";

const DEV_USERS = import.meta.env.DEV
  ? [
      { name: "Andrew", role: "guardian", token: "dev:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      { name: "Katherine", role: "guardian", token: "dev:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
      { name: "George", role: "child", token: "dev:cccccccc-cccc-cccc-cccc-cccccccccccc" },
      { name: "Teddy", role: "child", token: "dev:dddddddd-dddd-dddd-dddd-dddddddddddd" },
      { name: "Will", role: "child", token: "dev:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" },
    ]
  : [];

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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const resp = await customInstance<{
        access_token: string;
        user: { id: string; family_memberships?: { family_id: string }[] };
      }>({
        method: "POST",
        url: "/api/v1/auth/signup",
        data: { email, password, display_name: displayName || undefined },
      });
      const familyId = resp.user.family_memberships?.[0]?.family_id;
      if (familyId) {
        localStorage.setItem("nagz_family_id", familyId);
      }
      login(resp.access_token);
    } catch {
      setError("Could not create account. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "signup") {
    return (
      <>
        <form onSubmit={handleSignup} className="login-form">
          <input
            type="text"
            placeholder="Display Name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="login-input"
          />
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
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="login-input"
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="login-toggle">
          Already have an account?{" "}
          <button className="login-link-btn" onClick={() => { setMode("login"); setError(""); }}>
            Sign In
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <form onSubmit={handleLogin} className="login-form">
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
      <p className="login-toggle">
        Don&apos;t have an account?{" "}
        <button className="login-link-btn" onClick={() => { setMode("signup"); setError(""); }}>
          Sign Up
        </button>
      </p>
    </>
  );
}

function ChildLoginForm() {
  const { login } = useAuth();
  const [familyCode, setFamilyCode] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (familyCode.length < 6) {
      setError("Family code must be at least 6 characters.");
      return;
    }
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    setLoading(true);
    try {
      const resp = await customInstance<{
        access_token: string;
        family_id?: string;
        family_role?: string;
      }>({
        method: "POST",
        url: "/api/v1/auth/child-login",
        data: { family_code: familyCode.toUpperCase(), username: username.trim(), pin },
      });
      if (resp.family_id) {
        localStorage.setItem("nagz_family_id", resp.family_id);
      }
      login(resp.access_token);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not sign in. Check your family code, username, and PIN."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <input
        type="text"
        placeholder="Family Code (e.g. NAG7K2)"
        value={familyCode}
        onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
        maxLength={8}
        required
        className="login-input"
        style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, textAlign: "center" }}
      />
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        className="login-input"
        autoCapitalize="off"
        autoCorrect="off"
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="4-Digit PIN"
        value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setPin(v);
        }}
        maxLength={4}
        required
        className="login-input"
        style={{ textAlign: "center", letterSpacing: "0.3em", fontSize: "1.2rem" }}
      />
      {error && <p className="login-error">{error}</p>}
      <button type="submit" className="login-submit-btn" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

export default function Login() {
  const [showChildLogin, setShowChildLogin] = useState(false);

  return (
    <div className="login-container">
      <img src="/nagz-icon.png" alt="Nagz" width="160" height="160" style={{ borderRadius: "32px", marginBottom: "16px" }} />
      <h1>Nagz</h1>
      <p>Family nagging system</p>
      {showChildLogin ? (
        <>
          <ChildLoginForm />
          <p className="login-toggle">
            <button className="login-link-btn" onClick={() => setShowChildLogin(false)}>
              Back to adult sign in
            </button>
          </p>
        </>
      ) : (
        <>
          {import.meta.env.DEV ? <DevLogin /> : <ProdLogin />}
          <button
            className="btn-secondary"
            onClick={() => setShowChildLogin(true)}
            style={{ marginTop: "1.5rem", maxWidth: "320px", width: "100%" }}
          >
            I'm a Kid
          </button>
        </>
      )}
    </div>
  );
}
