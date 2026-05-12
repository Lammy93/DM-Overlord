export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

export function formatDate(date) {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function formatTimestamp(date) {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function parseDiceNotation(formula) {
  const regex = /^(\d*)d(\d+)([+-]\d+)?$/i;
  const match = formula.match(regex);
  if (!match) return null;
  const count = match[1] ? parseInt(match[1], 10) : 1;
  if (count < 1) return null;
  return {
    count,
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

export function truncate(str, maxLength = 200) {
  if (!str || str.length <= maxLength) return str || '';
  return str.slice(0, maxLength - 3) + '...';
}

export function parseJsonField(field, fallback = null) {
  if (!field) return fallback;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return fallback;
  }
}

export function formatCurrency(c, s, e, g, p) {
  const parts = [];
  if (p > 0) parts.push(`${p} pp`);
  if (g > 0) parts.push(`${g} gp`);
  if (e > 0) parts.push(`${e} ep`);
  if (s > 0) parts.push(`${s} sp`);
  if (c > 0) parts.push(`${c} cp`);
  return parts.length > 0 ? parts.join(', ') : '0 gp';
}

export function listify(arr, conjunction = 'and') {
  if (!arr || arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} ${conjunction} ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, ${conjunction} ${arr[arr.length - 1]}`;
}
