import React, { useEffect, useState, useRef, useMemo } from "react";
import useFlocks from "../hooks/useFlocks";
import { useAuth } from "../context/AuthContext";
import { flockApi, reportApi } from "../services/api";

const formatBagsFromKg = (kgValue) => {
  const num = Number(kgValue);
  if (!Number.isFinite(num)) return null;
  return (num / 60).toFixed(2);
};

const hasValue = (value) => value !== null && value !== undefined && !Number.isNaN(Number(value));

const formatFeedPerBird = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(3);
};

const formatNumber = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
};

export default function Dashboard() {
  const { flocks } = useFlocks();
  const { user } = useAuth();
  const [currentReport, setCurrentReport] = useState(null);
  const [error, setError] = useState("");
  const [batchSummaries, setBatchSummaries] = useState([]);
  const [batchSummaryError, setBatchSummaryError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [selectedCompletedBatch, setSelectedCompletedBatch] = useState("");
  const [downloadingBatchId, setDownloadingBatchId] = useState("");
  const [pdfError, setPdfError] = useState("");

  const completedBatches = useMemo(() => flocks.filter((f) => f.status === "closed"), [flocks]);
  const totalBatches = flocks.length;
  const completedCount = completedBatches.length;

  useEffect(() => {
    const loadDefaultReport = async () => {
      if (flocks.length === 0) return;
      try {
        const data = await reportApi.current({ batch_no: flocks[0].batch_no });
        setCurrentReport(data);
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Unable to load report");
      }
    };
    loadDefaultReport();
  }, [flocks]);

  useEffect(() => {
    setProfileOpen(false);
  }, [user]);

  useEffect(() => {
    setSelectedCompletedBatch("");
    setPdfError("");
  }, [completedCount]);

  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (event) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  const handleBatchPdfDownload = async (flockId) => {
    if (!flockId) return;
    try {
      setPdfError("");
      setDownloadingBatchId(flockId);
      const response = await reportApi.finalPdf(flockId);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const batch = completedBatches.find((f) => f._id === flockId);
      const filename = `${batch?.batch_no || "performance-report"}.pdf`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err.response?.data?.error || err.message || "Unable to download performance report");
    } finally {
      setDownloadingBatchId("");
      setSelectedCompletedBatch("");
    }
  };

  const onCompletedBatchChange = async (event) => {
    const flockId = event.target.value;
    setSelectedCompletedBatch(flockId);
    if (!flockId) return;
    await handleBatchPdfDownload(flockId);
  };

  useEffect(() => {
    const loadBatchSummaries = async () => {
      if (flocks.length === 0) {
        setBatchSummaries([]);
        return;
      }
      try {
        setBatchSummaryError("");
        const data = await flockApi.dashboardSummary();
        setBatchSummaries(data);
      } catch (err) {
        setBatchSummaryError(err.response?.data?.error || err.message || "Unable to load batch summaries");
      }
    };
    loadBatchSummaries();
  }, [flocks]);

  const summary = currentReport?.summary;
  const latestRow = currentReport?.rows?.slice(-1)[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Monitor your poultry farm at a glance.</p>
        </div>
      </div>

      {error && <div className="error mb">{error}</div>}

      {user && (
        <div
          className="card mb"
          style={{ display: "flex", justifyContent: "flex-end", position: "relative", alignItems: "center", gap: "1rem" }}
          ref={profileRef}
        >
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>Completed batches: {completedCount}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #666)", marginBottom: "0.35rem" }}>
              Total batches: {totalBatches}
            </div>
            <select
              value={selectedCompletedBatch}
              onChange={onCompletedBatchChange}
              disabled={!completedCount || Boolean(downloadingBatchId)}
              style={{ padding: "0.35rem 0.5rem", borderRadius: "0.35rem", minWidth: "200px" }}
            >
              <option value="">
                {completedCount
                  ? downloadingBatchId
                    ? "Preparing PDF..."
                    : "Download performance report"
                  : "No completed batches"}
              </option>
              {completedBatches.map((batch) => (
                <option key={batch._id} value={batch._id}>
                  {batch.batch_no || batch.displayLabel || batch._id}
                </option>
              ))}
            </select>
            {pdfError && (
              <div className="error" style={{ marginTop: "0.35rem" }}>
                {pdfError}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: "var(--primary, #222)",
              color: "#fff",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
            title="View profile details"
          >
            {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
          </button>
          {profileOpen && (
            <div
              style={{
                position: "absolute",
                top: "60px",
                right: "1rem",
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                padding: "1rem 1.25rem",
                minWidth: "220px",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #666)", marginBottom: "0.35rem" }}>
                Signed in as
              </div>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{user.name}</div>
              <div style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>{user.email}</div>
              <div style={{ fontSize: "0.9rem", color: "var(--text-muted, #555)" }}>{user.mobile}</div>
            </div>
          )}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <span>Active batches</span>
          <strong>{flocks.length}</strong>
        </div>
        <div className="stat-card">
          <span>Remaining chicks</span>
          <strong>{summary?.remainingChicks ?? "-"}</strong>
        </div>
        <div className="stat-card">
          <span>Cum mort</span>
          <strong>
            {summary?.cumulativeMortality ?? "-"} ({summary?.cumulativeMortalityPercent ?? "-"}%)
          </strong>
        </div>
        <div className="stat-card">
          <span>Feed remaining (bags)</span>
          <strong>
            {summary?.feedRemaining
              ? formatBagsFromKg(summary.feedRemaining)
              : summary?.feedRemaining === 0
              ? "0.00"
              : "-"}
            {summary?.feedRemaining != null ? (
              <span className="stat-subtext"> ({Number(summary.feedRemaining).toFixed(2)} kg)</span>
            ) : null}
          </strong>
        </div>
        <div className="stat-card">
          <span>Birds sold</span>
          <strong>{summary?.totalBirdsSold ?? "-"}</strong>
        </div>
      </div>

      {latestRow && (
        <div className="card mt">
          <h2>Latest daily record ({latestRow.date})</h2>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Age</span>
              <strong>{latestRow.age} days</strong>
            </div>
            <div className="stat-card">
              <span>Mortality</span>
              <strong>{latestRow.mortality}</strong>
            </div>
            <div className="stat-card">
              <span>Feed bags</span>
              <strong>
                {hasValue(latestRow.feedKg)
                  ? formatBagsFromKg(latestRow.feedKg)
                  : "-"}
                {hasValue(latestRow.feedKg) ? (
                  <span className="stat-subtext"> ({Number(latestRow.feedKg).toFixed(2)} kg)</span>
                ) : null}
              </strong>
            </div>
            <div className="stat-card">
              <span>Feed per bird</span>
              <strong>{formatFeedPerBird(latestRow.feedPerBird)}</strong>
            </div>
            <div className="stat-card">
              <span>Average weight</span>
              <strong>{latestRow.avgWeight ?? "-"}</strong>
            </div>
          </div>
        </div>
      )}

      {flocks.length > 0 && (
        <div className="card mt">
          <h2>Batch reports</h2>
          {batchSummaryError && <div className="error mb">{batchSummaryError}</div>}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Chicks in</th>
                  <th>Chicks out</th>
                  <th>Feed used (bags)</th>
                  <th>Feed used (kg)</th>
                  <th>Total weight (kg)</th>
                  <th>Final amount</th>
                </tr>
              </thead>
              <tbody>
                {batchSummaries.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      {batchSummaryError ? "" : "No batch data yet"}
                    </td>
                  </tr>
                )}
                {batchSummaries.map((item) => (
                  <tr key={item.batch_no}>
                    <td>{item.batch_no}</td>
                    <td>{formatNumber(item.chicksIn ?? 0, 0)}</td>
                    <td>{formatNumber(item.chicksOut ?? 0, 0)}</td>
                    <td>{formatNumber(item.totalFeedBags ?? 0, 2)}</td>
                    <td>{formatNumber(item.totalFeedKg ?? 0, 2)}</td>
                    <td>{formatNumber(item.totalWeightKg ?? 0, 3)}</td>
                    <td>-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
