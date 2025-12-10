import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { salesApi } from "../services/api";
import { getTodayISO, formatIndiaDate } from "../utils/helpers";

const today = getTodayISO();

const emptySaleForm = () => ({
	date: today,
	vehicle_no: "",
	cages: "",
	birds: "",
	total_weight: "",
	empty_weight: "",
	load_weight: "",
});

const computeNetWeight = (load, empty) => {
	const loadValue = Number(load || 0);
	const emptyValue = Number(empty || 0);
	const diff = loadValue - emptyValue;
	if (!Number.isFinite(diff) || diff <= 0) return "";
	return (Math.round(diff * 1000) / 1000).toString();
};

export default function Sales() {
	const { flocks } = useFlocks();
	const activeFlocks = useMemo(() => flocks.filter((f) => f.status === "active"), [flocks]);
	const [selectedBatch, setSelectedBatch] = useState("");
	const [records, setRecords] = useState([]);
	const [summary, setSummary] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState(emptySaleForm);
	const [editingSale, setEditingSale] = useState(null);
	const [editForm, setEditForm] = useState(emptySaleForm);
	const [savingEdit, setSavingEdit] = useState(false);

	const selectedFlock = useMemo(
		() => flocks.find((f) => f.batch_no === selectedBatch),
		[flocks, selectedBatch]
	);
	const isSelectedActive = selectedFlock?.status === "active";

	const saleStats = useMemo(() => {
		if (!records.length) {
			return { totalBirds: 0, totalWeight: 0, avgPerBird: 0 };
		}
		const totals = records.reduce(
			(acc, sale) => {
				const birds = Number(sale.birds || 0);
				const weight = Number(sale.total_weight || 0);
				return {
					totalBirds: acc.totalBirds + (Number.isFinite(birds) ? birds : 0),
					totalWeight: acc.totalWeight + (Number.isFinite(weight) ? weight : 0),
				};
			},
			{ totalBirds: 0, totalWeight: 0 }
		);
		const avgPerBird = totals.totalBirds > 0 ? totals.totalWeight / totals.totalBirds : 0;
		return { ...totals, avgPerBird };
	}, [records]);

	const fetchSales = async (batch_no) => {
		if (!batch_no) return;
		setLoading(true);
		setError("");
		try {
			const [list, stats] = await Promise.all([
				salesApi.list({ batch_no }),
				salesApi.remaining(batch_no),
			]);
			setRecords(list);
			setSummary(stats);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load sales data");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// Prefer an active batch; if none exist, fall back to latest flock
		if (!selectedBatch) {
			if (activeFlocks.length > 0) {
				setSelectedBatch(activeFlocks[0].batch_no);
			} else if (flocks.length > 0) {
				setSelectedBatch(flocks[0].batch_no);
			}
			return;
		}
		if (!activeFlocks.length) return;
		if (!activeFlocks.some((f) => f.batch_no === selectedBatch)) {
			setSelectedBatch(activeFlocks[0].batch_no);
		}
	}, [activeFlocks, flocks, selectedBatch]);

	useEffect(() => {
		if (selectedBatch) fetchSales(selectedBatch);
	}, [selectedBatch]);

	useEffect(() => {
		setEditingSale(null);
		setEditForm(emptySaleForm());
	}, [selectedBatch]);

	const buildFormChangeHandler = (setter) => (e) => {
		const { name, value } = e.target;
		setter((prev) => {
			const next = { ...prev, [name]: value };
			if (name === "load_weight" || name === "empty_weight") {
				next.total_weight = computeNetWeight(next.load_weight, next.empty_weight);
			}
			return next;
		});
	};

	const onChange = buildFormChangeHandler(setForm);

	const onSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!selectedBatch) {
			setError("Select a batch first");
			return;
		}
		if (!isSelectedActive) {
			setError("Sales cannot be added for a closed batch.");
			return;
		}
		const cagesValue = Number(form.cages || 0);
		const birdsValue = Number(form.birds || 0);
		const emptyWeightValue = Number(form.empty_weight || 0);
		const loadWeightValue = Number(form.load_weight || 0);
		const netWeightValue = Math.round((loadWeightValue - emptyWeightValue) * 1000) / 1000;
		if (!Number.isFinite(emptyWeightValue) || emptyWeightValue < 0) {
			setError("Empty weight must be zero or more.");
			return;
		}
		if (!Number.isFinite(loadWeightValue) || loadWeightValue <= 0) {
			setError("Load weight must be greater than zero.");
			return;
		}
		if (netWeightValue <= 0) {
			setError("Load weight must be greater than empty weight.");
			return;
		}
		if (!Number.isFinite(cagesValue) || cagesValue < 0) {
			setError("Cages must be zero or more.");
			return;
		}
		if (!Number.isFinite(birdsValue) || birdsValue <= 0) {
			setError("Birds must be greater than zero.");
			return;
		}
		setSaving(true);
		try {
			await salesApi.create({
				batch_no: selectedBatch,
				date: form.date,
				vehicle_no: form.vehicle_no,
				cages: cagesValue,
				birds: birdsValue,
				empty_weight: emptyWeightValue,
				load_weight: loadWeightValue,
				total_weight: netWeightValue,
			});
			setSuccess("Sale recorded.");
			setForm(emptySaleForm());
			fetchSales(selectedBatch);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save sale");
		} finally {
			setSaving(false);
		}
	};

	const onEditChange = buildFormChangeHandler(setEditForm);

	const startEdit = (sale) => {
		if (!isSelectedActive) {
			setError("Sales for closed batches cannot be edited.");
			setSuccess("");
			return;
		}
		setEditingSale(sale);
		const normalizedEmpty =
			sale.empty_weight === undefined || sale.empty_weight === null
				? null
				: Number(sale.empty_weight);
		const normalizedLoad =
			sale.load_weight === undefined || sale.load_weight === null
				? sale.total_weight != null && normalizedEmpty != null
					? Number(sale.total_weight) + normalizedEmpty
					: sale.total_weight != null
					? Number(sale.total_weight)
					: null
				: Number(sale.load_weight);
		const emptyFieldValue = normalizedEmpty == null ? "" : normalizedEmpty.toString();
		const loadFieldValue = normalizedLoad == null ? "" : normalizedLoad.toString();
		const netWeightDisplay =
			computeNetWeight(normalizedLoad, normalizedEmpty) || sale.total_weight?.toString() || "";
		setEditForm({
			date: formatIndiaDate(sale.date) || today,
			vehicle_no: sale.vehicle_no || "",
			cages: sale.cages?.toString() || "0",
			birds: sale.birds?.toString() || "0",
			empty_weight: emptyFieldValue,
			load_weight: loadFieldValue,
			total_weight: netWeightDisplay,
		});
		setError("");
		setSuccess("");
	};

	const cancelEdit = () => {
		setEditingSale(null);
		setEditForm(emptySaleForm());
	};

	const parseNumber = (value) => Number(value || 0);

	const onEditSubmit = async (e) => {
		e.preventDefault();
		if (!editingSale) return;
		setError("");
		setSuccess("");
		const cagesValue = parseNumber(editForm.cages);
		const birdsValue = parseNumber(editForm.birds);
		const emptyWeightValue = Number(editForm.empty_weight || 0);
		const loadWeightValue = Number(editForm.load_weight || 0);
		const netWeightValue = Math.round((loadWeightValue - emptyWeightValue) * 1000) / 1000;
		if (!Number.isFinite(emptyWeightValue) || emptyWeightValue < 0) {
			setError("Empty weight must be zero or more.");
			return;
		}
		if (!Number.isFinite(loadWeightValue) || loadWeightValue <= 0) {
			setError("Load weight must be greater than zero.");
			return;
		}
		if (netWeightValue <= 0) {
			setError("Load weight must be greater than empty weight.");
			return;
		}
		if (!Number.isFinite(cagesValue) || cagesValue < 0) {
			setError("Cages must be zero or more.");
			return;
		}
		if (!Number.isFinite(birdsValue) || birdsValue <= 0) {
			setError("Birds must be greater than zero.");
			return;
		}
		setSavingEdit(true);
		try {
			await salesApi.update(editingSale._id, {
				date: editForm.date,
				vehicle_no: editForm.vehicle_no,
				cages: cagesValue,
				birds: birdsValue,
				empty_weight: emptyWeightValue,
				load_weight: loadWeightValue,
				total_weight: netWeightValue,
			});
			setSuccess("Sale entry updated.");
			const batchNo = selectedBatch || editingSale.batch_no;
			cancelEdit();
			fetchSales(batchNo);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to update sale");
		} finally {
			setSavingEdit(false);
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
					{(activeFlocks.length > 0 ? activeFlocks : flocks).map((f) => (
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
						<span>Empty weight (kg)</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="empty_weight"
							value={form.empty_weight}
							onChange={onChange}
						/>
					</label>
					<label>
						<span>Load weight (kg)</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="load_weight"
							value={form.load_weight}
							onChange={onChange}
						/>
					</label>
					<label>
						<span>Total weight (kg)</span>
						<input
							type="number"
							min="0"
							step="0.01"
							name="total_weight"
							value={form.total_weight}
							readOnly
						/>
					</label>
					<div className="grid-full">
						<button type="submit" disabled={!isSelectedActive || saving}>
							{saving ? "Saving..." : "Save sale"}
						</button>
					</div>
				</form>
			</div>

			{editingSale && (
				<div className="card mt">
					<div className="card-header">
						<h2>Edit sale record</h2>
						<div className="stat-pill">{formatIndiaDate(editingSale?.date) || "--"}</div>
					</div>
					<form className="grid-3" onSubmit={onEditSubmit}>
						<label>
							<span>Date</span>
							<input type="date" name="date" max={today} value={editForm.date} onChange={onEditChange} />
						</label>
						<label>
							<span>Vehicle no.</span>
							<input name="vehicle_no" value={editForm.vehicle_no} onChange={onEditChange} />
						</label>
						<label>
							<span>Cages</span>
							<input type="number" min="0" name="cages" value={editForm.cages} onChange={onEditChange} />
						</label>
						<label>
							<span>Birds</span>
							<input type="number" min="0" name="birds" value={editForm.birds} onChange={onEditChange} />
						</label>
						<label>
							<span>Empty weight (kg)</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="empty_weight"
								value={editForm.empty_weight}
								onChange={onEditChange}
							/>
						</label>
						<label>
							<span>Load weight (kg)</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="load_weight"
								value={editForm.load_weight}
								onChange={onEditChange}
							/>
						</label>
						<label>
							<span>Total weight (kg)</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="total_weight"
								value={editForm.total_weight}
								readOnly
							/>
						</label>
						<div className="grid-full" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
							<button type="submit" disabled={!isSelectedActive || savingEdit}>
								{savingEdit ? "Saving..." : "Update sale"}
							</button>
							<button type="button" className="ghost" onClick={cancelEdit}>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

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
								<th>Avg weight/bird (kg)</th>
								<th>Age (days)</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{records.length === 0 && (
								<tr>
									<td colSpan="8" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No sale entries"}
									</td>
								</tr>
							)}
							{records.map((sale) => {
								const avgWeight = Number(sale.birds) > 0
									? Number(sale.total_weight || 0) / Number(sale.birds || 1)
									: 0;
								let ageDisplay = "-";
								if (selectedFlock?.start_date && sale.date) {
									const start = new Date(selectedFlock.start_date);
									const saleDate = new Date(sale.date);
									if (!Number.isNaN(start.getTime()) && !Number.isNaN(saleDate.getTime())) {
										// Normalize to midnight for whole-day difference
										start.setHours(0, 0, 0, 0);
										saleDate.setHours(0, 0, 0, 0);
										const diffMs = saleDate.getTime() - start.getTime();
										const dayMs = 1000 * 60 * 60 * 24;
										const days = diffMs / dayMs;
										if (Number.isFinite(days) && days >= 0) {
											// Age should be 1 on chick-in day, so add 1
											const ageDays = Math.floor(days) + 1;
											ageDisplay = ageDays.toString();
										}
									}
								}
								return (
									<tr key={sale._id}>
										<td>{formatIndiaDate(sale.date)}</td>
										<td>{sale.vehicle_no || "-"}</td>
										<td>{sale.cages}</td>
										<td>{sale.birds}</td>
										<td>{sale.total_weight}</td>
										<td>{avgWeight ? avgWeight.toFixed(3) : "-"}</td>
										<td>{ageDisplay}</td>
										<td>
											{isSelectedActive && (
												<button type="button" className="link" onClick={() => startEdit(sale)}>
													Edit
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<div className="card mt">
				<h2>Sales summary</h2>
				<div className="stat-grid">
					<div className="stat-card">
						<span>Total birds sold</span>
						<strong>{saleStats.totalBirds}</strong>
					</div>
					<div className="stat-card">
						<span>Total weight sold (kg)</span>
						<strong>{saleStats.totalWeight > 0 ? saleStats.totalWeight.toFixed(3) : "-"}</strong>
					</div>
					<div className="stat-card">
						<span>Avg weight per bird (kg)</span>
						<strong>{saleStats.totalBirds > 0 ? saleStats.avgPerBird.toFixed(3) : "-"}</strong>
					</div>
				</div>
			</div>
		</div>
	);
}
