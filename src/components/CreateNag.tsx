import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import { NagCategory, DoneDefinition } from "../api/model";
import { useMembers } from "../members";
import { UUID_DISPLAY_LENGTH } from "../nag-utils";
import type { NagCreate, NagResponse } from "../api/model";

interface TrustedChild {
  user_id: string;
  display_name: string | null;
  family_id: string;
  family_name: string;
  connection_id: string;
}

interface ConnectionItem {
  id: string;
  trusted: boolean;
}

interface PaginatedConnections {
  items: ConnectionItem[];
  total: number;
}

interface CreateNagModalProps {
  familyId: string;
  recipientId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateNagModal({
  familyId,
  recipientId: initialRecipient,
  onClose,
  onCreated,
}: CreateNagModalProps) {
  const { members } = useMembers();

  const [recipientId, setRecipientId] = useState(initialRecipient ?? "");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(NagCategory.chores);
  const [doneDefinition, setDoneDefinition] = useState<string>(
    DoneDefinition.ack_only
  );
  const [dueAt, setDueAt] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trustedChildren, setTrustedChildren] = useState<TrustedChild[]>([]);

  // Load trusted children from active trusted connections
  useEffect(() => {
    (async () => {
      try {
        const connResp = await customInstance<PaginatedConnections>({
          url: "/api/v1/connections",
          method: "GET",
          params: { status: "active" },
        });
        const trustedConns = (connResp.items ?? []).filter((c) => c.trusted);
        const allChildren: TrustedChild[] = [];
        for (const conn of trustedConns) {
          try {
            const children = await customInstance<TrustedChild[]>({
              url: `/api/v1/connections/${conn.id}/children`,
              method: "GET",
            });
            allChildren.push(...children);
          } catch {
            // Skip connections that fail
          }
        }
        setTrustedChildren(allChildren);
      } catch {
        // Non-critical — just skip trusted children
      }
    })();
  }, []);

  const handleRecipientChange = (value: string) => {
    setRecipientId(value);
    // Check if the selected recipient is a trusted child
    const trustedChild = trustedChildren.find((tc) => tc.user_id === value);
    setSelectedConnectionId(trustedChild ? trustedChild.connection_id : null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipientId || !dueAt) {
      setError("Recipient and due date are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body: NagCreate = selectedConnectionId
        ? {
            connection_id: selectedConnectionId,
            recipient_id: recipientId,
            category: category as NagCreate["category"],
            done_definition: doneDefinition as NagCreate["done_definition"],
            due_at: new Date(dueAt).toISOString(),
            description: description.trim() || undefined,
            recurrence: (recurrence || undefined) as NagCreate["recurrence"],
          }
        : {
            family_id: familyId,
            recipient_id: recipientId,
            category: category as NagCreate["category"],
            done_definition: doneDefinition as NagCreate["done_definition"],
            due_at: new Date(dueAt).toISOString(),
            description: description.trim() || undefined,
            recurrence: (recurrence || undefined) as NagCreate["recurrence"],
          };
      await customInstance<NagResponse>({
        url: "/api/v1/nags",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: body,
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to create nag."));
    }
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create Nagz</h3>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Recipient
            <select
              value={recipientId}
              onChange={(e) => handleRecipientChange(e.target.value)}
              required
            >
              <option value="">-- select a recipient --</option>
              {members.length > 0 && (
                <optgroup label="Family Members">
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH)} ({m.role})
                    </option>
                  ))}
                </optgroup>
              )}
              {trustedChildren.length > 0 && (
                <optgroup label="Trusted Connections' Kids">
                  {trustedChildren.map((tc) => (
                    <option key={`${tc.connection_id}-${tc.user_id}`} value={tc.user_id}>
                      {tc.display_name ?? tc.user_id.slice(0, UUID_DISPLAY_LENGTH)} ({tc.family_name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.values(NagCategory).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Done Definition
            <select
              value={doneDefinition}
              onChange={(e) => setDoneDefinition(e.target.value)}
            >
              {Object.values(DoneDefinition).map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            Description
            <textarea
              placeholder="What needs to be done? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>

          <label>
            Repeat
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="">None (one-time)</option>
              <option value="every_5_minutes">Every 5 min</option>
              <option value="every_15_minutes">Every 15 min</option>
              <option value="every_30_minutes">Every 30 min</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label>
            Due Date & Time
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="card-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Nagz"}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Route-based wrapper for direct /create-nag navigation

export default function CreateNag() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const familyId = localStorage.getItem("nagz_family_id");

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/">Family</Link>
      </p>
    );
  }

  return (
    <CreateNagModal
      familyId={familyId}
      recipientId={searchParams.get("recipient") ?? undefined}
      onClose={() => navigate(-1)}
      onCreated={() => navigate("/nags")}
    />
  );
}
