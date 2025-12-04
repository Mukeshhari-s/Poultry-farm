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
	const [editingRecord, setEditingRecord] = useState(null);
	const [savingEdit, setSavingEdit] = useState(false);

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
		setSavingEdit(true);

		try {
			if (editingRecord) {
				await medicineApi.update(editingRecord._id, {
					batch_no: form.batch_no,
					date: form.date,
					medicine_name: form.medicine_name,
					quantity: Number(form.quantity),
					dose: form.dose,
				});
				setSuccess("Medicine entry updated.");
				setEditingRecord(null);
			} else {
				await medicineApi.create({
					...form,
					quantity: Number(form.quantity),
				});
				setSuccess("Medicine saved.");
			}
			setForm({ batch_no: form.batch_no, date: today, medicine_name: "", quantity: "", dose: "" });
			fetchRecords();
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save record");
		} finally {
			setSavingEdit(false);
		}
	};

	const onEditRecord = (rec) => {
		setEditingRecord(rec);
		setForm({
			batch_no: rec.batch_no,
			date: rec.date?.slice(0, 10) || today,
			medicine_name: rec.medicine_name,
			quantity: rec.quantity?.toString() || "",
			dose: rec.dose || "",
		});
		setError("");
		setSuccess("");
	};

	const cancelEdit = () => {
		setEditingRecord(null);
		setForm({ batch_no: "", date: today, medicine_name: "", quantity: "", dose: "" });
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
				<h2>{editingRecord ? "Edit medicine entry" : "Add medicine entry"}</h2>
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
					<div className="grid-full" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
						<button type="submit" disabled={savingEdit}>
							{savingEdit ? "Saving..." : editingRecord ? "Update entry" : "Save medicine"}
						</button>
						{editingRecord && (
							<button type="button" className="ghost" onClick={cancelEdit}>
								Cancel
							</button>
						)}
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
								<th>Actions</th>
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
									<td>
										<button type="button" className="link" onClick={() => onEditRecord(rec)}>
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
