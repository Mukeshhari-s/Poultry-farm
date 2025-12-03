import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { medicineApi } from "../services/api";
import { createBatchLabelMap } from "../utils/helpers";

const today = new Date().toISOString().slice(0, 10);

export default function Medical() {
	const { flocks } = useFlocks();
	const batchLabelMap = useMemo(() => createBatchLabelMap(flocks), [flocks]);
	const [records, setRecords] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [form, setForm] = useState({
		batch_no: "",
		date: today,
		medicine_name: "",
		quantity: "",
		dose: "",
	});

	const fetchRecords = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await medicineApi.list();
			setRecords(data);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load medicine log");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchRecords();
	}, []);

	const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

	const onSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!form.batch_no || !form.medicine_name || !form.quantity || !form.dose) {
			setError("All fields are required.");
			return;
		}

		try {
			await medicineApi.create({
				...form,
				quantity: Number(form.quantity),
			});
			setSuccess("Medicine saved.");
			setForm({ batch_no: form.batch_no, date: today, medicine_name: "", quantity: "", dose: "" });
			fetchRecords();
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save record");
		}
	};

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Medicine log</h1>
					<p>Track medicine usage per batch.</p>
				</div>
			</div>

			{error && <div className="error mb">{error}</div>}
			{success && <div className="success mb">{success}</div>}

			<div className="card">
				<h2>Add medicine entry</h2>
				<form className="grid-2" onSubmit={onSubmit}>
					<label>
						<span>Batch</span>
						<select name="batch_no" value={form.batch_no} onChange={onChange}>
							<option value="">Select batch</option>
							{flocks.map((f) => (
								<option key={f._id} value={f.batch_no}>
									{f.displayLabel || f.batch_no}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>Date</span>
						<input type="date" name="date" max={today} value={form.date} onChange={onChange} />
					</label>
					<label>
						<span>Medicine name</span>
						<input name="medicine_name" value={form.medicine_name} onChange={onChange} />
					</label>
					<label>
						<span>Quantity</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="quantity"
							value={form.quantity}
							onChange={onChange}
						/>
					</label>
					<label className="grid-full">
						<span>Dose / instructions</span>
						<input name="dose" value={form.dose} onChange={onChange} />
					</label>
					<div className="grid-full">
						<button type="submit">Save medicine</button>
					</div>
				</form>
			</div>

			<div className="card mt">
				<h2>Recent entries</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Batch</th>
								<th>Medicine</th>
								<th>Quantity</th>
								<th>Dose</th>
							</tr>
						</thead>
						<tbody>
							{records.length === 0 && (
								<tr>
									<td colSpan="5" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No records yet"}
									</td>
								</tr>
							)}
							{records.map((rec) => (
								<tr key={rec._id}>
									<td>{rec.date?.slice(0, 10)}</td>
									<td>{batchLabelMap[rec.batch_no] || rec.batch_no}</td>
									<td>{rec.medicine_name}</td>
									<td>{rec.quantity}</td>
									<td>{rec.dose}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
