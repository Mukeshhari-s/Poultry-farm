import React, { useEffect, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { reportApi } from "../services/api";

export default function Dashboard() {
  const { flocks } = useFlocks();
  const [currentReport, setCurrentReport] = useState(null);
  const [error, setError] = useState("");

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
          <span>Cumulative mortality</span>
          <strong>
            {summary?.cumulativeMortality ?? "-"} ({summary?.cumulativeMortalityPercent ?? "-"}%)
          </strong>
        </div>
        <div className="stat-card">
          <span>Feed remaining (kg)</span>
          <strong>{summary?.feedRemaining ?? "-"}</strong>
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
              <span>Feed kg</span>
              <strong>{latestRow.feedKg}</strong>
            </div>
            <div className="stat-card">
              <span>Feed per bird</span>
              <strong>{latestRow.feedPerBird}</strong>
            </div>
            <div className="stat-card">
              <span>Average weight</span>
              <strong>{latestRow.avgWeight ?? "-"}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
