import { describe, expect, it } from 'vitest';
import { isSafeDevGrant } from '../../src/devGrantValidation.js';
const user = "'careerops_dev_app'@'127.0.0.1'";
const scoped = (schema, privileges = 'SELECT, INSERT, UPDATE, DELETE', table = '*') =>
  `GRANT ${privileges} ON \`${schema}\`.${table} TO ${user}`;

describe('representative MySQL SHOW GRANTS output', () => {
  it.each([
    { name: 'escaped schema underscore in pattern mode', grant: scoped('careerops\\_dev'), mode: false },
    { name: 'literal exact schema with partial revokes enabled', grant: scoped('careerops_dev'), mode: true },
    { name: 'backtick-quoted MySQL account', grant: "GRANT SELECT ON `careerops\\_dev`.* TO `careerops_dev_app`@`localhost`", mode: false },
    { name: 'single-quote account escaping', grant: "GRANT SELECT ON `careerops\\_dev`.* TO 'dev''fixture'@'localhost'", mode: false },
    { name: 'backslash account escaping', grant: "GRANT SELECT ON `careerops\\_dev`.* TO 'dev\\'fixture'@'localhost'", mode: false },
    { name: 'global usage only', grant: `GRANT USAGE ON *.* TO ${user}`, mode: false },
    { name: 'exact table scope', grant: scoped('careerops_dev', 'SELECT, UPDATE', '`visitor_analytics`'), mode: false },
    { name: 'column privileges on an exact table', grant: scoped('careerops_dev', 'SELECT (`id`, `first_seen`), UPDATE (`last_seen`)', '`visitor_analytics`'), mode: false },
    { name: 'unquoted exact identifiers', grant: `GRANT SELECT ON careerops_dev.visitor_analytics TO ${user}`, mode: false },
    { name: 'doubled backtick table escaping', grant: scoped('careerops_dev', 'SELECT', '`fixture``table`'), mode: false },
    { name: 'case and whitespace in SQL keywords', grant: `  grant select , update ON \`careerops\\_dev\` . * TO ${user}  `, mode: false }
  ])('accepts $name', ({ grant, mode }) => expect(isSafeDevGrant(grant, mode)).toBe(true));

  it.each([
    { name: 'unescaped underscore wildcard', grant: scoped('careerops_dev'), mode: false },
    { name: 'percent wildcard', grant: scoped('careerops%'), mode: false },
    { name: 'mixed escaped and unescaped wildcards', grant: scoped('careerops\\_dev%'), mode: false },
    { name: 'escaped percent is a different literal schema', grant: scoped('careerops\\_dev\\%'), mode: false },
    { name: 'double-backslash does not escape the wildcard underscore', grant: scoped('careerops\\\\_dev'), mode: false },
    { name: 'escaped pattern is not a literal exact schema', grant: scoped('careerops\\_dev'), mode: true },
    { name: 'a percent name is not DEV even in literal mode', grant: scoped('careerops%'), mode: true },
    { name: 'PROD schema', grant: scoped('careerops'), mode: false },
    { name: 'DEMO schema', grant: scoped('careerops\\_demo'), mode: false },
    { name: 'QA table scope', grant: scoped('careerops_qa', 'SELECT', '`visitor_analytics`'), mode: false },
    { name: 'global SELECT', grant: `GRANT SELECT ON *.* TO ${user}`, mode: false },
    { name: 'global ALL', grant: `GRANT ALL PRIVILEGES ON *.* TO ${user}`, mode: false },
    { name: 'schema ALL beyond approved DML', grant: scoped('careerops\\_dev', 'ALL PRIVILEGES'), mode: false },
    { name: 'schema CREATE beyond approved DML', grant: scoped('careerops\\_dev', 'SELECT, CREATE'), mode: false },
    { name: 'EXECUTE privilege', grant: scoped('careerops\\_dev', 'EXECUTE'), mode: false },
    { name: 'grant option', grant: scoped('careerops\\_dev') + ' WITH GRANT OPTION', mode: false },
    { name: 'role grant', grant: `GRANT \`dev_role\` TO ${user}`, mode: false },
    { name: 'proxy grant', grant: `GRANT PROXY ON 'root'@'localhost' TO ${user}`, mode: false },
    { name: 'extra statement', grant: scoped('careerops\\_dev') + `; GRANT SELECT ON *.* TO ${user}`, mode: false },
    { name: 'empty privilege', grant: scoped('careerops\\_dev', 'SELECT,'), mode: false },
    { name: 'schema column privilege syntax', grant: scoped('careerops\\_dev', 'SELECT (`id`)'), mode: false },
    { name: 'unknown escapes', grant: scoped('careerop\\s\\_dev'), mode: false },
    { name: 'malformed backtick quoting', grant: `GRANT SELECT ON \`careerops\\_dev.* TO ${user}`, mode: false },
    { name: 'unknown server semantics', grant: scoped('careerops_dev'), mode: undefined },
    { name: 'non-string output', grant: null, mode: false }
  ])('rejects $name', ({ grant, mode }) => expect(isSafeDevGrant(grant, mode)).toBe(false));
});
