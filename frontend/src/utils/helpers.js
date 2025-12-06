export function decorateFlocksWithLabels(flocks = []) {
	const total = flocks.length;
	return flocks.map((flock, idx) => {
		const displayNumber = total - idx;
		return {
			...flock,
			displayLabel: `Batch ${displayNumber}`,
			displayNumber,
		};
	});
}

export function createBatchLabelMap(flocks = []) {
	const map = {};
	flocks.forEach((flock) => {
		const label = flock.displayLabel || flock.batch_no || flock._id;
		if (flock.batch_no) map[flock.batch_no] = label;
		if (flock._id) map[flock._id] = label;
	});
	return map;
}

const INDIA_TZ = "Asia/Kolkata";
const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: INDIA_TZ });

export function formatIndiaDate(value) {
	if (!value && value !== 0) return "";
	if (typeof value === "string" && value.length >= 10) {
		return value.slice(0, 10);
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return indiaDateFormatter.format(date);
}

export function getTodayISO() {
	return formatIndiaDate(new Date());
}
