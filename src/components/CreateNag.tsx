import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { customInstance } from "../api/axios-instance";
import axios from "axios";
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
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/">Family</Link>
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
        description: description.trim() || undefined,
      };
      await customInstance<NagResponse>({
        url: "/api/v1/nags",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: body,
      });
      navigate("/nags");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.detail ?? err.response?.data?.error?.message;
        setError(msg ?? "Failed to create nag.");
      } else {
        setError("Failed to create nag.");
      }
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="header">
        <h2>Create Nagz</h2>
        <button className="link-button" onClick={() => navigate(-1)}>Cancel</button>
      </div>

      <p className="page-hint">
        Choose who to nag, pick a category, add an optional description of what
        needs to be done, and set when it's due. Only guardians can create nagz.
      </p>

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
          {submitting ? "Creating..." : "Create Nagz"}
        </button>
      </form>
    </div>
  );
}
