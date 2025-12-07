import React, { useEffect, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { reportApi } from "../services/api";
import { formatIndiaDate } from "../utils/helpers";

const formatBagsFromKg = (kgValue) => {
	const num = Number(kgValue);
	if (!Number.isFinite(num)) return null;
	return (num / 60).toFixed(2);
};

const hasValue = (value) => value !== null && value !== undefined && !Number.isNaN(Number(value));

const formatStatValue = (value, options = {}) => {
	if (!hasValue(value)) return "-";
	const num = Number(value);
	if (options.decimals !== undefined) {
		return num.toFixed(options.decimals);
	}
	return num;
};

const formatFeedPerBird = (value) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return num.toFixed(3);
};

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

	const renderDate = (row) => {
		if (!row) return "";
		if (row.date) return row.date;
		if (row.dateIso) return formatIndiaDate(row.dateIso);
		return "";
	};
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
						<strong>{formatStatValue(summary.remainingChicks)}</strong>
					</div>
					<div className="stat-card">
						<span>Cum mort</span>
						<strong>
							{formatStatValue(summary.cumulativeMortality)} ({formatStatValue(summary.cumulativeMortalityPercent)}% )
						</strong>
					</div>
					<div className="stat-card">
						<span>Chick cost</span>
						<strong>{formatStatValue(summary.totalChickCost)}</strong>
					</div>
					<div className="stat-card">
						<span>Feed in (bags)</span>
						<strong>
							{hasValue(summary.totalFeedIn)
								? formatStatValue(formatBagsFromKg(summary.totalFeedIn))
								: "-"}
							{hasValue(summary.totalFeedIn) ? (
								<span className="stat-subtext"> ({formatStatValue(summary.totalFeedIn)} kg)</span>
							) : null}
						</strong>
					</div>
					<div className="stat-card">
						<span>Feed out (bags)</span>
						<strong>
							{hasValue(summary.totalFeedOut)
								? formatStatValue(formatBagsFromKg(summary.totalFeedOut))
								: "-"}
							{hasValue(summary.totalFeedOut) ? (
								<span className="stat-subtext"> ({formatStatValue(summary.totalFeedOut)} kg)</span>
							) : null}
						</strong>
					</div>
					<div className="stat-card">
						<span>Feed used (bags)</span>
						<strong>
							{hasValue(summary.totalFeedUsed)
								? formatStatValue(formatBagsFromKg(summary.totalFeedUsed))
								: "-"}
							{hasValue(summary.totalFeedUsed) ? (
								<span className="stat-subtext"> ({formatStatValue(summary.totalFeedUsed)} kg)</span>
							) : null}
						</strong>
					</div>
					<div className="stat-card">
						<span>Feed remaining (bags)</span>
						<strong>
							{hasValue(summary.feedRemaining)
								? formatStatValue(formatBagsFromKg(summary.feedRemaining))
								: "-"}
							{hasValue(summary.feedRemaining) ? (
								<span className="stat-subtext"> ({formatStatValue(summary.feedRemaining)} kg)</span>
							) : null}
						</strong>
					</div>
					<div className="stat-card">
						<span>Total feed cost</span>
						<strong>{formatStatValue(summary.totalFeedCost)}</strong>
					</div>
					<div className="stat-card">
						<span>Total medicine cost</span>
						<strong>{formatStatValue(summary.totalMedicineCost)}</strong>
					</div>
					<div className="stat-card">
						<span>Birds sold</span>
						<strong>{formatStatValue(summary.totalBirdsSold)}</strong>
					</div>
					<div className="stat-card">
						<span>Total sold weight (kg)</span>
						<strong>{formatStatValue(summary.totalWeightSold, { decimals: 3 })}</strong>
					</div>
					<div className="stat-card">
						<span>Avg weight per bird (kg)</span>
						<strong>
							{formatStatValue(summary.avgWeightPerBird, { decimals: 3 })}
						</strong>
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
								<th>Feed bags</th>
								<th>Feed/bird</th>
								<th>Avg weight</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && (
								<tr>
									<td colSpan="7" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No daily data"}
									</td>
								</tr>
							)}
							{rows.map((row) => {
								const displayDate = renderDate(row);
								const key = row._id || `${displayDate}-${row.age}`;
								return (
									<tr key={key}>
										<td>{displayDate}</td>
									<td>{row.age}</td>
									<td>{row.mortality}</td>
									<td>
										{row.cumulativeMortality} ({row.mortalityPercent}% )
									</td>
									<td>
										{hasValue(row.feedKg)
											? `${formatBagsFromKg(row.feedKg)} bags (${formatStatValue(row.feedKg, { decimals: 2 })} kg)`
											: "-"}
									</td>
									<td>{formatFeedPerBird(row.feedPerBird)}</td>
									<td>{row.avgWeight ?? "-"}</td>
									</tr>
								);
							})}
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
