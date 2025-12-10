import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { monitoringApi, reportApi } from "../services/api";
import { getTodayISO, formatIndiaDate } from "../utils/helpers";

const today = getTodayISO();

const createDefaultDailyForm = (dateValue = today) => ({
	date: dateValue,
	mortality: "",
	feedBags: "",
	kgPerBag: "60",
	avgWeight: "",
});

const getRowDate = (row) => {
	if (!row) return "";
	if (row.date) return row.date;
	if (row.dateIso) return formatIndiaDate(row.dateIso);
	return "";
};

const computeFeedKg = (bags, kgPerBag) => {
	const total = Number(bags || 0) * Number(kgPerBag || 0);
	if (!Number.isFinite(total)) return "0";
	return (Math.round(total * 100) / 100).toFixed(2);
};

const formatFeedPerBird = (value) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return num.toFixed(3);
};

const formatFeedBags = (kgValue) => {
	const num = Number(kgValue);
	if (!Number.isFinite(num)) return "-";
	return (num / 60).toFixed(2);
};

export default function DailyMonitoring() {
	const { flocks } = useFlocks();
	const activeFlocks = useMemo(() => flocks.filter((f) => f.status === "active"), [flocks]);
	const [selectedBatch, setSelectedBatch] = useState("");
	const [form, setForm] = useState(() => createDefaultDailyForm());
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const emptyEditForm = {
		mortality: "",
		feedBags: "",
		kgPerBag: "",
		avgWeight: "",
	};
	const [editingRow, setEditingRow] = useState(null);
	const [editForm, setEditForm] = useState(emptyEditForm);
	const [savingEdit, setSavingEdit] = useState(false);

	const [reportRows, setReportRows] = useState([]);
	const [reportSummary, setReportSummary] = useState(null);
	const [reportLoading, setReportLoading] = useState(false);
	const [reportMeta, setReportMeta] = useState(null);

	const selectedFlock = useMemo(
		() => flocks.find((f) => f.batch_no === selectedBatch),
		[flocks, selectedBatch]
	);
	const isSelectedActive = selectedFlock?.status === "active";
	const batchStartDate = useMemo(() => {
		if (!selectedFlock?.start_date) return "";
		return formatIndiaDate(selectedFlock.start_date);
	}, [selectedFlock]);

	const nextRequiredDate = reportMeta?.nextRequiredDate || "";
	const entriesUpToDate = Boolean(reportMeta?.dailyCompleteThroughToday);

	useEffect(() => {
		// If there is an active batch, prefer it; otherwise fall back to latest flock
		if (!selectedBatch) {
			if (activeFlocks.length > 0) {
				setSelectedBatch(activeFlocks[0].batch_no);
			} else if (flocks.length > 0) {
				setSelectedBatch(flocks[0].batch_no);
			}
			return;
		}
		// If we already have a selection and it becomes inactive but another active batch exists,
		// automatically move view to the first active batch.
		if (!activeFlocks.length) return;
		if (!activeFlocks.some((f) => f.batch_no === selectedBatch)) {
			setSelectedBatch(activeFlocks[0].batch_no);
		}
	}, [activeFlocks, flocks, selectedBatch]);

	useEffect(() => {
		setForm((prev) => {
			const minDate = batchStartDate || "";
			let nextDate = prev.date || today;
			if (minDate && nextDate < minDate) nextDate = minDate;
			if (nextDate > today) nextDate = today;
			if (nextDate === prev.date) return prev;
			return { ...prev, date: nextDate };
		});
	}, [batchStartDate]);

	useEffect(() => {
		if (nextRequiredDate) {
			setForm((prev) => ({ ...prev, date: nextRequiredDate }));
		} else if (selectedBatch) {
			setForm((prev) => ({ ...prev, date: today }));
		}
	}, [nextRequiredDate, selectedBatch]);

	const onChange = (e) => {
		const { name, value } = e.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const loadReport = async (batch_no) => {
		if (!batch_no) return;
		setReportLoading(true);
		setError("");
		try {
			const data = await reportApi.current({ batch_no });
			setReportRows(data.rows || []);
			setReportSummary(data.summary || null);
			setReportMeta(data.meta || null);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load report");
			setReportMeta(null);
		} finally {
			setReportLoading(false);
		}
	};

	useEffect(() => {
		if (selectedBatch) loadReport(selectedBatch);
	}, [selectedBatch]);

	useEffect(() => {
		setEditingRow(null);
		setEditForm(emptyEditForm);
		setReportMeta(null);
	}, [selectedBatch]);

	const hasEntryForSelectedDate = useMemo(() => {
		if (!form.date) return false;
		return reportRows.some((row) => getRowDate(row) === form.date);
	}, [reportRows, form.date]);

	const dateOutOfRange = useMemo(() => {
		if (!form.date) return false;
		if (batchStartDate && form.date < batchStartDate) return true;
		if (form.date > today) return true;
		return false;
	}, [batchStartDate, form.date]);

	const onSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!selectedBatch) {
			setError("Select a batch first");
			return;
		}
		if (!isSelectedActive) {
			setError("Daily entries cannot be added for a closed batch.");
			return;
		}
		if (!form.date) {
			setError("Pick a date for the entry.");
			return;
		}
		if (dateOutOfRange) {
			const from = batchStartDate || "the chick-in date";
			setError(`Date must be between ${from} and ${today}.`);
			return;
		}
		if (hasEntryForSelectedDate) {
			setError("An entry for this date already exists. Use the edit option instead.");
			return;
		}
		setSaving(true);
		try {
			const totalFeedKg = Number(computeFeedKg(form.feedBags, form.kgPerBag));
			await monitoringApi.create({
				batch_no: selectedBatch,
				date: form.date,
				mortality: Number(form.mortality || 0),
				feedBags: Number(form.feedBags || 0),
				kgPerBag: Number(form.kgPerBag || 0),
				feedKg: totalFeedKg,
				avgWeight: Number(form.avgWeight || 0),
			});
			setSuccess("Daily entry saved.");
			setForm((prev) => ({
				...prev,
				mortality: "",
				feedBags: "",
				kgPerBag: prev.kgPerBag || "60",
				avgWeight: "",
			}));
			loadReport(selectedBatch);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save entry");
		} finally {
			setSaving(false);
		}
	};

	const remainingChicks = useMemo(() => reportSummary?.remainingChicks ?? 0, [reportSummary]);

	const startEdit = (row) => {
		setEditingRow(row);
		setEditForm({
			mortality: row.mortality?.toString() || "0",
			feedBags: row.feedBags?.toString() || "0",
			kgPerBag: row.kgPerBag?.toString() || "0",
			avgWeight: row.avgWeight === null || row.avgWeight === undefined ? "0" : row.avgWeight.toString(),
		});
		setError("");
		setSuccess("");
	};

	const cancelEdit = () => {
		setEditingRow(null);
		setEditForm(emptyEditForm);
	};

	const onEditChange = (e) => {
		const { name, value } = e.target;
		setEditForm((prev) => ({ ...prev, [name]: value }));
	};

	const toNumber = (value) => Number(value || 0);

	const onEditSubmit = async (e) => {
		e.preventDefault();
		if (!editingRow) return;
		if (!isSelectedActive) {
			setError("Daily entries for closed batches cannot be edited.");
			return;
		}
		setSavingEdit(true);
		setError("");
		setSuccess("");
		try {
			const totalFeedKg = Number(computeFeedKg(editForm.feedBags, editForm.kgPerBag));
			await monitoringApi.update(editingRow._id, {
				mortality: toNumber(editForm.mortality),
				feedBags: toNumber(editForm.feedBags),
				kgPerBag: toNumber(editForm.kgPerBag),
				feedKg: totalFeedKg,
				avgWeight: toNumber(editForm.avgWeight),
			});
			setSuccess("Daily entry updated.");
			cancelEdit();
			loadReport(selectedBatch);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to update entry");
		} finally {
			setSavingEdit(false);
		}
	};

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Daily monitoring</h1>
					<p>Capture age-wise mortality, feed intake, and weight.</p>
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

			{error && <div className="error mb">{error}</div>}
			{success && <div className="success mb">{success}</div>}

			<div className="card">
				<h2>Add daily record</h2>
				<form className="grid-3" onSubmit={onSubmit}>
					<label>
						<span>Date</span>
						<input
							type="date"
							name="date"
							min={batchStartDate || undefined}
							max={today}
							value={form.date}
							onChange={onChange}
						/>
						{batchStartDate && (
							<small style={{ display: "block", marginTop: "0.35rem", color: "#555" }}>
								Allowed range: {batchStartDate} – {today}
							</small>
						)}
					</label>
					<label>
						<span>Mortality</span>
						<input type="number" min="0" name="mortality" value={form.mortality} onChange={onChange} />
					</label>
					<label>
						<span>Feed bags</span>
						<input type="number" min="0" step="0.01" name="feedBags" value={form.feedBags} onChange={onChange} />
					</label>
					<label>
						<span>Kg per bag</span>
						<input type="number" min="0" step="0.01" name="kgPerBag" value={form.kgPerBag} onChange={onChange} />
					</label>
					<label>
						<span>Average weight (kg)</span>
						<input type="number" min="0" step="0.01" name="avgWeight" value={form.avgWeight} onChange={onChange} />
					</label>
					<div className="grid-full">
						<button
							type="submit"
							disabled={!isSelectedActive || saving || dateOutOfRange || hasEntryForSelectedDate}
						>
							{saving ? "Saving..." : "Save entry"}
						</button>
					</div>
				</form>
				{hasEntryForSelectedDate && (
					<div className="info mt">Entry already logged for this date. Use edit below to make changes.</div>
				)}
				{dateOutOfRange && (
					<div className="error mt">Date must be between the batch start date and today.</div>
				)}
			</div>

			{editingRow && (
				<div className="card mt">
					<div className="card-header">
						<h2>Edit daily record</h2>
						<div className="stat-pill">{getRowDate(editingRow)}</div>
					</div>
					<form className="grid-3" onSubmit={onEditSubmit}>
						<label>
							<span>Mortality</span>
							<input type="number" min="0" name="mortality" value={editForm.mortality} onChange={onEditChange} />
						</label>
						<label>
							<span>Feed bags</span>
							<input type="number" min="0" step="0.01" name="feedBags" value={editForm.feedBags} onChange={onEditChange} />
						</label>
						<label>
							<span>Kg per bag</span>
							<input type="number" min="0" step="0.01" name="kgPerBag" value={editForm.kgPerBag} onChange={onEditChange} />
						</label>
						<label>
							<span>Average weight (kg)</span>
							<input type="number" min="0" step="0.01" name="avgWeight" value={editForm.avgWeight} onChange={onEditChange} />
						</label>
						<div className="grid-full" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
							<button type="submit" disabled={!isSelectedActive || savingEdit}>
								{savingEdit ? "Saving..." : "Update entry"}
							</button>
							<button type="button" className="ghost" onClick={cancelEdit}>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

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
								<th>Cum mort</th>
								<th>Feed bags</th>
								<th>Cum feed bags</th>
								<th>Feed/bird</th>
								<th>Cum feed/bird</th>
								<th>Avg weight</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{reportRows.length === 0 && (
								<tr>
									<td colSpan="10" style={{ textAlign: "center" }}>
										{reportLoading ? "Loading report..." : "No records yet"}
									</td>
								</tr>
							)}
							{reportRows.map((row) => {
								const displayDate = getRowDate(row) || row.date || "";
								const key = row._id || `${displayDate}-${row.age}`;
								return (
									<tr key={key}>
										<td>{displayDate}</td>
										<td>{row.age}</td>
										<td>{row.mortality}</td>
										<td>
											{row.cumulativeMortality} ({row.mortalityPercent}% )
										</td>
										<td>{formatFeedBags(row.feedKg)}</td>
										<td>{formatFeedBags(row.cumulativeFeedKg)}</td>
										<td>{formatFeedPerBird(row.feedPerBird)}</td>
										<td>{formatFeedPerBird(row.cumulativeFeedPerBird)}</td>
										<td>{row.avgWeight ?? "-"}</td>
										<td>
											{isSelectedActive && (
												<button type="button" className="link" onClick={() => startEdit(row)}>
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
		</div>
	);
}
