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
