import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { flockApi, reportApi } from "../services/api";
import { formatIndiaDate } from "../utils/helpers";

const MIN_CLOSING_AGE = 40;

export default function FinalReport() {
	const { flocks, refreshFlocks } = useFlocks();
	const [selectedFlockId, setSelectedFlockId] = useState("");
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [closeRemarks, setCloseRemarks] = useState("");
	const [closing, setClosing] = useState(false);
	const [closeMessage, setCloseMessage] = useState("");
	const [closeError, setCloseError] = useState("");

	const loadReport = async (flockId) => {
		if (!flockId) return;
		setLoading(true);
		setError("");
		try {
			const res = await reportApi.final({ flockId });
			setData(res);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load closing report");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!selectedFlockId && flocks.length > 0) {
			setSelectedFlockId(flocks[0]._id);
		}
	}, [flocks, selectedFlockId]);

	useEffect(() => {
		if (selectedFlockId) loadReport(selectedFlockId);
	}, [selectedFlockId]);

	useEffect(() => {
		setCloseRemarks("");
		setCloseError("");
		setCloseMessage("");
	}, [selectedFlockId]);

	const selectedFlock = useMemo(() => flocks.find((f) => f._id === selectedFlockId), [flocks, selectedFlockId]);
	const isClosed = selectedFlock?.status === "closed";

	const handleClose = async (e) => {
		e.preventDefault();
		if (!selectedFlockId) return;
		setClosing(true);
		setCloseError("");
		setCloseMessage("");
		try {
			await flockApi.close(selectedFlockId, closeRemarks ? { remarks: closeRemarks } : undefined);
			setCloseRemarks("");
			setCloseMessage("Batch closed successfully.");
			await refreshFlocks();
		} catch (err) {
			setCloseError(err.response?.data?.error || err.message || "Unable to close batch");
		} finally {
			setClosing(false);
		}
	};

	const rows = data?.rows || [];
	const latestAge = useMemo(() => {
		if (!rows.length) return null;
		const lastRow = rows[rows.length - 1];
		return typeof lastRow.age === "number" ? lastRow.age : null;
	}, [rows]);
	const meetsClosingRequirement = latestAge !== null && latestAge >= MIN_CLOSING_AGE;

	const summaryCards = [
		{ label: "Total chicks in", value: data?.totalChicks ?? "-" },
		{ label: "Price per chick", value: data?.pricePerChick ?? "-" },
		{ label: "Total chick cost", value: data?.totalChickCost ?? "-" },
		{ label: "Remaining chicks", value: data?.remainingChicks ?? "-" },
		{ label: "Total feed in (kg)", value: data?.totalFeedIn ?? "-" },
		{ label: "Feed used (kg)", value: data?.totalFeedOut ?? "-" },
		{ label: "Feed remaining (kg)", value: data?.feedRemaining ?? "-" },
		{ label: "Feed cost in", value: data?.totalFeedCostIn ?? "-" },
		{ label: "Feed cost out", value: data?.totalFeedCostOut ?? "-" },
		{ label: "Feed cost remaining", value: data?.feedCostRemaining ?? "-" },
		{ label: "Birds sold", value: data?.totalBirdsSold ?? "-" },
		{ label: "Weight sold (kg)", value: data?.totalWeightSold ?? "-" },
		{ label: "Total medicine cost", value: data?.totalMedicineCost ?? "-" },
	];

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Final closing report</h1>
					<p>Summarize a batch after 40+ days of monitoring.</p>
				</div>
				<div className="header-actions">
					<select value={selectedFlockId} onChange={(e) => setSelectedFlockId(e.target.value)}>
						<option value="">Select flock</option>
						{flocks.map((f) => (
							<option key={f._id} value={f._id}>
								{f.displayLabel || f.batch_no || f._id}
							</option>
						))}
					</select>
				</div>
			</div>

			{selectedFlock && (
				<div className="card mb">
					<div className="card-header">
						<h2>Batch status</h2>
						<div className={`stat-pill ${isClosed ? "success" : "warning"}`}>
							{isClosed ? "Closed" : "Active"}
						</div>
					</div>
					{isClosed ? (
						<p className="muted">
							Closed on {selectedFlock.closedAt ? new Date(selectedFlock.closedAt).toLocaleDateString() : "--"}
							{selectedFlock.closeRemarks ? ` – ${selectedFlock.closeRemarks}` : ""}
						</p>
					) : (
						<form className="close-form" onSubmit={handleClose}>
							<label>
								<span>Closing remarks (optional)</span>
								<input
									type="text"
									value={closeRemarks}
									onChange={(e) => setCloseRemarks(e.target.value)}
									placeholder="Notes about this closure"
								/>
							</label>
							<button type="submit" disabled={closing || !meetsClosingRequirement}>
								{closing ? "Closing..." : "Mark batch as closed"}
							</button>
							{!meetsClosingRequirement && (
								<p className="muted">
									Need minimum {MIN_CLOSING_AGE}-day monitoring entry before closing. Latest recorded age:
									<strong> {latestAge ?? "N/A"}</strong> days.
								</p>
							)}
						</form>
					)}
					{closeError && <div className="error mt">{closeError}</div>}
					{closeMessage && <div className="success mt">{closeMessage}</div>}
				</div>
			)}

			{error && <div className="error mb">{error}</div>}

			<div className="stat-grid">
				{summaryCards.map((card) => (
					<div key={card.label} className="stat-card">
						<span>{card.label}</span>
						<strong>{card.value}</strong>
					</div>
				))}
			</div>

			<div className="card mt">
				<h2>Daily performance (min 40 days recommended)</h2>
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Age</th>
								<th>Mortality</th>
								<th>Cumulative %</th>
								<th>Feed kg</th>
								<th>Feed/bird</th>
								<th>Birds at start</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && (
								<tr>
									<td colSpan="7" style={{ textAlign: "center" }}>
										{loading ? "Loading..." : "No data"}
									</td>
								</tr>
							)}
							{rows.map((row, idx) => {
								const displayDate = formatIndiaDate(row.date || row.dateIso);
								return (
									<tr key={`${displayDate}-${idx}`}>
										<td>{displayDate}</td>
										<td>{row.age}</td>
										<td>{row.mortality}</td>
										<td>{row.mortalityPercent?.toFixed?.(2) ?? row.mortalityPercent}</td>
										<td>{row.feedKg}</td>
										<td>{row.feedPerBird?.toFixed?.(4) ?? row.feedPerBird}</td>
										<td>{row.birdsAtStart}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<div className="card mt">
				<h2>Medicine summary</h2>
				<div className="timeline">
					{data?.medicineByDate &&
						Object.entries(data.medicineByDate).map(([date, meds]) => {
							const displayDate = formatIndiaDate(date) || date;
							return (
								<div key={date} className="timeline-item">
									<div className="timeline-date">{displayDate}</div>
									<ul>
										{meds.map((med) => (
												<li key={med._id}>
													{med.medicine_name} – {med.quantity}
													{med.dose ? ` (${med.dose})` : ""}
													{med.unitPrice ? ` @ ${Number(med.unitPrice).toFixed(2)} ea` : ""}
													{med.totalCost ? ` · total ${Number(med.totalCost).toFixed(2)}` : ""}
												</li>
										))}
									</ul>
								</div>
							);
						})}
					{(!data || !data.medicineByDate || Object.keys(data.medicineByDate).length === 0) && (
						<p>{loading ? "Loading..." : "No medicine entries"}</p>
					)}
				</div>
			</div>
		</div>
	);
}
