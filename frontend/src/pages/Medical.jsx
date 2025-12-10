import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { medicineApi } from "../services/api";
import { createBatchLabelMap, getTodayISO, formatIndiaDate } from "../utils/helpers";

const today = getTodayISO();

export default function Medical() {
	const { flocks } = useFlocks();
	const batchLabelMap = useMemo(() => createBatchLabelMap(flocks), [flocks]);
	const activeFlocks = useMemo(() => flocks.filter((f) => f.status === "active"), [flocks]);
	const activeBatchNos = useMemo(
		() => new Set(flocks.filter((f) => f.status === "active").map((f) => f.batch_no)),
		[flocks]
	);
	const [records, setRecords] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const cumulativeMedicineCost = useMemo(() => {
		return records.reduce((acc, rec) => {
			const cost = Number(rec.totalCost || 0);
			if (!Number.isFinite(cost) || cost <= 0) return acc;
			return acc + cost;
		}, 0);
	}, [records]);
	const computeTotalCost = (quantity, unitPrice) => {
		const qty = Number(quantity || 0);
		const price = Number(unitPrice || 0);
		const total = qty * price;
		if (!Number.isFinite(total) || total <= 0) return "";
		return (Math.round(total * 100) / 100).toString();
	};

	const [form, setForm] = useState({
		batch_no: "",
		date: today,
		medicine_name: "",
		quantity: "",
		unitPrice: "",
		totalCost: "",
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

	const onChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => {
			const next = { ...prev, [name]: value };
			if (name === "quantity" || name === "unitPrice") {
				next.totalCost = computeTotalCost(next.quantity, next.unitPrice);
			}
			return next;
		});
	};

	const onSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!form.batch_no || !form.medicine_name || !form.quantity || !form.dose || !form.unitPrice) {
			setError("All fields are required.");
			return;
		}
		const quantityValue = Number(form.quantity);
		const unitPriceValue = Number(form.unitPrice);
		const totalCostValue = Number(form.totalCost || 0);
		if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
			setError("Quantity must be greater than zero.");
			return;
		}
		if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
			setError("Unit price must be greater than zero.");
			return;
		}
		if (!Number.isFinite(totalCostValue) || totalCostValue <= 0) {
			setError("Total cost is invalid.");
			return;
		}
		setSavingEdit(true);

		try {
			if (editingRecord) {
				await medicineApi.update(editingRecord._id, {
					batch_no: form.batch_no,
					date: form.date,
					medicine_name: form.medicine_name,
					quantity: quantityValue,
					unitPrice: unitPriceValue,
					totalCost: totalCostValue,
					dose: form.dose,
				});
				setSuccess("Medicine entry updated.");
				setEditingRecord(null);
			} else {
				await medicineApi.create({
					...form,
					quantity: quantityValue,
					unitPrice: unitPriceValue,
					totalCost: totalCostValue,
				});
				setSuccess("Medicine saved.");
			}
			setForm({
				batch_no: form.batch_no,
				date: today,
				medicine_name: "",
				quantity: "",
				unitPrice: "",
				totalCost: "",
				dose: "",
			});
			fetchRecords();
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save record");
		} finally {
			setSavingEdit(false);
		}
	};

	const onEditRecord = (rec) => {
		// Prevent editing entries for closed batches
		if (!activeBatchNos.has(rec.batch_no)) {
			setError("Medicine entries for closed batches cannot be edited.");
			setSuccess("");
			return;
		}
		setEditingRecord(rec);
		setForm({
			batch_no: rec.batch_no,
			date: formatIndiaDate(rec.date) || today,
			medicine_name: rec.medicine_name,
			quantity: rec.quantity?.toString() || "",
			unitPrice: rec.unitPrice?.toString() || "",
			totalCost:
				rec.totalCost?.toString() ||
				computeTotalCost(rec.quantity, rec.unitPrice) ||
				"",
			dose: rec.dose || "",
		});
		setError("");
		setSuccess("");
	};

	const cancelEdit = () => {
		setEditingRecord(null);
		setForm({ batch_no: "", date: today, medicine_name: "", quantity: "", unitPrice: "", totalCost: "", dose: "" });
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
							{(editingRecord ? flocks : activeFlocks).map((f) => (
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
					<label>
						<span>Unit price</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="unitPrice"
							value={form.unitPrice}
							onChange={onChange}
						/>
					</label>
					<label>
						<span>Total cost</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="totalCost"
							value={form.totalCost}
							readOnly
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
								<th>Unit price</th>
								<th>Total cost</th>
								<th>Dose</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{records.length === 0 && (
								<tr>
									<td colSpan="8" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No records yet"}
									</td>
								</tr>
							)}
							{records.map((rec) => {
								const canEdit = activeBatchNos.has(rec.batch_no);
								return (
									<tr key={rec._id}>
										<td>{formatIndiaDate(rec.date)}</td>
										<td>{batchLabelMap[rec.batch_no] || rec.batch_no}</td>
										<td>{rec.medicine_name}</td>
										<td>{rec.quantity}</td>
										<td>{rec.unitPrice ? Number(rec.unitPrice).toFixed(2) : "-"}</td>
										<td>{rec.totalCost ? Number(rec.totalCost).toFixed(2) : "-"}</td>
										<td>{rec.dose}</td>
										<td>
											{canEdit && (
												<button type="button" className="link" onClick={() => onEditRecord(rec)}>
													Edit
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					<div className="stat-note" style={{ marginTop: "0.75rem", fontSize: "0.95rem" }}>
						Cumulative medicine cost: {cumulativeMedicineCost.toFixed(2)}
					</div>
				</div>
			</div>
		</div>
	);
}
