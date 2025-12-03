import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { monitoringApi, reportApi } from "../services/api";

const today = new Date().toISOString().slice(0, 10);

export default function DailyMonitoring() {
	const { flocks } = useFlocks();
	const [selectedBatch, setSelectedBatch] = useState("");
	const [form, setForm] = useState({
		date: today,
		mortality: "0",
		feedBags: "0",
		feedKg: "0",
		avgWeight: "0",
		remarks: "",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const [reportRows, setReportRows] = useState([]);
	const [reportSummary, setReportSummary] = useState(null);
	const [reportLoading, setReportLoading] = useState(false);

	useEffect(() => {
		if (!selectedBatch && flocks.length > 0) {
			setSelectedBatch(flocks[0].batch_no);
		}
	}, [flocks, selectedBatch]);

	const onChange = (e) => {
		setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

	const loadReport = async (batch_no) => {
		if (!batch_no) return;
		setReportLoading(true);
		setError("");
		try {
			const data = await reportApi.current({ batch_no });
			setReportRows(data.rows || []);
			setReportSummary(data.summary || null);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load report");
		} finally {
			setReportLoading(false);
		}
	};

	useEffect(() => {
		if (selectedBatch) loadReport(selectedBatch);
	}, [selectedBatch]);

	const onSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!selectedBatch) {
			setError("Select a batch first");
			return;
		}
		setSaving(true);
		try {
			await monitoringApi.create({
				batch_no: selectedBatch,
				date: form.date,
				mortality: Number(form.mortality || 0),
				feedBags: Number(form.feedBags || 0),
				feedKg: Number(form.feedKg || 0),
				avgWeight: Number(form.avgWeight || 0),
				remarks: form.remarks,
			});
			setSuccess("Daily entry saved.");
			setForm((prev) => ({
				...prev,
				mortality: "0",
				feedBags: "0",
				feedKg: "0",
				avgWeight: "0",
				remarks: "",
			}));
			loadReport(selectedBatch);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save entry");
		} finally {
			setSaving(false);
		}
	};

	const remainingChicks = useMemo(() => reportSummary?.remainingChicks ?? 0, [reportSummary]);

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Daily monitoring</h1>
					<p>Capture age-wise mortality, feed intake, and weight.</p>
				</div>
				<select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
					<option value="">Select batch</option>
					{flocks.map((f) => (
						<option key={f._id} value={f.batch_no}>
							{f.displayLabel || f.batch_no}
						</option>
					))}
				</select>
			</div>

			{error && <div className="error mb">{error}</div>}
			{success && <div className="success mb">{success}</div>}

			<div className="card">
				<h2>Add daily record</h2>
				<form className="grid-3" onSubmit={onSubmit}>
					<label>
						<span>Date</span>
						<input type="date" name="date" max={today} value={form.date} onChange={onChange} />
					</label>
					<label>
						<span>Mortality</span>
						<input type="number" min="0" name="mortality" value={form.mortality} onChange={onChange} />
					</label>
					<label>
						<span>Feed bags</span>
						<input type="number" min="0" name="feedBags" value={form.feedBags} onChange={onChange} />
					</label>
					<label>
						<span>Feed kg</span>
						<input type="number" min="0" name="feedKg" value={form.feedKg} onChange={onChange} />
					</label>
					<label>
						<span>Average weight (kg)</span>
						<input type="number" min="0" step="0.01" name="avgWeight" value={form.avgWeight} onChange={onChange} />
					</label>
					<label className="grid-full">
						<span>Remarks</span>
						<textarea name="remarks" rows={2} value={form.remarks} onChange={onChange} />
					</label>
					<div className="grid-full">
						<button type="submit" disabled={saving}>
							{saving ? "Saving..." : "Save entry"}
						</button>
					</div>
				</form>
			</div>

			<div className="card mt">
				<div className="card-header">
					<h2>Day wise snapshot</h2>
					{reportSummary && (
						<div className="stat-pill">Remaining chicks: {remainingChicks}</div>
					)}
				</div>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Age</th>
								<th>Mortality</th>
								<th>Cumulative mortality</th>
								<th>Feed kg</th>
								<th>Feed/bird</th>
								<th>Avg weight</th>
								<th>Remarks</th>
							</tr>
						</thead>
						<tbody>
							{reportRows.length === 0 && (
								<tr>
									<td colSpan="8" style={{ textAlign: "center" }}>
										{reportLoading ? "Loading report..." : "No records yet"}
									</td>
								</tr>
							)}
							{reportRows.map((row) => (
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
		</div>
	);
}
