import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { feedApi } from "../services/api";
import { createBatchLabelMap, getTodayISO, formatIndiaDate } from "../utils/helpers";

const today = getTodayISO();
const FEED_TYPE_CHOICES = ["BPS 1", "BS 2", "BF 3"];
const DEFAULT_KG_PER_BAG = 60;

const isDailyUsageLog = (log = {}) => {
	const typeKey = (log.typeKey || "").toLowerCase();
	const typeValue = (log.type || "").toLowerCase();
	return Boolean(log.dailyRecord) || typeKey === "daily usage" || typeValue === "daily usage";
};

const filterFeedLogs = (logs = []) => logs.filter((log) => !isDailyUsageLog(log));

const formatBagsFromKg = (kgValue) => {
	const numeric = Number(kgValue);
	if (!Number.isFinite(numeric)) return "-";
	return (numeric / DEFAULT_KG_PER_BAG).toFixed(2);
};

const calculateAvailableFeed = (logs, flockId) => {
	return logs.reduce((acc, log) => {
		const logFlockId = log.flockId ? String(log.flockId) : "";
		if (flockId && logFlockId !== String(flockId)) return acc;
		const inKg = Number(log.kgIn || 0);
		const outKg = Number(log.kgOut || 0);
		return acc + inKg - outKg;
	}, 0);
};

const defaultInForm = {
	type: FEED_TYPE_CHOICES[0],
	date: today,
	bagsIn: "",
	kgPerBag: "60",
	unitPrice: "",
	flockId: "",
};

const defaultOutForm = {
	type: FEED_TYPE_CHOICES[0],
	date: today,
	bagsOut: "",
	kgPerBag: "60",
	unitPrice: "",
	flockId: "",
};

export default function Feed() {
	const { flocks } = useFlocks();
	const batchLabelMap = useMemo(() => createBatchLabelMap(flocks), [flocks]);
	const batchNoToFlockId = useMemo(() => {
		const map = {};
		flocks.forEach((flock) => {
			if (flock?.batch_no !== undefined && flock?.batch_no !== null) {
				map[String(flock.batch_no)] = flock._id;
			}
		});
		return map;
	}, [flocks]);
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
		kgPerBag: "",
		bagsOut: "",
		unitPrice: "",
		flockId: "",
	});
	const [savingEdit, setSavingEdit] = useState(false);
	const feedOutAvailable = useMemo(
		() => calculateAvailableFeed(feedLogs, feedOutForm.flockId),
		[feedLogs, feedOutForm.flockId]
	);
	const cumulativeFeedStats = useMemo(() => {
		const totals = feedLogs.reduce(
			(acc, log) => {
				const kgIn = Number(log.kgIn || 0);
				const kgOut = Number(log.kgOut || 0);
				const cost = Number(log.totalCost || 0);
				if (kgIn > 0) {
					acc.totalInEntries += 1;
					acc.totalInKg += kgIn;
					acc.totalInCost += cost;
				}
				if (kgOut > 0) {
					acc.totalOutEntries += 1;
					acc.totalOutKg += kgOut;
					acc.totalOutCost += cost;
				}
				return acc;
			},
			{
				totalInEntries: 0,
				totalInKg: 0,
				totalInCost: 0,
				totalOutEntries: 0,
				totalOutKg: 0,
				totalOutCost: 0,
			}
		);
		const totalInBags = totals.totalInKg / DEFAULT_KG_PER_BAG;
		const totalOutBags = totals.totalOutKg / DEFAULT_KG_PER_BAG;
		const totalAmountDiff = totals.totalInCost - totals.totalOutCost;
		return {
			...totals,
			totalInBags,
			totalOutBags,
			totalAmountDiff,
		};
	}, [feedLogs]);
	const feedInTotalKg = useMemo(() => {
		const total = Number(feedInForm.bagsIn || 0) * Number(feedInForm.kgPerBag || 0);
		if (!Number.isFinite(total)) return 0;
		return Math.round(total * 100) / 100;
	}, [feedInForm.bagsIn, feedInForm.kgPerBag]);
	const feedInTotalBagsDisplay = useMemo(() => {
		const bags = Number(feedInForm.bagsIn || 0);
		if (!Number.isFinite(bags)) return "0.00";
		return bags.toFixed(2);
	}, [feedInForm.bagsIn]);
	const feedInTotalCost = useMemo(() => {
		const cost = feedInTotalKg * Number(feedInForm.unitPrice || 0);
		if (!Number.isFinite(cost) || cost <= 0) return 0;
		return Math.round(cost * 100) / 100;
	}, [feedInTotalKg, feedInForm.unitPrice]);
	const feedOutTotalKg = useMemo(() => {
		const total = Number(feedOutForm.bagsOut || 0) * Number(feedOutForm.kgPerBag || 0);
		if (!Number.isFinite(total)) return 0;
		return Math.round(total * 100) / 100;
	}, [feedOutForm.bagsOut, feedOutForm.kgPerBag]);
	const feedOutTotalBagsDisplay = useMemo(() => {
		const bags = Number(feedOutForm.bagsOut || 0);
		if (!Number.isFinite(bags)) return "0.00";
		return bags.toFixed(2);
	}, [feedOutForm.bagsOut]);
	const feedOutTotalCost = useMemo(() => {
		const cost = feedOutTotalKg * Number(feedOutForm.unitPrice || 0);
		if (!Number.isFinite(cost) || cost <= 0) return 0;
		return Math.round(cost * 100) / 100;
	}, [feedOutTotalKg, feedOutForm.unitPrice]);
	const editFeedTotalKg = useMemo(() => {
		const bags = editFeedForm.entryType === "out" ? editFeedForm.bagsOut : editFeedForm.bagsIn;
		const total = Number(bags || 0) * Number(editFeedForm.kgPerBag || 0);
		if (!Number.isFinite(total)) return 0;
		return Math.round(total * 100) / 100;
	}, [editFeedForm.entryType, editFeedForm.bagsIn, editFeedForm.bagsOut, editFeedForm.kgPerBag]);
	const editFeedTotalCost = useMemo(() => {
		const cost = editFeedTotalKg * Number(editFeedForm.unitPrice || 0);
		if (!Number.isFinite(cost) || cost <= 0) return 0;
		return Math.round(cost * 100) / 100;
	}, [editFeedTotalKg, editFeedForm.unitPrice]);
	const editFeedTotalBagsDisplay = useMemo(() => {
		const bagsValue = editFeedForm.entryType === "out" ? Number(editFeedForm.bagsOut || 0) : Number(editFeedForm.bagsIn || 0);
		if (!Number.isFinite(bagsValue)) return "0.00";
		return bagsValue.toFixed(2);
	}, [editFeedForm.entryType, editFeedForm.bagsIn, editFeedForm.bagsOut]);
	const feedOutAvailableBagsDisplay = useMemo(() => {
		const perBag = Number(feedOutForm.kgPerBag || DEFAULT_KG_PER_BAG);
		if (!Number.isFinite(perBag) || perBag <= 0) return "0.00";
		return (Math.max(feedOutAvailable, 0) / perBag).toFixed(2);
	}, [feedOutAvailable, feedOutForm.kgPerBag]);

	const fetchFeed = async (flockId = "") => {
		setLoading(true);
		setError("");
		try {
			const list = await feedApi.list(flockId ? { flockId } : {});
			setFeedLogs(filterFeedLogs(list));
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
		if (selectedFlock || !flocks.length) return;
		const preferred =
			flocks.find((flock) => {
				const label = flock?.batch_no;
				if (label === undefined || label === null) return false;
				return String(label).toLowerCase() === "batch 1";
			}) || flocks[0];
		if (preferred?._id) {
			setSelectedFlock(preferred._id);
		}
	}, [flocks, selectedFlock]);

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
		const typeValue = feedInForm.type?.trim();
		if (!typeValue) {
			setError("Feed type required.");
			return;
		}
		const bagsValue = Number(feedInForm.bagsIn || 0);
		const kgPerBagValue = Number(feedInForm.kgPerBag || 0);
		if (!Number.isFinite(bagsValue) || bagsValue <= 0) {
			setError("Enter how many bags came in.");
			return;
		}
		if (!Number.isFinite(kgPerBagValue) || kgPerBagValue <= 0) {
			setError("Enter kg per bag for feed in.");
			return;
		}
		const unitPriceValue = Number(feedInForm.unitPrice || 0);
		if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
			setError("Enter price per kg for feed in.");
			return;
		}
		const totalCostValue = Math.round(feedInTotalKg * unitPriceValue * 100) / 100;
		setSavingIn(true);
		try {
			await feedApi.addIn({
				flockId: feedInForm.flockId,
				date: feedInForm.date,
				type: typeValue,
				bagsIn: bagsValue,
				kgPerBag: kgPerBagValue,
				unitPrice: unitPriceValue,
				totalCost: totalCostValue,
			});
			setSuccess("Feed-in recorded.");
			setFeedInForm((prev) => ({
				...defaultInForm,
				flockId: prev.flockId || selectedFlock,
				unitPrice: prev.unitPrice,
			}));
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
		const typeValue = feedOutForm.type?.trim();
		if (!typeValue) {
			setError("Feed type is required.");
			return;
		}
		const bagsValue = Number(feedOutForm.bagsOut || 0);
		const kgPerBagValue = Number(feedOutForm.kgPerBag || 0);
		if (!Number.isFinite(bagsValue) || bagsValue <= 0) {
			setError("Enter how many bags were used.");
			return;
		}
		if (!Number.isFinite(kgPerBagValue) || kgPerBagValue <= 0) {
			setError("Enter kg per bag for feed out.");
			return;
		}
		const kgOutValue = Math.round(bagsValue * kgPerBagValue * 100) / 100;
		if (kgOutValue > feedOutAvailable + 1e-6) {
			const available = Math.max(feedOutAvailable, 0).toFixed(2);
			setError(`Only ${available} kg available for this feed selection.`);
			return;
		}
		const unitPriceValue = Number(feedOutForm.unitPrice || 0);
		if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
			setError("Enter price per kg for feed out.");
			return;
		}
		const totalCostValue = Math.round(kgOutValue * unitPriceValue * 100) / 100;
		setSavingOut(true);
		try {
			await feedApi.addOut({
				flockId: feedOutForm.flockId,
				date: feedOutForm.date,
				type: typeValue,
				bagsOut: bagsValue,
				kgPerBag: kgPerBagValue,
				unitPrice: unitPriceValue,
				totalCost: totalCostValue,
			});
			setSuccess("Feed-out recorded.");
			setFeedOutForm((prev) => ({
				...defaultOutForm,
				flockId: prev.flockId || selectedFlock,
				unitPrice: prev.unitPrice,
			}));
			fetchFeed(selectedFlock || feedOutForm.flockId);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to save feed out");
		} finally {
			setSavingOut(false);
		}
	};

	const onEditFeed = (log) => {
		const entryType = log.kgOut && Number(log.kgOut) > 0 ? "out" : "in";
		const derivedKgPerBag =
			log.kgPerBag ||
			( log.bagsIn
				? Number(log.kgIn || 0) / Number(log.bagsIn || 1)
				: log.bagsOut
				? Number(log.kgOut || 0) / Number(log.bagsOut || 1)
				: 0);
		const resolvedFlockId =
			log.flockId ||
			(log.batch_no ? batchNoToFlockId[String(log.batch_no)] : "") ||
			selectedFlock ||
			"";
		if (resolvedFlockId && resolvedFlockId !== selectedFlock) {
			setSelectedFlock(resolvedFlockId);
		}
		setEditingFeed(log);
		setEditFeedForm({
			id: log._id,
			entryType,
			date: formatIndiaDate(log.date) || today,
			type: log.type || "",
			bagsIn: log.bagsIn?.toString() || "",
			bagsOut: log.bagsOut?.toString() || "",
			kgPerBag: derivedKgPerBag ? derivedKgPerBag.toString() : "",
			unitPrice: log.unitPrice?.toString() || "",
			flockId: resolvedFlockId,
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
			const typeValue = editFeedForm.type?.trim();
			if (!typeValue) throw new Error("Feed type is required");
			if (editFeedForm.entryType === "in") {
				const bagsValue = Number(editFeedForm.bagsIn || 0);
				const kgPerBagValue = Number(editFeedForm.kgPerBag || 0);
				if (!Number.isFinite(bagsValue) || bagsValue <= 0) throw new Error("Bags must be > 0 for feed in");
				if (!Number.isFinite(kgPerBagValue) || kgPerBagValue <= 0) throw new Error("Kg per bag must be > 0 for feed in");
			} else {
				const bagsValue = Number(editFeedForm.bagsOut || 0);
				const kgPerBagValue = Number(editFeedForm.kgPerBag || 0);
				if (!Number.isFinite(bagsValue) || bagsValue <= 0) throw new Error("Bags must be > 0 for feed out");
				if (!Number.isFinite(kgPerBagValue) || kgPerBagValue <= 0) throw new Error("Kg per bag must be > 0 for feed out");
			}
			const unitPriceValue = Number(editFeedForm.unitPrice || 0);
			if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) throw new Error("Price per kg must be > 0");
			const totalCostValue = Math.round(editFeedTotalKg * unitPriceValue * 100) / 100;

			const payload = {
				type: typeValue,
				date: editFeedForm.date,
				flockId: editFeedForm.flockId,
				unitPrice: unitPriceValue,
				totalCost: totalCostValue,
			};
			if (editFeedForm.entryType === "in") {
				payload.bagsIn = editFeedForm.bagsIn ? Number(editFeedForm.bagsIn) : 0;
				payload.kgPerBag = editFeedForm.kgPerBag ? Number(editFeedForm.kgPerBag) : 0;
				payload.kgOut = 0;
			} else {
				payload.bagsOut = editFeedForm.bagsOut ? Number(editFeedForm.bagsOut) : 0;
				payload.kgPerBag = editFeedForm.kgPerBag ? Number(editFeedForm.kgPerBag) : 0;
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
							<select value={editFeedForm.type} onChange={(e) => setEditFeedForm({ ...editFeedForm, type: e.target.value })}>
								{FEED_TYPE_CHOICES.map((choice) => (
									<option key={choice} value={choice}>
										{choice}
									</option>
								))}
								{editFeedForm.type && !FEED_TYPE_CHOICES.includes(editFeedForm.type) && (
									<option value={editFeedForm.type}>{editFeedForm.type}</option>
								)}
							</select>
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
									<span>Kg per bag</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={editFeedForm.kgPerBag}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, kgPerBag: e.target.value })}
									/>
								</label>
								<label>
									<span>Price per kg</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={editFeedForm.unitPrice}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, unitPrice: e.target.value })}
									/>
								</label>
								<div className="grid-full" style={{ fontSize: "0.9rem", color: "var(--text-muted, #555)" }}>
									Total feed this entry: {editFeedTotalBagsDisplay} bags ({editFeedTotalKg.toFixed(2)} kg) · Cost: {editFeedTotalCost.toFixed(2)}
								</div>
							</>
						) : (
							<>
								<label>
									<span>Bags used</span>
									<input
										type="number"
										min="0"
										value={editFeedForm.bagsOut}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, bagsOut: e.target.value })}
									/>
								</label>
								<label>
									<span>Kg per bag</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={editFeedForm.kgPerBag}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, kgPerBag: e.target.value })}
									/>
								</label>
								<label>
									<span>Price per kg</span>
									<input
										type="number"
										min="0"
										step="0.01"
										value={editFeedForm.unitPrice}
										onChange={(e) => setEditFeedForm({ ...editFeedForm, unitPrice: e.target.value })}
									/>
								</label>
								<div className="grid-full" style={{ fontSize: "0.9rem", color: "var(--text-muted, #555)" }}>
									Total feed this entry: {editFeedTotalBagsDisplay} bags ({editFeedTotalKg.toFixed(2)} kg) · Cost: {editFeedTotalCost.toFixed(2)}
								</div>
							</>
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
								onChange={(e) => setSelectedFlock(e.target.value)}
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
							<select
								name="type"
								value={feedInForm.type}
								onChange={(e) => setFeedInForm({ ...feedInForm, type: e.target.value })}
							>
								{FEED_TYPE_CHOICES.map((choice) => (
									<option key={choice} value={choice}>
										{choice}
									</option>
								))}
								{feedInForm.type && !FEED_TYPE_CHOICES.includes(feedInForm.type) && (
									<option value={feedInForm.type}>{feedInForm.type}</option>
								)}
							</select>
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
							<span>Kg per bag</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="kgPerBag"
								value={feedInForm.kgPerBag}
								onChange={(e) => setFeedInForm({ ...feedInForm, kgPerBag: e.target.value })}
							/>
						</label>
						<label>
							<span>Price per kg</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="unitPrice"
								value={feedInForm.unitPrice}
								onChange={(e) => setFeedInForm({ ...feedInForm, unitPrice: e.target.value })}
							/>
						</label>
						<div className="grid-full" style={{ fontSize: "0.9rem", color: "var(--text-muted, #555)" }}>
							Total feed this entry: {feedInTotalBagsDisplay} bags ({feedInTotalKg.toFixed(2)} kg) · Cost: {feedInTotalCost.toFixed(2)}
						</div>
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
								onChange={(e) => setSelectedFlock(e.target.value)}
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
							<select
								name="type"
								value={feedOutForm.type}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, type: e.target.value })}
							>
								{FEED_TYPE_CHOICES.map((choice) => (
									<option key={choice} value={choice}>
										{choice}
									</option>
								))}
								{feedOutForm.type && !FEED_TYPE_CHOICES.includes(feedOutForm.type) && (
									<option value={feedOutForm.type}>{feedOutForm.type}</option>
								)}
							</select>
						</label>
						<label>
							<span>Bags used</span>
							<input
								type="number"
								min="0"
								name="bagsOut"
								value={feedOutForm.bagsOut}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, bagsOut: e.target.value })}
							/>
						</label>
						<label>
							<span>Kg per bag</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="kgPerBag"
								value={feedOutForm.kgPerBag}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, kgPerBag: e.target.value })}
							/>
						</label>
						<label>
							<span>Price per kg</span>
							<input
								type="number"
								min="0"
								step="0.01"
								name="unitPrice"
								value={feedOutForm.unitPrice}
								onChange={(e) => setFeedOutForm({ ...feedOutForm, unitPrice: e.target.value })}
							/>
						</label>
						<div className="grid-full" style={{ fontSize: "0.9rem", color: "var(--text-muted, #555)" }}>
							Total feed this entry: {feedOutTotalBagsDisplay} bags ({feedOutTotalKg.toFixed(2)} kg) · Cost: {feedOutTotalCost.toFixed(2)} · Available: {feedOutAvailableBagsDisplay} bags ({Math.max(feedOutAvailable, 0).toFixed(2)} kg)
						</div>
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
								<th>Bags out</th>
								<th>Kg in</th>
								<th>Kg out</th>
								<th>Bags in</th>
								<th>Bags out</th>
								<th>Unit price</th>
								<th>Total cost</th>
								<th>Batch</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{feedLogs.length === 0 && (
								<tr>
									<td colSpan="11" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No feed entries"}
									</td>
								</tr>
							)}
							{feedLogs.map((log) => {
								const batchLabel = log.batch_no
									? batchLabelMap[log.batch_no] || log.batch_no
									: log.flockId
									? batchLabelMap[log.flockId] || log.flockId
									: "-";
								const unitPriceDisplay = log.unitPrice ? Number(log.unitPrice).toFixed(2) : "-";
								const totalCostDisplay = log.totalCost ? Number(log.totalCost).toFixed(2) : "-";
								const derivedBagsIn = formatBagsFromKg(log.kgIn);
								const derivedBagsOut = formatBagsFromKg(log.kgOut);
								return (
									<tr key={log._id}>
										<td>{formatIndiaDate(log.date)}</td>
										<td>{log.type}</td>
										<td>{log.bagsIn || "-"}</td>
										<td>{log.bagsOut || "-"}</td>
										<td>{log.kgIn || "-"}</td>
										<td>{log.kgOut || "-"}</td>
										<td>{derivedBagsIn}</td>
										<td>{derivedBagsOut}</td>
										<td>{unitPriceDisplay}</td>
										<td>{totalCostDisplay}</td>
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

			<div className="card mt">
				<h2>Cumulative feed summary</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Type</th>
								<th>Total entries</th>
								<th>Total kg</th>
								<th>Total bags</th>
								<th>Total amount</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Feed in</td>
								<td>{cumulativeFeedStats.totalInEntries}</td>
								<td>{cumulativeFeedStats.totalInKg.toFixed(2)}</td>
								<td>{cumulativeFeedStats.totalInBags.toFixed(2)}</td>
								<td>{cumulativeFeedStats.totalInCost.toFixed(2)}</td>
							</tr>
							<tr>
								<td>Feed out</td>
								<td>{cumulativeFeedStats.totalOutEntries}</td>
								<td>{cumulativeFeedStats.totalOutKg.toFixed(2)}</td>
								<td>{cumulativeFeedStats.totalOutBags.toFixed(2)}</td>
								<td>{cumulativeFeedStats.totalOutCost.toFixed(2)}</td>
							</tr>
							<tr>
								<td>Net amount (in - out)</td>
								<td>-</td>
								<td>-</td>
								<td>-</td>
								<td>{cumulativeFeedStats.totalAmountDiff.toFixed(2)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
