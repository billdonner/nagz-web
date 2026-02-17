import { useState, type FormEvent } from "react";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import { NagCategory, DoneDefinition } from "../api/model";
import { useMembers } from "../members";
import type { NagCreate, NagResponse } from "../api/model";

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipientId || !dueAt) {
      setError("Recipient and due date are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body: NagCreate = {
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
              onChange={(e) => setRecipientId(e.target.value)}
              required
            >
              <option value="">-- select a family member --</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? m.user_id.slice(0, 8)} ({m.role})
                </option>
              ))}
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
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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
