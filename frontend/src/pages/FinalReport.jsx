import React, { useEffect, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { reportApi } from "../services/api";

export default function FinalReport() {
	const { flocks } = useFlocks();
	const [selectedFlockId, setSelectedFlockId] = useState("");
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const loadReport = async (flockId) => {
		if (!flockId) return;
		setLoading(true);
		setError("");
		try {
			const res = await reportApi.final({ flockId });
			setData(res);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load closing report");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!selectedFlockId && flocks.length > 0) {
			setSelectedFlockId(flocks[0]._id);
		}
	}, [flocks, selectedFlockId]);

	useEffect(() => {
		if (selectedFlockId) loadReport(selectedFlockId);
	}, [selectedFlockId]);

	const rows = data?.rows || [];
	const summaryCards = [
		{ label: "Total chicks in", value: data?.totalChicks ?? "-" },
		{ label: "Remaining chicks", value: data?.remainingChicks ?? "-" },
		{ label: "Total feed in (kg)", value: data?.totalFeedIn ?? "-" },
		{ label: "Feed used (kg)", value: data?.totalFeedOut ?? "-" },
		{ label: "Feed remaining (kg)", value: data?.feedRemaining ?? "-" },
		{ label: "Birds sold", value: data?.totalBirdsSold ?? "-" },
		{ label: "Weight sold (kg)", value: data?.totalWeightSold ?? "-" },
	];

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Final closing report</h1>
					<p>Summarize a batch after 40+ days of monitoring.</p>
				</div>
				<select value={selectedFlockId} onChange={(e) => setSelectedFlockId(e.target.value)}>
					<option value="">Select flock</option>
					{flocks.map((f) => (
						<option key={f._id} value={f._id}>
							{f.displayLabel || f.batch_no || f._id}
						</option>
					))}
				</select>
			</div>

			{error && <div className="error mb">{error}</div>}

			<div className="stat-grid">
				{summaryCards.map((card) => (
					<div key={card.label} className="stat-card">
						<span>{card.label}</span>
						<strong>{card.value}</strong>
					</div>
				))}
			</div>

			<div className="card mt">
				<h2>Daily performance (min 40 days recommended)</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Age</th>
								<th>Mortality</th>
								<th>Cumulative %</th>
								<th>Feed kg</th>
								<th>Feed/bird</th>
								<th>Birds at start</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && (
								<tr>
									<td colSpan="7" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No data"}
									</td>
								</tr>
							)}
							{rows.map((row, idx) => (
								<tr key={`${row.date}-${idx}`}>
									<td>{row.date?.slice(0, 10)}</td>
									<td>{row.age}</td>
									<td>{row.mortality}</td>
									<td>{row.mortalityPercent?.toFixed?.(2) ?? row.mortalityPercent}</td>
									<td>{row.feedKg}</td>
									<td>{row.feedPerBird?.toFixed?.(4) ?? row.feedPerBird}</td>
									<td>{row.birdsAtStart}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="card mt">
				<h2>Medicine summary</h2>
				<div className="timeline">
					{data?.medicineByDate &&
						Object.entries(data.medicineByDate).map(([date, meds]) => (
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
					{(!data || !data.medicineByDate || Object.keys(data.medicineByDate).length === 0) && (
						<p>{loading ? "Loading..." : "No medicine entries"}</p>
					)}
				</div>
			</div>
		</div>
	);
}
