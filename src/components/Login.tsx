import { useAuth } from "../auth";

const DONNER_FAMILY_ID = "93803dda-64e6-491c-b460-02ab3b72c465";

const DEV_USERS = [
  { name: "Andrew", role: "guardian", token: "dev:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
  { name: "Katherine", role: "guardian", token: "dev:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
  { name: "George", role: "child", token: "dev:cccccccc-cccc-cccc-cccc-cccccccccccc" },
  { name: "Teddy", role: "child", token: "dev:dddddddd-dddd-dddd-dddd-dddddddddddd" },
  { name: "Will", role: "child", token: "dev:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" },
];

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="login-container">
      <h1>Nagz</h1>
      <p>Family nagging system</p>
      <p className="page-hint">Sign in as a family member:</p>
      <div className="login-buttons">
        {DEV_USERS.map((u) => (
          <button
            key={u.token}
            className="login-user-btn"
            onClick={() => {
              localStorage.setItem("nagz_family_id", DONNER_FAMILY_ID);
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
    </div>
  );
}
