// SHOW GRANTS is SQL, not a substring to trust. Only direct DML privileges in
// the exact DEV schema and global USAGE are allowed. Roles/options fail closed.
const identifier = '(?:`(?:``|[^`])+`|[A-Za-z0-9_$]+)';
const accountPart = "(?:`(?:``|[^`])*`|'(?:''|\\\\.|[^'\\\\])*')";
const account = new RegExp(`^${accountPart}\\s*@\\s*${accountPart}$`);
const scopePattern = new RegExp(`^(${identifier})\\s*\\.\\s*(\\*|${identifier})$`);
const columnPrivilege = new RegExp(`^(SELECT|INSERT|UPDATE)\\s*\\(\\s*${identifier}(?:\\s*,\\s*${identifier})*\\s*\\)$`, 'i');
const readIdentifier = token => token.startsWith('`') ? token.slice(1, -1).replaceAll('``', '`') : token;

function splitPrivileges(text) {
  const result = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '`') {
      if (quoted && text[i + 1] === '`') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) return [];
      if (char === ',' && depth === 0) { result.push(text.slice(start, i).trim()); start = i + 1; }
    }
  }
  if (quoted || depth !== 0) return [];
  result.push(text.slice(start).trim());
  return result;
}

function exactSchema(pattern, patternEnabled) {
  if (!patternEnabled) return pattern === 'careerops_dev';
  let literal = '';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      if (++i === pattern.length) return false;
      // MySQL pattern escapes protect a literal underscore, percent, or slash.
      if (!['_', '%', '\\'].includes(pattern[i])) return false;
      literal += pattern[i];
    } else {
      if (pattern[i] === '_' || pattern[i] === '%') return false;
      literal += pattern[i];
    }
  }
  return literal === 'careerops_dev';
}

export function isSafeDevGrant(grant, partialRevokes) {
  if (typeof grant !== 'string' || typeof partialRevokes !== 'boolean') return false;
  const statement = /^\s*GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+(.+?)\s*$/i.exec(grant);
  if (!statement || !account.test(statement[3])) return false;
  const privileges = splitPrivileges(statement[1]);
  if (privileges.length === 0) return false;
  if (/^\*\s*\.\s*\*$/.test(statement[2])) {
    return privileges.length === 1 && privileges[0].toUpperCase() === 'USAGE';
  }
  const scope = scopePattern.exec(statement[2]);
  if (!scope) return false;
  const schema = readIdentifier(scope[1]);
  const schemaLevel = scope[2] === '*';
  // Database-level grants use patterns unless partial_revokes is ON.
  // Table/column grants always identify the schema literally.
  if (!exactSchema(schema, schemaLevel && !partialRevokes)) return false;
  return privileges.every(privilege => /^(SELECT|INSERT|UPDATE|DELETE)$/i.test(privilege) ||
    (!schemaLevel && columnPrivilege.test(privilege)));
}
