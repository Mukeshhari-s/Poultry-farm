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

module.exports = {
  parseDateOnly,
  getDateLabel,
};
