function isDateInstance(value) {
  return Object.prototype.toString.call(value) === '[object Date]';
}

function parseDateOnly(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return new Date(Date.UTC(year, month, day));
      }
    }
  }

  const date = isDateInstance(value) ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDateLabel(value) {
  if (!value && value !== 0) return '';
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }
  const date = isDateInstance(value) ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function addDays(date, days = 1) {
  if (!date) return null;
  const cloned = new Date(date.getTime());
  cloned.setUTCDate(cloned.getUTCDate() + days);
  return cloned;
}

function computeNextRequiredDate(startDate, records = []) {
  const start = parseDateOnly(startDate);
  if (!start) return null;

  const sorted = Array.isArray(records)
    ? [...records].sort((a, b) => {
        const aDate = parseDateOnly(a?.dateLabel || a?.date);
        const bDate = parseDateOnly(b?.dateLabel || b?.date);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.getTime() - bDate.getTime();
      })
    : [];

  let expected = start;
  for (const rec of sorted) {
    const recDate = parseDateOnly(rec?.dateLabel || rec?.date);
    if (!recDate) continue;
    const recTime = recDate.getTime();
    const expectedTime = expected.getTime();
    if (recTime < expectedTime) continue;
    if (recTime === expectedTime) {
      expected = addDays(expected, 1);
      continue;
    }
    if (recTime > expectedTime) {
      return expected;
    }
  }
  return expected;
}

module.exports = {
  parseDateOnly,
  getDateLabel,
  addDays,
  computeNextRequiredDate,
};
