import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AXIOS_INSTANCE } from "./api/axios-instance";

/** The API version this web client was built against. */
export const CLIENT_API_VERSION = "1.0.0";

interface VersionInfo {
  serverVersion: string;
  apiVersion: string;
  minClientVersion: string;
}

type VersionStatus =
  | { kind: "unknown" }
  | { kind: "compatible" }
  | { kind: "update_recommended"; serverAPI: string; clientAPI: string }
  | { kind: "update_required"; minRequired: string; clientAPI: string }
  | { kind: "check_failed" };

interface VersionCtx {
  status: VersionStatus;
  serverInfo: VersionInfo | null;
  dismissWarning: () => void;
}

const VersionContext = createContext<VersionCtx>({
  status: { kind: "unknown" },
  serverInfo: null,
  dismissWarning: () => {},
});

function parseVersion(s: string): [number, number, number] {
  const parts = s.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function evaluate(serverAPI: string, minClient: string): VersionStatus {
  const client = parseVersion(CLIENT_API_VERSION);
  const server = parseVersion(serverAPI);
  const minimum = parseVersion(minClient);

  if (compareVersions(client, minimum) < 0) {
    return { kind: "update_required", minRequired: minClient, clientAPI: CLIENT_API_VERSION };
  }

  if (client[0] < server[0]) {
    return { kind: "update_recommended", serverAPI, clientAPI: CLIENT_API_VERSION };
  }

  return { kind: "compatible" };
}

export function VersionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VersionStatus>({ kind: "unknown" });
  const [serverInfo, setServerInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await AXIOS_INSTANCE.get<VersionInfo>("/api/v1/version");
        setServerInfo(data);
        setStatus(evaluate(data.apiVersion, data.minClientVersion));
      } catch {
        setStatus({ kind: "check_failed" });
      }
    })();
  }, []);

  return (
    <VersionContext.Provider value={{ status, serverInfo, dismissWarning: () => setDismissed(true) }}>
      {!dismissed && status.kind === "update_required" && (
        <div style={{
          background: "#dc2626",
          color: "white",
          padding: "0.75rem 1rem",
          textAlign: "center",
          fontWeight: 600,
        }}>
          Update required: this app (v{(status as { clientAPI: string }).clientAPI}) is too old.
          Server requires at least v{(status as { minRequired: string }).minRequired}. Please refresh or redeploy.
        </div>
      )}
      {!dismissed && status.kind === "update_recommended" && (
        <div style={{
          background: "#f59e0b",
          color: "white",
          padding: "0.5rem 1rem",
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1rem",
        }}>
          <span>
            Update available: server API v{(status as { serverAPI: string }).serverAPI} (you have v{(status as { clientAPI: string }).clientAPI}).
          </span>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: "rgba(255,255,255,0.3)",
              border: "none",
              color: "white",
              cursor: "pointer",
              borderRadius: "4px",
              padding: "0.25rem 0.75rem",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </VersionContext.Provider>
  );
}

export const useVersion = () => useContext(VersionContext);
