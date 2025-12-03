import React, { useEffect, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { reportApi } from "../services/api";

export default function CurrentReport() {
	const { flocks } = useFlocks();
	const batchOptions = flocks.map((f) => ({
		value: f.batch_no,
		label: f.displayLabel || f.batch_no,
	}));
	const [selectedBatch, setSelectedBatch] = useState("");
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const loadReport = async (batch) => {
		if (!batch) return;
		setLoading(true);
		setError("");
		try {
			const res = await reportApi.current({ batch_no: batch });
			setData(res);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load report");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!selectedBatch && flocks.length > 0) {
			setSelectedBatch(flocks[0].batch_no);
		}
	}, [flocks, selectedBatch]);

	useEffect(() => {
		if (selectedBatch) loadReport(selectedBatch);
	}, [selectedBatch]);

	const summary = data?.summary;
	const rows = data?.rows || [];
	const medicineByDate = data?.medicineByDate || {};

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Current report</h1>
					<p>Live mortality, feed, and medicine snapshot.</p>
				</div>
				<select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
					<option value="">Select batch</option>
					{batchOptions.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			</div>

			{error && <div className="error mb">{error}</div>}

			{summary && (
				<div className="stat-grid">
					<div className="stat-card">
						<span>Remaining chicks</span>
						<strong>{summary.remainingChicks}</strong>
					</div>
					<div className="stat-card">
						<span>Cumulative mortality</span>
						<strong>
							{summary.cumulativeMortality} ({summary.cumulativeMortalityPercent}% )
						</strong>
					</div>
					<div className="stat-card">
						<span>Feed in (kg)</span>
						<strong>{summary.totalFeedIn}</strong>
					</div>
					<div className="stat-card">
						<span>Feed used (kg)</span>
						<strong>{summary.totalFeedOut}</strong>
					</div>
					<div className="stat-card">
						<span>Feed remaining (kg)</span>
						<strong>{summary.feedRemaining}</strong>
					</div>
					<div className="stat-card">
						<span>Birds sold</span>
						<strong>{summary.totalBirdsSold}</strong>
					</div>
				</div>
			)}

			<div className="card mt">
				<h2>Daily breakdown</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Age</th>
								<th>Mortality</th>
								<th>Mortality %</th>
								<th>Feed kg</th>
								<th>Feed/bird</th>
								<th>Avg weight</th>
								<th>Remarks</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && (
								<tr>
									<td colSpan="8" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No daily data"}
									</td>
								</tr>
							)}
							{rows.map((row) => (
								<tr key={`${row.date}-${row.age}`}>
									<td>{row.date}</td>
									<td>{row.age}</td>
									<td>{row.mortality}</td>
									<td>
										{row.cumulativeMortality} ({row.mortalityPercent}% )
									</td>
									<td>{row.feedKg}</td>
									<td>{row.feedPerBird}</td>
									<td>{row.avgWeight ?? "-"}</td>
									<td>{row.remarks || "-"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="card mt">
				<h2>Medicine timeline</h2>
				{Object.keys(medicineByDate).length === 0 && (
					<p>{loading ? "Loading..." : "No medicine records"}</p>
				)}
				<div className="timeline">
					{Object.entries(medicineByDate).map(([date, meds]) => (
						<div key={date} className="timeline-item">
							<div className="timeline-date">{date}</div>
							<ul>
								{meds.map((med) => (
									<li key={med._id}>
										{med.medicine_name} – {med.quantity} ({med.dose})
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
