import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { customInstance } from "../api/axios-instance";
import { NagCategory, DoneDefinition } from "../api/model";
import { useMembers } from "../members";
import type { NagCreate, NagResponse } from "../api/model";

export default function CreateNag() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const familyId = localStorage.getItem("nagz_family_id");
  const { members } = useMembers();

  const [recipientId, setRecipientId] = useState(
    searchParams.get("recipient") ?? ""
  );
  const [category, setCategory] = useState<string>(NagCategory.chores);
  const [doneDefinition, setDoneDefinition] = useState<string>(
    DoneDefinition.ack_only
  );
  const [dueAt, setDueAt] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/">Go to dashboard</Link>
      </p>
    );
  }

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
      };
      await customInstance<NagResponse>({
        url: "/api/v1/nags",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: body,
      });
      navigate("/nags");
    } catch {
      setError("Failed to create nag.");
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="header">
        <h2>Create Nag</h2>
        <Link to="/" className="btn-secondary">
          Back
        </Link>
      </div>

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
          Due Date & Time
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Nag"}
        </button>
      </form>
    </div>
  );
}
