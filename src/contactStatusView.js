import { HIRING_STAGES, POSITION_STATUSES, legacyWorkflowDefaults } from './contactWorkflow.js';
export const UNKNOWN = 'Unclassified';
export const STAGES = [...HIRING_STAGES, UNKNOWN];
export const POSITIONS = [...POSITION_STATUSES, UNKNOWN];
const normalize = value => String(value ?? '').trim().toLowerCase();
export function contactDimensions(contact) {
  const defaults = legacyWorkflowDefaults(contact);
  const field = (name, choices) => {
    const raw = Object.hasOwn(contact, name) ? contact[name] : defaults[name];
    return choices.find(value => normalize(value) === normalize(raw)) || UNKNOWN;
  };
  return { stage: field('hiring_stage', HIRING_STAGES), position: field('position_status', POSITION_STATUSES),
    reported: normalize(contact.reported_unemployment ?? contact.reported_to_unemployment) === 'yes' ? 'Reported' : 'Not Reported' };
}
export function summarizeContacts(contacts) {
  const summary = { total: contacts.length, stage: Object.fromEntries(STAGES.map(v => [v, 0])), position: Object.fromEntries(POSITIONS.map(v => [v, 0])), reported: { Reported: 0, 'Not Reported': 0 } };
  for (const contact of contacts) {
    const dimensions = contactDimensions(contact);
    for (const key of ['stage', 'position', 'reported']) summary[key][dimensions[key]]++;
  }
  return summary;
}
export function filterContacts(contacts, filters = {}) {
  return contacts.filter(contact => {
    const dimensions = contactDimensions(contact);
    return ['stage', 'position', 'reported'].every(key => !filters[key] || filters[key] === 'all' || dimensions[key] === filters[key]);
  });
}
const compareText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base', numeric: true });
// Calendar keys avoid browser timezone shifts; missing/invalid dates sort last.
const dateKey = value => {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (!match) return null;
  const date = new Date(match[1] + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === match[1] ? match[1] : null;
};
export function sortContacts(contacts, field = 'date_contacted', direction = 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  const compareDate = (a, b, multiplier) => {
    const x = dateKey(a.date_contacted), y = dateKey(b.date_contacted);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return compareText(x, y) * multiplier;
  };
  return [...contacts].sort((a, b) => {
    let primary = 0;
    if (field === 'date_contacted') primary = compareDate(a, b, sign);
    else if (field === 'stage' || field === 'position') {
      const order = field === 'stage' ? STAGES : POSITIONS;
      primary = (order.indexOf(contactDimensions(a)[field]) - order.indexOf(contactDimensions(b)[field])) * sign;
    } else if (field === 'reported') primary = compareText(contactDimensions(a).reported, contactDimensions(b).reported) * sign;
    else primary = compareText(a[field], b[field]) * sign;
    return primary || (field !== 'date_contacted' ? compareDate(a, b, -1) : 0) || compareText(a.company, b.company) || compareText(a.id, b.id);
  });
}
export function badgeTone(value) {
  return ({ Applied: 'blue', Submitted: 'teal', 'Recruiter Interview': 'purple', 'HR Interview': 'purple', 'Hiring Interview': 'purple', 'Awaiting Decision': 'amber', 'On-hold': 'gray', Rejected: 'red', Closed: 'slate', Hired: 'green', Reported: 'green', 'Not Reported': 'gray' })[value] || 'gray';
}
