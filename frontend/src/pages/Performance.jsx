import React, { useEffect, useMemo, useState } from "react";
import useFlocks from "../hooks/useFlocks";
import { flockApi, reportApi } from "../services/api";

const MIN_RECORD_DAYS = 35;
const SALES_TOLERANCE = 10;

const formatNumber = (value, digits = 2, fallback = "-") => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return num.toFixed(digits);
};

const formatPercent = (value, digits = 2) => {
	const formatted = formatNumber(value, digits);
	return formatted === "-" ? formatted : `${formatted}%`;
};

const formatSigned = (value, digits = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	const abs = Math.abs(num).toFixed(digits);
	return `${num >= 0 ? "+" : "-"}${abs}`;
};

export default function Performance() {
	const { flocks, refreshFlocks } = useFlocks();
	const [selectedFlockId, setSelectedFlockId] = useState("");
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [closing, setClosing] = useState(false);
	const [closeMessage, setCloseMessage] = useState("");
	const [closeError, setCloseError] = useState("");
	const [downloadingPdf, setDownloadingPdf] = useState(false);
	const [pdfError, setPdfError] = useState("");

	const loadReport = async (flockId) => {
		if (!flockId) return;
		setLoading(true);
		setError("");
		try {
			const res = await reportApi.final({ flockId });
			setData(res);
		} catch (err) {
			setError(err.response?.data?.error || err.message || "Unable to load performance report");
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
		setCloseError("");
		setCloseMessage("");
		setPdfError("");
	}, [selectedFlockId]);

	const selectedFlock = useMemo(() => flocks.find((f) => f._id === selectedFlockId), [flocks, selectedFlockId]);
	const isClosed = selectedFlock?.status === "closed";
	const performance = data?.performance || {};
	const validation = data?.validation || {};
	const rows = data?.rows || [];
	const hasMinRecords = validation.hasMinRecords ?? (rows.length >= (validation.minRecordDays || MIN_RECORD_DAYS));
	const salesMatchesInventory = validation.salesMatchesInventory ?? false;
	const readinessMet = validation.performanceReady ?? (hasMinRecords || salesMatchesInventory);
	const showPerformance = Boolean(data);
	const readinessLabel = isClosed
		? "Finished"
		: !data || loading
		? "Loading..."
		: readinessMet
		? "Ready"
		: "Not ready";
	const readinessTone = isClosed || (readinessMet && data) ? "success" : "warning";
	const expectedBirdsSold = performance.expectedBirdsSold ?? Math.max(0, Number(data?.totalChicks || 0) - Number(data?.totalMortality || 0));
	const requirementItems = [
		{
			label: `Minimum ${validation.minRecordDays || MIN_RECORD_DAYS} daily entries`,
			met: hasMinRecords,
			detail: `${validation.recordCount ?? rows.length ?? 0} captured`,
		},
		{
			label: `Sales match chicks - mortality (±${validation.tolerance || SALES_TOLERANCE})`,
			met: salesMatchesInventory,
			detail: `Delta ${formatSigned(validation.salesDelta ?? ((performance.totalBirdsSales ?? 0) - expectedBirdsSold), 0)}`,
		},
	];

	const metricRows = useMemo(() => {
		const mortPercent = performance.mortalityPercent ?? data?.mortalityPercent;
		const totalBirdWeight = performance.weightOfTotalBirds ?? data?.totalWeightSold;
		const gcPlaceholder = "--";
		return [
			{ label: "Housed chicks", value: formatNumber(performance.housedChicks ?? data?.totalChicks, 0) },
			// Feed in kg should match Feed page cumulative summary net kg (feed in - feed out)
			{ label: "Feed in kg", value: formatNumber(performance.feedsInKg ?? data?.netFeedKg ?? ((data?.totalFeedIn ?? 0) - (data?.totalFeedOut ?? 0)), 2) },
			{ label: "Mortality", value: formatNumber(performance.totalMortality ?? data?.totalMortality, 0) },
			{ label: "Mortality %", value: formatPercent(mortPercent, 2) },
			{ label: "Total birds sales", value: formatNumber(performance.totalBirdsSales ?? data?.totalBirdsSold, 0) },
			{ label: "Weight of total birds (kg)", value: formatNumber(totalBirdWeight, 3) },
			{ label: "Avg weight (kg)", value: formatNumber(performance.avgWeight ?? data?.avgWeightPerBird, 3) },
			{ label: "Cumulative feed per bird (kg)", value: formatNumber(performance.cumulativeFeedPerBird ?? data?.cumulativeFeedPerBird, 3) },
			{ label: "Short / excess (+/-)", value: formatSigned(performance.shortExcess ?? 0, 0) },
			{ label: "Mean age (days)", value: formatNumber(performance.meanAge, 1) },
			{ label: "FCR", value: formatNumber(performance.fcr, 3) },
			{ label: "Chick cost", value: formatNumber(performance.chickCost ?? data?.totalChickCost, 2) },
			// Feed cost should match Feed page cumulative summary net amount (in - out total amount)
			{ label: "Feed cost", value: formatNumber(data?.netFeedCost ?? performance.feedCost ?? data?.totalFeedCostOut, 2) },
			{ label: "Medicine cost", value: formatNumber(performance.medicineCost ?? data?.totalMedicineCost, 2) },
			{ label: "Over head", value: formatNumber(performance.overhead, 2) },
			{ label: "Total cost", value: formatNumber(performance.totalCost, 2) },
			{ label: "Production cost", value: formatNumber(performance.productionCost, 3) },
			{ label: "G.C", value: gcPlaceholder },
			{ label: "Total", value: gcPlaceholder },
			{ label: "TDS (1%)", value: gcPlaceholder },
			{ label: "Net G.C", value: gcPlaceholder },
			{ label: "Final amount", value: gcPlaceholder },
		];
	}, [performance, data]);

	const handleFinish = async () => {
		if (!selectedFlockId || isClosed || !readinessMet) return;
		setClosing(true);
		setCloseError("");
		setCloseMessage("");
		try {
			await flockApi.close(selectedFlockId);
			setCloseMessage("Farm closing completed for this batch.");
			await refreshFlocks();
		} catch (err) {
			setCloseError(err.response?.data?.error || err.message || "Unable to finish batch");
		} finally {
			setClosing(false);
		}
	};

	const handleDownloadPdf = async () => {
		if (!selectedFlockId || !isClosed) return;
		setPdfError("");
		setDownloadingPdf(true);
		try {
			const response = await reportApi.finalPdf(selectedFlockId);
			const blob = new Blob([response.data], { type: "application/pdf" });
			const url = window.URL.createObjectURL(blob);
			const filename = `${selectedFlock?.batch_no || selectedFlockId}-performance.pdf`;
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			link.target = "_blank";
			link.rel = "noopener";
			link.click();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			setPdfError(err.response?.data?.error || err.message || "Unable to download performance PDF");
		} finally {
			setDownloadingPdf(false);
		}
	};

	return (
		<div className="page">
			<div className="page-header">
				<div>
					<h1>Performance report</h1>
					<p>Track daily performance for your latest batch and close the farm when final numbers are ready.</p>
				</div>
			</div>

			{selectedFlock && (
				<div className="card mb">
					<div className="card-header" style={{ alignItems: "center" }}>
						<div>
							<h2>Batch status</h2>
							<p className="muted">{selectedFlock.batch_no}</p>
						</div>
						<div className={`stat-pill ${readinessTone}`}>
							{readinessLabel}
						</div>
					</div>
					{data ? (
						<ul className="requirements" style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
							{requirementItems.map((item) => (
								<li key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
									<div>
										<strong>{item.label}</strong>
										<span className="muted" style={{ marginLeft: "0.5rem" }}>{item.detail}</span>
									</div>
									<span style={{ color: item.met ? "var(--success, #0a8754)" : "var(--warning, #c87d0a)", fontWeight: 600 }}>
										{item.met ? "Met" : "Pending"}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="muted" style={{ marginBottom: "1rem" }}>
							Waiting for batch data...
						</p>
					)}
				</div>
			)}

			{error && <div className="error mb">{error}</div>}
			{data && !readinessMet && (
				<div className="card warning mb">
					<p>
						Complete at least {validation.minRecordDays || MIN_RECORD_DAYS} daily records or ensure sales align with chicks minus mortality (±
						{validation.tolerance || SALES_TOLERANCE}) before performing farm closing or downloading the performance PDF.
					</p>
				</div>
			)}

			{showPerformance && (
				<div className="card">
					<h2>Performance</h2>
					<div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
						{metricRows.map((row) => (
							<div key={row.label} className="stat-card">
								<span>{row.label}</span>
								<strong>{row.value}</strong>
							</div>
						))}
					</div>
					<p className="muted" style={{ marginTop: "0.5rem" }}>
						G.C fields are intentionally left blank until manual inputs are defined.
					</p>
				</div>
			)}

			{showPerformance && selectedFlock && (
				<div style={{ marginTop: "1.5rem" }}>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
						<button
							type="button"
							onClick={handleFinish}
							disabled={!readinessMet || closing || isClosed || !data || loading}
							className="primary"
						>
							{isClosed ? "Farm closed" : closing ? "Closing..." : "Farm closing"}
						</button>
						<button
							type="button"
							onClick={handleDownloadPdf}
							disabled={!isClosed || downloadingPdf || !data || loading}
						>
							{downloadingPdf ? "Preparing PDF..." : "Download PDF"}
						</button>
					</div>
					{!isClosed && (
						<p className="muted" style={{ marginTop: "0.5rem" }}>
							Download unlocks after farm closing.
						</p>
					)}
					{closeError && <div className="error mt">{closeError}</div>}
					{closeMessage && <div className="success mt">{closeMessage}</div>}
					{pdfError && <div className="error mt">{pdfError}</div>}
				</div>
			)}
		</div>
	);
}
