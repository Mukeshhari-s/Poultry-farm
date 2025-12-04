import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { feedApi } from "../services/api";
import { createBatchLabelMap } from "../utils/helpers";

const today = new Date().toISOString().slice(0, 10);

const defaultInForm = {
	type: "Starter",
	date: today,
	bagsIn: "",
	kgIn: "",
	flockId: "",
};

const defaultOutForm = {
	type: "Starter",
	date: today,
	kgOut: "",
	flockId: "",
};

export default function Feed() {
	const { flocks } = useFlocks();
	const batchLabelMap = useMemo(() => createBatchLabelMap(flocks), [flocks]);
	const [selectedFlock, setSelectedFlock] = useState("");
	const [feedLogs, setFeedLogs] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const [feedInForm, setFeedInForm] = useState(defaultInForm);
	const [feedOutForm, setFeedOutForm] = useState(defaultOutForm);
	const [savingIn, setSavingIn] = useState(false);
	const [savingOut, setSavingOut] = useState(false);
	const [editingFeed, setEditingFeed] = useState(null);
	const [editFeedForm, setEditFeedForm] = useState({
		id: "",
		entryType: "in",
		date: today,
		type: "",
		bagsIn: "",
		kgIn: "",
		kgOut: "",
		flockId: "",
	});
	const [savingEdit, setSavingEdit] = useState(false);

	const fetchFeed = async (flockId = "") => {
		setLoading(true);
		setError("");
		try {
			const list = await feedApi.list(flockId ? { flockId } : {});
			setFeedLogs(list);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load feed records");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFeed(selectedFlock);
	}, [selectedFlock]);

	useEffect(() => {
		setFeedInForm((prev) => ({ ...prev, flockId: selectedFlock }));
		setFeedOutForm((prev) => ({ ...prev, flockId: selectedFlock }));
	}, [selectedFlock]);

	const onFeedInSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!feedInForm.flockId) {
			setError("Select a batch for feed in.");
			return;
		}
		if (!feedInForm.type) {
			setError("Feed type required.");
			return;
		}
		if (!feedInForm.bagsIn && !feedInForm.kgIn) {
			setError("Provide bags or kg for feed in.");
			return;
		}
		setSavingIn(true);
		try {
			await feedApi.addIn({
				...feedInForm,
				bagsIn: feedInForm.bagsIn ? Number(feedInForm.bagsIn) : 0,
				kgIn: feedInForm.kgIn ? Number(feedInForm.kgIn) : 0,
			});
			setSuccess("Feed-in recorded.");
			setFeedInForm((prev) => ({ ...defaultInForm, flockId: prev.flockId || selectedFlock }));
			fetchFeed(selectedFlock || feedInForm.flockId);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save feed in");
		} finally {
			setSavingIn(false);
		}
	};

	const onFeedOutSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setSuccess("");
		if (!feedOutForm.flockId) {
			setError("Select a batch for feed out.");
			return;
		}
		if (!feedOutForm.type || !feedOutForm.kgOut) {
			setError("Feed type and kg out are required.");
			return;
		}
		setSavingOut(true);
		try {
			await feedApi.addOut({
				...feedOutForm,
				kgOut: Number(feedOutForm.kgOut),
			});
			setSuccess("Feed-out recorded.");
			setFeedOutForm((prev) => ({ ...defaultOutForm, flockId: prev.flockId || selectedFlock }));
			fetchFeed(selectedFlock || feedOutForm.flockId);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save feed out");
		} finally {
			setSavingOut(false);
		}
	};

	const flockOptions = (
		<select value={selectedFlock} onChange={(e) => setSelectedFlock(e.target.value)}>
			<option value="">All batches</option>
			{flocks.map((f) => (
				<option key={f._id} value={f._id}>
					{f.displayLabel || f.batch_no || f._id}
				</option>
			))}
		</select>
	);

	const onEditFeed = (log) => {
		const entryType = log.kgOut && Number(log.kgOut) > 0 ? "out" : "in";
		setEditingFeed(log);
		setEditFeedForm({
			id: log._id,
			entryType,
			date: log.date?.slice(0, 10) || today,
			type: log.type || "",
			bagsIn: log.bagsIn?.toString() || "",
			kgIn: log.kgIn?.toString() || "",
			kgOut: log.kgOut?.toString() || "",
			flockId: log.flockId || selectedFlock || "",
		});
		setError("");
		setSuccess("");
	};

	const cancelFeedEdit = () => {
		setEditingFeed(null);
	};

	const onFeedEditSubmit = async (e) => {
		e.preventDefault();
		if (!editingFeed) return;
		setSavingEdit(true);
		setError("");
		setSuccess("");
		try {
			const payload = {
				type: editFeedForm.type,
				date: editFeedForm.date,
				flockId: editFeedForm.flockId,
			};
			if (editFeedForm.entryType === "in") {
				payload.bagsIn = editFeedForm.bagsIn ? Number(editFeedForm.bagsIn) : 0;
				payload.kgIn = editFeedForm.kgIn ? Number(editFeedForm.kgIn) : 0;
				payload.kgOut = 0;
			} else {
				payload.kgOut = editFeedForm.kgOut ? Number(editFeedForm.kgOut) : 0;
				payload.bagsIn = 0;
				payload.kgIn = 0;
			}
			await feedApi.update(editFeedForm.id, payload);
			setSuccess("Feed entry updated.");
			setEditingFeed(null);
			fetchFeed(selectedFlock);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to update feed entry");
		} finally {
			setSavingEdit(false);
		}
	};

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Feed Management</h1>
					<p>Track feed stock entering and leaving the farm.</p>
				</div>
				<div className="filters">{flockOptions}</div>
			</div>

			{error && <div className="error mb">{error}</div>}
			{success && <div className="success mb">{success}</div>}

			{editingFeed && (
				<div className="card">
					<h2>Edit feed entry</h2>
					<form className="grid-2" onSubmit={onFeedEditSubmit}>
						<label>
							<span>Entry type</span>
							<input value={editFeedForm.entryType === "in" ? "Feed in" : "Feed out"} disabled />
						</label>
						<label>
							<span>Batch</span>
							<select value={editFeedForm.flockId} onChange={(e) => setEditFeedForm({ ...editFeedForm, flockId: e.target.value })}>
								<option value="">Select batch</option>
								{flocks.map((f) => (
									<option key={f._id} value={f._id}>
										{f.displayLabel || f.batch_no || f._id}
									</option>
								))}
							</select>
						</label>
						<label>
							<span>Date</span>
							<input
								type="date"
								max={today}
								value={editFeedForm.date}
								onChange={(e) => setEditFeedForm({ ...editFeedForm, date: e.target.value })}
							/>
						</label>
						<label>
							<span>Feed type</span>
							<input value={editFeedForm.type} onChange={(e) => setEditFeedForm({ ...editFeedForm, type: e.target.value })} />
						</label>
						{editFeedForm.entryType === "in" ? (
							<>
								<label>
									<span>Total bags</span>
									<input
										type="number"
										min="0"
										value={editFeedForm.bagsIn}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, bagsIn: e.target.value })}
									/>
								</label>
								<label>
									<span>Total kg</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={editFeedForm.kgIn}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, kgIn: e.target.value })}
									/>
								</label>
							</>
						) : (
							<label>
								<span>Kg used</span>
								<input
									type="number"
									min="0"
									step="0.01"
									value={editFeedForm.kgOut}
									onChange={(e) => setEditFeedForm({ ...editFeedForm, kgOut: e.target.value })}
								/>
							</label>
						)}
						<div className="grid-full" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
							<button type="submit" disabled={savingEdit}>
								{savingEdit ? "Saving..." : "Update entry"}
							</button>
							<button type="button" className="ghost" onClick={cancelFeedEdit}>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className="grid-2 gap">
				<div className="card">
					<h2>Feed in</h2>
					<form onSubmit={onFeedInSubmit} className="grid-2">
						<label>
							<span>Batch</span>
							<select
								name="flockId"
								value={feedInForm.flockId}
								onChange={(e) => setFeedInForm({ ...feedInForm, flockId: e.target.value })}
							>
								<option value="">Select batch</option>
								{flocks.map((f) => (
									<option key={f._id} value={f._id}>
										{f.displayLabel || f.batch_no || f._id}
									</option>
								))}
							</select>
						</label>
						<label>
							<span>Date</span>
							<input
								type="date"
								name="date"
								max={today}
								value={feedInForm.date}
								onChange={(e) => setFeedInForm({ ...feedInForm, date: e.target.value })}
							/>
						</label>
						<label>
							<span>Feed type</span>
							<input
								name="type"
								value={feedInForm.type}
								onChange={(e) => setFeedInForm({ ...feedInForm, type: e.target.value })}
							/>
						</label>
						<label>
							<span>Total bags</span>
							<input
								type="number"
								min="0"
								name="bagsIn"
								value={feedInForm.bagsIn}
								onChange={(e) => setFeedInForm({ ...feedInForm, bagsIn: e.target.value })}
							/>
						</label>
						<label>
							<span>Total kg</span>
							<input
								type="number"
								min="0"
								name="kgIn"
								value={feedInForm.kgIn}
								onChange={(e) => setFeedInForm({ ...feedInForm, kgIn: e.target.value })}
							/>
						</label>
						<div className="grid-full">
							<button type="submit" disabled={savingIn}>
								{savingIn ? "Saving..." : "Record feed in"}
							</button>
						</div>
					</form>
				</div>

				<div className="card">
					<h2>Feed out</h2>
					<form onSubmit={onFeedOutSubmit} className="grid-2">
						<label>
							<span>Batch</span>
							<select
								name="flockId"
								value={feedOutForm.flockId}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, flockId: e.target.value })}
							>
								<option value="">Select batch</option>
								{flocks.map((f) => (
									<option key={f._id} value={f._id}>
										{f.displayLabel || f.batch_no || f._id}
									</option>
								))}
							</select>
						</label>
						<label>
							<span>Date</span>
							<input
								type="date"
								name="date"
								max={today}
								value={feedOutForm.date}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, date: e.target.value })}
							/>
						</label>
						<label>
							<span>Feed type</span>
							<input
								name="type"
								value={feedOutForm.type}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, type: e.target.value })}
							/>
						</label>
						<label>
							<span>Kg used</span>
							<input
								type="number"
								min="0"
								name="kgOut"
								value={feedOutForm.kgOut}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, kgOut: e.target.value })}
							/>
						</label>
						<div className="grid-full">
							<button type="submit" disabled={savingOut}>
								{savingOut ? "Saving..." : "Record feed out"}
							</button>
						</div>
					</form>
				</div>
			</div>

			<div className="card mt">
				<h2>Feed log</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Type</th>
								<th>Bags in</th>
								<th>Kg in</th>
								<th>Kg out</th>
								<th>Batch</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{feedLogs.length === 0 && (
								<tr>
									<td colSpan="7" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No feed entries"}
									</td>
								</tr>
							)}
							{feedLogs.map((log) => {
								const batchLabel = batchLabelMap[log.flockId] || batchLabelMap[log.batch_no];
								return (
								<tr key={log._id}>
									<td>{log.date?.slice(0, 10)}</td>
									<td>{log.type}</td>
									<td>{log.bagsIn || "-"}</td>
									<td>{log.kgIn || "-"}</td>
									<td>{log.kgOut || "-"}</td>
									<td>{batchLabel || "-"}</td>
									<td>
										<button type="button" className="link" onClick={() => onEditFeed(log)}>
											Edit
										</button>
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
