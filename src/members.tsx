import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { customInstance } from "./api/axios-instance";

export interface Member {
  user_id: string;
  display_name: string | null;
  family_id: string;
  role: "guardian" | "child";
  status: string;
  joined_at: string;
}

interface MembersCtx {
  members: Member[];
  nameMap: Record<string, string>;
  getName: (userId: string) => string;
  loading: boolean;
  reload: () => void;
}

const MembersContext = createContext<MembersCtx>({
  members: [],
  nameMap: {},
  getName: (id) => id.slice(0, 8) + "...",
  loading: true,
  reload: () => {},
});

export function MembersProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const familyId = localStorage.getItem("nagz_family_id");
    if (!familyId) {
      setLoading(false);
      return;
    }
    try {
      const data = await customInstance<Member[]>({
        url: `/api/v1/families/${familyId}/members`,
        method: "GET",
      });
      setMembers(data);
      const map: Record<string, string> = {};
      for (const m of data) {
        map[m.user_id] = m.display_name ?? m.user_id.slice(0, 8);
      }
      setNameMap(map);
    } catch {
      // ignore — will show UUIDs as fallback
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getName = useCallback(
    (userId: string) => nameMap[userId] ?? userId.slice(0, 8) + "...",
    [nameMap]
  );

  return (
    <MembersContext.Provider
      value={{ members, nameMap, getName, loading, reload: load }}
    >
      {children}
    </MembersContext.Provider>
  );
}

export const useMembers = () => useContext(MembersContext);
