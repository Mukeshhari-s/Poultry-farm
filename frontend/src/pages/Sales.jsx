import React, { useEffect, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { salesApi } from "../services/api";

const today = new Date().toISOString().slice(0, 10);

export default function Sales() {
	const { flocks } = useFlocks();
	const [selectedBatch, setSelectedBatch] = useState("");
	const [records, setRecords] = useState([]);
	const [summary, setSummary] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [form, setForm] = useState({
		date: today,
		vehicle_no: "",
		cages: "",
		birds: "",
		total_weight: "",
		remarks: "",
	});

	const fetchSales = async (batch_no) => {
		if (!batch_no) return;
		setLoading(true);
		setError("");
		try {
			const list = await salesApi.list({ batch_no });
			setRecords(list);
			const stats = await salesApi.remaining(batch_no);
			setSummary(stats);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load sales data");
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
		if (selectedBatch) fetchSales(selectedBatch);
	}, [selectedBatch]);

	const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

	const onSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!selectedBatch) {
			setError("Select a batch first");
			return;
		}
		try {
			await salesApi.create({
				batch_no: selectedBatch,
				date: form.date,
				vehicle_no: form.vehicle_no,
				cages: Number(form.cages || 0),
				birds: Number(form.birds || 0),
				total_weight: Number(form.total_weight || 0),
				remarks: form.remarks,
			});
			setSuccess("Sale recorded.");
			setForm({ date: today, vehicle_no: "", cages: "", birds: "", total_weight: "", remarks: "" });
			fetchSales(selectedBatch);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save sale");
		}
	};

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Sales</h1>
					<p>Capture bird dispatch details.</p>
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

			{summary && (
				<div className="stat-grid">
					<div className="stat-card">
						<span>Initial chicks</span>
						<strong>{summary.batch?.totalChicks ?? summary.batch?.total ?? "-"}</strong>
					</div>
					<div className="stat-card">
						<span>Total mortality</span>
						<strong>{summary.totalMort ?? "-"}</strong>
					</div>
					<div className="stat-card">
						<span>Sold</span>
						<strong>{summary.totalSold ?? 0}</strong>
					</div>
					<div className="stat-card">
						<span>Remaining</span>
						<strong>{summary.remaining ?? 0}</strong>
					</div>
				</div>
			)}

			{error && <div className="error mb">{error}</div>}
			{success && <div className="success mb">{success}</div>}

			<div className="card">
				<h2>Add sale record</h2>
				<form className="grid-3" onSubmit={onSubmit}>
					<label>
						<span>Date</span>
						<input type="date" name="date" max={today} value={form.date} onChange={onChange} />
					</label>
					<label>
						<span>Vehicle no.</span>
						<input name="vehicle_no" value={form.vehicle_no} onChange={onChange} />
					</label>
					<label>
						<span>Cages</span>
						<input type="number" min="0" name="cages" value={form.cages} onChange={onChange} />
					</label>
					<label>
						<span>Birds</span>
						<input type="number" min="0" name="birds" value={form.birds} onChange={onChange} />
					</label>
					<label>
						<span>Total weight (kg)</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="total_weight"
							value={form.total_weight}
							onChange={onChange}
						/>
					</label>
					<label className="grid-full">
						<span>Remarks</span>
						<textarea name="remarks" rows={2} value={form.remarks} onChange={onChange} />
					</label>
					<div className="grid-full">
						<button type="submit">Save sale</button>
					</div>
				</form>
			</div>

			<div className="card mt">
				<h2>Sales log</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Vehicle</th>
								<th>Cages</th>
								<th>Birds</th>
								<th>Weight (kg)</th>
								<th>Remarks</th>
							</tr>
						</thead>
						<tbody>
							{records.length === 0 && (
								<tr>
									<td colSpan="6" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No sale entries"}
									</td>
								</tr>
							)}
							{records.map((sale) => (
								<tr key={sale._id}>
									<td>{sale.date?.slice(0, 10)}</td>
									<td>{sale.vehicle_no || "-"}</td>
									<td>{sale.cages}</td>
									<td>{sale.birds}</td>
									<td>{sale.total_weight}</td>
									<td>{sale.remarks || "-"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
