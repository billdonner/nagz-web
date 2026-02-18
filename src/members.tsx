import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { customInstance } from "./api/axios-instance";
import { useAuth } from "./auth";
import { UUID_DISPLAY_LENGTH } from "./nag-utils";

export interface Member {
  user_id: string;
  display_name: string | null;
  family_id: string;
  role: "guardian" | "participant" | "child";
  status: string;
  joined_at: string;
}

interface MembersCtx {
  members: Member[];
  familyName: string | null;
  inviteCode: string | null;
  nameMap: Record<string, string>;
  getName: (userId: string) => string;
  loading: boolean;
  reload: () => void;
}

const MembersContext = createContext<MembersCtx>({
  members: [],
  familyName: null,
  inviteCode: null,
  nameMap: {},
  getName: (id) => id.slice(0, UUID_DISPLAY_LENGTH) + "...",
  loading: true,
  reload: () => {},
});

export function MembersProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const familyId = localStorage.getItem("nagz_family_id");
    if (!familyId) {
      setLoading(false);
      return;
    }
    try {
      const [membersResp, family] = await Promise.all([
        customInstance<{ items: Member[]; total: number }>({
          url: `/api/v1/families/${familyId}/members`,
          method: "GET",
        }),
        customInstance<{ family_id: string; name: string; invite_code: string }>({
          url: `/api/v1/families/${familyId}`,
          method: "GET",
        }),
      ]);
      const data = membersResp.items ?? [];
      setMembers(data);
      setFamilyName(family.name);
      setInviteCode(family.invite_code ?? null);
      const map: Record<string, string> = {};
      for (const m of data) {
        map[m.user_id] = m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH);
      }
      setNameMap(map);
    } catch {
      // ignore — will show UUIDs as fallback
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, token]);

  const getName = useCallback(
    (userId: string) => nameMap[userId] ?? userId.slice(0, UUID_DISPLAY_LENGTH) + "...",
    [nameMap]
  );

  return (
    <MembersContext.Provider
      value={{ members, familyName, inviteCode, nameMap, getName, loading, reload: load }}
    >
      {children}
    </MembersContext.Provider>
  );
}

export const useMembers = () => useContext(MembersContext);
