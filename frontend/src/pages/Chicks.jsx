import React, { useEffect, useMemo, useState } from "react";
import { flockApi } from "../services/api";
import { decorateFlocksWithLabels, getTodayISO, formatIndiaDate } from "../utils/helpers";

const today = getTodayISO();

export default function Chicks() {
  const [flocks, setFlocks] = useState([]);
  const [form, setForm] = useState({ start_date: today, totalChicks: "", pricePerChick: "" });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingFlock, setEditingFlock] = useState(null);

  const batchesCount = useMemo(() => flocks.length, [flocks]);
  const hasActiveBatch = useMemo(() => flocks.some((f) => f.status === "active"), [flocks]);

  const fetchFlocks = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await flockApi.list();
      const decorated = decorateFlocksWithLabels(data);
      setFlocks(decorated);
      return decorated;
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to load flocks");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlocks();
  }, []);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!editingFlock && hasActiveBatch) {
      setError("Close the active batch before creating a new one.");
      return;
    }

    if (!form.start_date || new Date(form.start_date) > new Date()) {
      setError("Date must be today or earlier.");
      return;
    }
        if (!form.totalChicks || Number(form.totalChicks) <= 0) {
      setError("Total chicks must be greater than zero.");
      return;
    }
        if (!form.pricePerChick || Number(form.pricePerChick) <= 0) {
          setError("Price per chick must be greater than zero.");
          return;
        }

    setSubmitting(true);
    try {
      const payload = {
        start_date: form.start_date,
        totalChicks: Number(form.totalChicks),
        pricePerChick: Number(form.pricePerChick),
      };

      if (editingFlock) {
        await flockApi.update(editingFlock._id, payload);
        await fetchFlocks();
        setSuccess(`${editingFlock.displayLabel || "Batch"} updated.`);
        setEditingFlock(null);
      } else {
        await flockApi.create(payload);
        const updated = await fetchFlocks();
        const latestLabel = updated[0]?.displayLabel || "New batch";
        setSuccess(`${latestLabel} created.`);
      }

      setForm({ start_date: today, totalChicks: "", pricePerChick: "" });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to save batch");
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (flock) => {
    if (flock.status !== "active") {
      setError("Closed batches cannot be edited.");
      setSuccess("");
      return;
    }
    setEditingFlock(flock);
    setForm({
      start_date: formatIndiaDate(flock.start_date) || today,
      totalChicks: flock.totalChicks?.toString() || "",
      pricePerChick: flock.pricePerChick?.toString() || "",
    });
    setSuccess("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingFlock(null);
    setForm({ start_date: today, totalChicks: "", pricePerChick: "" });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Chicks / Batches</h1>
          <p>Track flock intake by date. {batchesCount} batch(es) recorded.</p>
        </div>
        <button onClick={fetchFlocks} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="card">
        <h2>Add new batch</h2>
        <form className="grid-2" onSubmit={onSubmit}>
          <label>
            <span>Start date</span>
            <input
              type="date"
              name="start_date"
              max={today}
              value={form.start_date}
              onChange={onChange}
            />
          </label>
          <label>
            <span>Total chicks</span>
            <input
              type="number"
              name="totalChicks"
              min="1"
              value={form.totalChicks}
              onChange={onChange}
            />
          </label>
          <label>
            <span>Price per chick</span>
            <input
              type="number"
              name="pricePerChick"
              min="0"
              step="0.01"
              value={form.pricePerChick}
              onChange={onChange}
            />
          </label>
          <div className="grid-full" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="submit" disabled={submitting || (!editingFlock && hasActiveBatch)}>
              {submitting ? "Saving..." : editingFlock ? "Update batch" : "Create batch"}
            </button>
            {editingFlock && (
              <button type="button" className="ghost" onClick={cancelEdit}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {!editingFlock && hasActiveBatch && (
          <div className="info mt">
            You already have an active batch. Close it from the list below to add a new batch.
          </div>
        )}
        {error && <div className="error mt">{error}</div>}
        {success && <div className="success mt">{success}</div>}
      </div>

      <div className="card">
        <h2>Existing batches</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Batch no</th>
                <th>Start date</th>
                <th>Total chicks</th>
                <th>Price/chick</th>
                <th>Status</th>
                <th style={{ width: "90px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flocks.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>
                    {loading ? "Loading..." : "No batches yet"}
                  </td>
                </tr>
              )}
              {flocks.map((flock) => (
                <tr key={flock._id}>
                  <td>{flock.displayLabel || flock.batch_no || "-"}</td>
                  <td>{formatIndiaDate(flock.start_date) || "-"}</td>
                  <td>{flock.totalChicks}</td>
                  <td>{flock.pricePerChick ? flock.pricePerChick.toFixed?.(2) ?? flock.pricePerChick : "-"}</td>
                  <td>{flock.status}</td>
                  <td>
                        <button
                          type="button"
                          className="link"
                          disabled={flock.status !== "active"}
                          onClick={() => onEdit(flock)}
                        >
                          Edit
                        </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
