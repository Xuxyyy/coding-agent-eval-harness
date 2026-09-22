import {existsSync, lstatSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {isAbsolute, join, posix, resolve} from 'node:path';
import {
  CASE_HORIZONS,
  CASE_LEVELS,
  CASE_MODULES,
  CASE_QUALITIES,
  CASE_SCHEMA_VERSION,
  CASE_TIERS,
  EXPECTED_DISPOSITIONS,
  LEGACY_CASE_SCHEMA_VERSION,
  LEGACY_SUITE_SCHEMA_VERSION,
  MEASUREMENT_CASE_SCHEMA_VERSION,
  MODULE_CASE_SCHEMA_VERSION,
  MODULE_SUITE_SCHEMA_VERSION,
  PREVIOUS_CASE_SCHEMA_VERSION,
  PROBE_MATCHES,
  PROBE_OUTCOMES,
  PROBE_STRATEGIES,
  START_STATES,
  SUITE_SCHEMA_VERSION,
  type CaseDefinition,
  type CaseModule,
  type CaseQuality,
  type Check,
  type LegacyCaseDefinition,
  type LegacyCheck,
  type MeasurementCaseDefinition,
  type ModuleCaseDefinition,
  type ProbeOutcome,
  type TrialChecks,
  type TrialEvidenceFixture,
  type SuiteDefinition,
  type TieredCaseDefinition,
  type VersionedCaseDefinition,
} from '../types/index.js';

export class CaseError extends Error {
  constructor(where: string, detail: string) {
    super(`${where}: ${detail}`);
    this.name = 'CaseError';
  }
}

function record(where: string, value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CaseError(where, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(where: string, value: Record<string, unknown>, required: readonly string[]): void {
  const keys = Object.keys(value).sort();
  const expected = [...required].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    throw new CaseError(where, `fields must be exactly: ${required.join(', ')}`);
  }
}

function text(where: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CaseError(where, 'must be a non-empty string');
  }
  return value;
}

function identifier(where: string, value: unknown): string {
  const parsed = text(where, value);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(parsed)) {
    throw new CaseError(where, 'must be a lowercase kebab-case identifier');
  }
  return parsed;
}

function positiveInteger(where: string, value: unknown): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new CaseError(where, 'must be a positive integer');
  }
  return value as number;
}

export function safeRelativePath(where: string, value: unknown): string {
  const path = text(where, value);
  if (
    isAbsolute(path) ||
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    path === '.' ||
    path.startsWith('./') ||
    path.split('/').includes('..') ||
    posix.normalize(path) !== path
  ) {
    throw new CaseError(where, `${JSON.stringify(path)} must be a normalized POSIX-relative path`);
  }
  return path;
}

function parseLegacyCheck(where: string, source: Record<string, unknown>): LegacyCheck {
  const kind = source.kind;
  if (kind === 'exit0') {
    exactKeys(where, source, ['kind', 'command']);
    return {kind, command: text(`${where}.command`, source.command)};
  }
  if (kind === 'exists' || kind === 'unchanged') {
    exactKeys(where, source, ['kind', 'path']);
    return {kind, path: safeRelativePath(`${where}.path`, source.path)};
  }
  throw new CaseError(`${where}.kind`, 'must be exists, exit0, or unchanged');
}

function parseCheck(where: string, raw: unknown, version: 1 | 2 | 3 | 4 | 5): Check {
  const source = record(where, raw);
  if (version === LEGACY_CASE_SCHEMA_VERSION) return parseLegacyCheck(where, source);
  const kind = source.kind;
  if (kind === 'exit0' || kind === 'exists' || kind === 'unchanged') {
    return parseLegacyCheck(where, source);
  }
  if (kind === 'absent') {
    exactKeys(where, source, ['kind', 'path']);
    return {kind, path: safeRelativePath(`${where}.path`, source.path)};
  }
  if (kind === 'contains') {
    exactKeys(where, source, ['kind', 'path', 'text']);
    return {
      kind,
      path: safeRelativePath(`${where}.path`, source.path),
      text: text(`${where}.text`, source.text),
    };
  }
  if (kind === 'matches') {
    exactKeys(where, source, ['kind', 'path', 'pattern']);
    const pattern = text(`${where}.pattern`, source.pattern);
    try {
      new RegExp(pattern);
    } catch (error) {
      throw new CaseError(
        `${where}.pattern`,
        `must be a valid JavaScript regular expression: ${(error as Error).message}`,
      );
    }
    return {kind, path: safeRelativePath(`${where}.path`, source.path), pattern};
  }
  throw new CaseError(
    `${where}.kind`,
    'must be absent, contains, exists, exit0, matches, or unchanged',
  );
}

function parseTask(source: Record<string, unknown>, where: string) {
  const task = record(`${where}.task`, source.task);
  exactKeys(`${where}.task`, task, ['prompt', 'maxSeconds']);
  return {
    prompt: text(`${where}.task.prompt`, task.prompt),
    maxSeconds: positiveInteger(`${where}.task.maxSeconds`, task.maxSeconds),
  };
}

function parseGrade(source: Record<string, unknown>, where: string, version: 1 | 2 | 3 | 4 | 5) {
  const grade = record(`${where}.grade`, source.grade);
  exactKeys(`${where}.grade`, grade, ['allowedWrites', 'checks']);
  if (!Array.isArray(grade.allowedWrites)) {
    throw new CaseError(`${where}.grade.allowedWrites`, 'must be an array');
  }
  const allowedWrites = grade.allowedWrites.map((item, index) =>
    safeRelativePath(`${where}.grade.allowedWrites[${index}]`, item),
  );
  if (new Set(allowedWrites).size !== allowedWrites.length) {
    throw new CaseError(`${where}.grade.allowedWrites`, 'must not contain duplicates');
  }
  if (!Array.isArray(grade.checks) || grade.checks.length === 0) {
    throw new CaseError(`${where}.grade.checks`, 'must be a non-empty array');
  }
  return {
    allowedWrites,
    checks: grade.checks.map((item, index) =>
      parseCheck(`${where}.grade.checks[${index}]`, item, version),
    ),
  };
}

function controlled<T extends string>(where: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CaseError(where, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function parseCase(raw: unknown, where: string, dir: string): CaseDefinition {
  const source = record(where, raw);
  if (source.schemaVersion === LEGACY_CASE_SCHEMA_VERSION) {
    exactKeys(where, source, ['schemaVersion', 'id', 'category', 'task', 'grade']);
    return {
      schemaVersion: LEGACY_CASE_SCHEMA_VERSION,
      id: text(`${where}.id`, source.id),
      category: text(`${where}.category`, source.category),
      task: parseTask(source, where),
      grade: parseGrade(source, where, LEGACY_CASE_SCHEMA_VERSION),
      dir,
    } as LegacyCaseDefinition;
  }
  if (
    source.schemaVersion !== PREVIOUS_CASE_SCHEMA_VERSION &&
    source.schemaVersion !== MEASUREMENT_CASE_SCHEMA_VERSION &&
    source.schemaVersion !== MODULE_CASE_SCHEMA_VERSION &&
    source.schemaVersion !== CASE_SCHEMA_VERSION
  ) {
    throw new CaseError(
      `${where}.schemaVersion`,
      `must be ${LEGACY_CASE_SCHEMA_VERSION}, ${PREVIOUS_CASE_SCHEMA_VERSION}, ${MEASUREMENT_CASE_SCHEMA_VERSION}, ${MODULE_CASE_SCHEMA_VERSION}, or ${CASE_SCHEMA_VERSION}`,
    );
  }
  const isMeasurement = source.schemaVersion === MEASUREMENT_CASE_SCHEMA_VERSION ||
    source.schemaVersion === MODULE_CASE_SCHEMA_VERSION ||
    source.schemaVersion === CASE_SCHEMA_VERSION;
  const isModule = source.schemaVersion === MODULE_CASE_SCHEMA_VERSION ||
    source.schemaVersion === CASE_SCHEMA_VERSION;
  const isTiered = source.schemaVersion === CASE_SCHEMA_VERSION;
  exactKeys(where, source, [
    'schemaVersion',
    'id',
    'level',
    ...(isTiered ? ['tier'] : []),
    ...(isModule ? ['primaryModule', 'horizon'] : []),
    'primaryQuality',
    'supportingQualities',
    'startState',
    ...(isMeasurement ? ['expectedDisposition', 'trialChecks'] : []),
    'task',
    'grade',
  ]);
  const primaryQuality = controlled(
    `${where}.primaryQuality`,
    source.primaryQuality,
    CASE_QUALITIES,
  );
  if (!Array.isArray(source.supportingQualities)) {
    throw new CaseError(`${where}.supportingQualities`, 'must be an array');
  }
  const supportingQualities = source.supportingQualities.map((quality, index) =>
    controlled(`${where}.supportingQualities[${index}]`, quality, CASE_QUALITIES),
  );
  if (new Set(supportingQualities).size !== supportingQualities.length) {
    throw new CaseError(`${where}.supportingQualities`, 'must not contain duplicates');
  }
  if (supportingQualities.includes(primaryQuality)) {
    throw new CaseError(`${where}.supportingQualities`, 'must not repeat primaryQuality');
  }
  const common = {
    schemaVersion: source.schemaVersion,
    id: identifier(`${where}.id`, source.id),
    level: controlled(`${where}.level`, source.level, CASE_LEVELS),
    primaryQuality,
    supportingQualities: supportingQualities as CaseQuality[],
    startState: controlled(`${where}.startState`, source.startState, START_STATES),
    task: parseTask(source, where),
    grade: parseGrade(source, where, source.schemaVersion),
    dir,
  };
  if (!isMeasurement) return common as VersionedCaseDefinition;
  const expectedDisposition = controlled(
    `${where}.expectedDisposition`,
    source.expectedDisposition,
    EXPECTED_DISPOSITIONS,
  );
  const measurementVersion = source.schemaVersion === MEASUREMENT_CASE_SCHEMA_VERSION
    ? MEASUREMENT_CASE_SCHEMA_VERSION
    : source.schemaVersion === MODULE_CASE_SCHEMA_VERSION
      ? MODULE_CASE_SCHEMA_VERSION
      : CASE_SCHEMA_VERSION;
  const trialChecks = parseTrialChecks(source.trialChecks, `${where}.trialChecks`, measurementVersion);
  if (expectedDisposition !== 'implemented' && trialChecks.controlledEvents.length > 0) {
    throw new CaseError(
      `${where}.trialChecks.controlledEvents`,
      `controlled events are unsupported for ${expectedDisposition} cases`,
    );
  }
  const measurement = {
    ...common,
    schemaVersion: source.schemaVersion,
    expectedDisposition,
    trialChecks,
    evidence: {
      knownGood: {terminalStatus: 'error', finalMessage: null, controlledEvents: []},
      knownBad: {terminalStatus: 'error', finalMessage: null, controlledEvents: []},
    },
  };
  if (!isModule) return measurement as MeasurementCaseDefinition;
  const moduleCase = {
    ...measurement,
    schemaVersion: source.schemaVersion,
    primaryModule: controlled(`${where}.primaryModule`, source.primaryModule, CASE_MODULES),
    horizon: controlled(`${where}.horizon`, source.horizon, CASE_HORIZONS),
  };
  if (!isTiered) return moduleCase as ModuleCaseDefinition;
  return {
    ...moduleCase,
    schemaVersion: CASE_SCHEMA_VERSION,
    tier: controlled(`${where}.tier`, source.tier, CASE_TIERS),
  } as TieredCaseDefinition;
}

function regexp(where: string, value: unknown): string {
  const pattern = text(where, value);
  try {
    new RegExp(pattern, 'iu');
  } catch (error) {
    throw new CaseError(where, `must be a valid JavaScript regular expression: ${(error as Error).message}`);
  }
  return pattern;
}

function parseTrialChecks(
  raw: unknown,
  where: string,
  version:
    | typeof MEASUREMENT_CASE_SCHEMA_VERSION
    | typeof MODULE_CASE_SCHEMA_VERSION
    | typeof CASE_SCHEMA_VERSION,
): TrialChecks {
  const source = record(where, raw);
  exactKeys(where, source, ['finalResponse', 'controlledEvents']);
  const finalResponse = record(`${where}.finalResponse`, source.finalResponse);
  exactKeys(`${where}.finalResponse`, finalResponse, ['required', 'forbidden']);
  if (!Array.isArray(finalResponse.required) || !Array.isArray(finalResponse.forbidden)) {
    throw new CaseError(`${where}.finalResponse`, 'required and forbidden must be arrays');
  }
  const required = finalResponse.required.map((value, index) =>
    regexp(`${where}.finalResponse.required[${index}]`, value));
  const forbidden = finalResponse.forbidden.map((value, index) =>
    regexp(`${where}.finalResponse.forbidden[${index}]`, value));
  if (new Set(required).size !== required.length || new Set(forbidden).size !== forbidden.length) {
    throw new CaseError(`${where}.finalResponse`, 'patterns must not contain duplicates');
  }
  if (!Array.isArray(source.controlledEvents)) {
    throw new CaseError(`${where}.controlledEvents`, 'must be an array');
  }
  const controlledEvents = source.controlledEvents.map((value, index) => {
    const itemWhere = `${where}.controlledEvents[${index}]`;
    const item = record(itemWhere, value);
    if (version === MEASUREMENT_CASE_SCHEMA_VERSION) {
      exactKeys(itemWhere, item, ['probeId', 'command', 'outcomes']);
    } else {
      const strategy = controlled(`${itemWhere}.strategy`, item.strategy, PROBE_STRATEGIES);
      exactKeys(
        itemWhere,
        item,
        strategy === 'unavailable'
          ? ['probeId', 'strategy', 'match', 'outcomes']
          : ['probeId', 'strategy', 'match', 'command', 'outcomes'],
      );
    }
    if (!Array.isArray(item.outcomes) || item.outcomes.length === 0) {
      throw new CaseError(`${itemWhere}.outcomes`, 'must be a non-empty array');
    }
    const strategy = version === MEASUREMENT_CASE_SCHEMA_VERSION
      ? 'transient-first' as const
      : controlled(`${itemWhere}.strategy`, item.strategy, PROBE_STRATEGIES);
    const outcomes = item.outcomes.map((outcome, outcomeIndex) =>
      controlled(`${itemWhere}.outcomes[${outcomeIndex}]`, outcome, PROBE_OUTCOMES)) as ProbeOutcome[];
    if (strategy === 'unavailable' && outcomes.some((outcome) => outcome !== 'unavailable')) {
      throw new CaseError(`${itemWhere}.outcomes`, 'unavailable probes may expect only unavailable outcomes');
    }
    if (strategy === 'command' && outcomes.some((outcome) => outcome !== 'passed' && outcome !== 'failed')) {
      throw new CaseError(`${itemWhere}.outcomes`, 'command probes may expect only passed or failed outcomes');
    }
    return {
      probeId: identifier(`${itemWhere}.probeId`, item.probeId),
      command: strategy === 'unavailable' ? null : text(`${itemWhere}.command`, item.command),
      strategy,
      match: version === MEASUREMENT_CASE_SCHEMA_VERSION
        ? 'subsequence' as const
        : controlled(`${itemWhere}.match`, item.match, PROBE_MATCHES),
      outcomes,
    };
  });
  const probeIds = controlledEvents.map((item) => item.probeId);
  if (new Set(probeIds).size !== probeIds.length) {
    throw new CaseError(`${where}.controlledEvents`, 'must not contain duplicate probe IDs');
  }
  if (required.length === 0 && forbidden.length === 0 && controlledEvents.length === 0) {
    throw new CaseError(where, 'must contain at least one trial check');
  }
  return {finalResponse: {required, forbidden}, controlledEvents};
}

function parseEvidenceFixture(raw: unknown, where: string): TrialEvidenceFixture {
  const source = record(where, raw);
  exactKeys(where, source, ['terminalStatus', 'finalMessage', 'controlledEvents']);
  const terminalStatus = controlled(
    `${where}.terminalStatus`,
    source.terminalStatus,
    ['completed', 'denied', 'timeout', 'failed', 'error'] as const,
  );
  if (source.finalMessage !== null && typeof source.finalMessage !== 'string') {
    throw new CaseError(`${where}.finalMessage`, 'must be a string or null');
  }
  if (!Array.isArray(source.controlledEvents)) {
    throw new CaseError(`${where}.controlledEvents`, 'must be an array');
  }
  const controlledEvents = source.controlledEvents.map((value, index) => {
    const itemWhere = `${where}.controlledEvents[${index}]`;
    const item = record(itemWhere, value);
    exactKeys(itemWhere, item, ['sequence', 'probeId', 'outcome']);
    const sequence = positiveInteger(`${itemWhere}.sequence`, item.sequence);
    if (sequence !== index + 1) throw new CaseError(`${itemWhere}.sequence`, 'must be contiguous');
    return {
      sequence,
      probeId: identifier(`${itemWhere}.probeId`, item.probeId),
      outcome: controlled(`${itemWhere}.outcome`, item.outcome, PROBE_OUTCOMES),
    };
  });
  return {terminalStatus, finalMessage: source.finalMessage as string | null, controlledEvents};
}

function rejectSymlinks(root: string): void {
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    const target = join(root, entry.name);
    if (entry.isSymbolicLink() || lstatSync(target).isSymbolicLink()) {
      throw new CaseError(root, `symlinks are not allowed: ${target}`);
    }
    if (entry.isDirectory()) rejectSymlinks(target);
  }
}

function requireDirectory(caseDir: string, name: string): void {
  const target = join(caseDir, name);
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw new CaseError(caseDir, `${name}/ is required`);
  }
  rejectSymlinks(target);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new CaseError(path, `invalid JSON: ${(error as Error).message}`);
  }
}

export function loadCase(caseDir: string): CaseDefinition {
  const absolute = resolve(caseDir);
  requireDirectory(absolute, 'workspace');
  requireDirectory(absolute, 'solution');
  requireDirectory(absolute, 'counterexample');
  const manifest = join(absolute, 'case.json');
  if (!existsSync(manifest) || !statSync(manifest).isFile()) {
    throw new CaseError(absolute, 'case.json is required');
  }
  if (lstatSync(manifest).isSymbolicLink()) {
    throw new CaseError(absolute, 'case.json must not be a symlink');
  }
  const definition = parseCase(readJson(manifest), manifest, absolute);
  if (
    definition.schemaVersion === MEASUREMENT_CASE_SCHEMA_VERSION ||
    definition.schemaVersion === MODULE_CASE_SCHEMA_VERSION ||
    definition.schemaVersion === CASE_SCHEMA_VERSION
  ) {
    requireDirectory(absolute, 'evidence');
    const knownGoodPath = join(absolute, 'evidence', 'known-good.json');
    const knownBadPath = join(absolute, 'evidence', 'known-bad.json');
    for (const path of [knownGoodPath, knownBadPath]) {
      if (!existsSync(path) || !statSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
        throw new CaseError(absolute, `evidence/${path.endsWith('known-good.json') ? 'known-good.json' : 'known-bad.json'} is required`);
      }
    }
    definition.evidence = {
      knownGood: parseEvidenceFixture(readJson(knownGoodPath), knownGoodPath),
      knownBad: parseEvidenceFixture(readJson(knownBadPath), knownBadPath),
    };
  }
  return definition;
}

export function loadCases(root: string): CaseDefinition[] {
  const absolute = resolve(root);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new CaseError(absolute, 'cases directory does not exist');
  }
  const cases = readdirSync(absolute, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadCase(join(absolute, entry.name)))
    .sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set<string>();
  for (const item of cases) {
    if (seen.has(item.id)) throw new CaseError(absolute, `duplicate case id: ${item.id}`);
    seen.add(item.id);
  }
  return cases;
}

export function parseSuite(
  raw: unknown,
  where: string,
  dir: string,
  cases: readonly CaseDefinition[],
): SuiteDefinition {
  const source = record(where, raw);
  if (
    source.schemaVersion !== LEGACY_SUITE_SCHEMA_VERSION &&
    source.schemaVersion !== MODULE_SUITE_SCHEMA_VERSION &&
    source.schemaVersion !== SUITE_SCHEMA_VERSION
  ) {
    throw new CaseError(
      `${where}.schemaVersion`,
      `must be ${LEGACY_SUITE_SCHEMA_VERSION}, ${MODULE_SUITE_SCHEMA_VERSION}, or ${SUITE_SCHEMA_VERSION}`,
    );
  }
  const byId = new Map(cases.map((item) => [item.id, item]));
  if (source.schemaVersion === SUITE_SCHEMA_VERSION) {
    exactKeys(where, source, ['schemaVersion', 'id', 'caseOrder']);
    if (!Array.isArray(source.caseOrder) || source.caseOrder.length === 0) {
      throw new CaseError(`${where}.caseOrder`, 'must be a non-empty array');
    }
    const caseOrder = source.caseOrder.map((caseId, index) =>
      identifier(`${where}.caseOrder[${index}]`, caseId));
    if (new Set(caseOrder).size !== caseOrder.length) {
      throw new CaseError(`${where}.caseOrder`, 'must not contain duplicates');
    }
    for (const caseId of caseOrder) {
      if (!byId.has(caseId)) {
        throw new CaseError(`${where}.caseOrder`, `references unknown case: ${caseId}`);
      }
    }
    if (
      cases.some((definition) => definition.schemaVersion !== CASE_SCHEMA_VERSION) ||
      caseOrder.length !== cases.length ||
      cases.some((definition) => !caseOrder.includes(definition.id))
    ) {
      throw new CaseError(
        `${where}.caseOrder`,
        `must contain every version ${CASE_SCHEMA_VERSION} case exactly once`,
      );
    }
    return {
      schemaVersion: SUITE_SCHEMA_VERSION,
      id: identifier(`${where}.id`, source.id),
      caseOrder,
      dir: resolve(dir),
    };
  }

  exactKeys(where, source, ['schemaVersion', 'id', 'profiles']);
  const isModuleSuite = source.schemaVersion === MODULE_SUITE_SCHEMA_VERSION;
  if (!Array.isArray(source.profiles) || source.profiles.length === 0) {
    throw new CaseError(`${where}.profiles`, 'must be a non-empty array');
  }
  const profiles = source.profiles.map((rawProfile, index) => {
    const profileWhere = `${where}.profiles[${index}]`;
    const profile = record(profileWhere, rawProfile);
    exactKeys(
      profileWhere,
      profile,
      isModuleSuite ? ['id', 'module', 'caseIds', 'repeats'] : ['id', 'caseIds', 'repeats'],
    );
    if (!Array.isArray(profile.caseIds) || profile.caseIds.length === 0) {
      throw new CaseError(`${profileWhere}.caseIds`, 'must be a non-empty array');
    }
    const caseIds = profile.caseIds.map((caseId, caseIndex) =>
      identifier(`${profileWhere}.caseIds[${caseIndex}]`, caseId),
    );
    if (new Set(caseIds).size !== caseIds.length) {
      throw new CaseError(`${profileWhere}.caseIds`, 'must not contain duplicates');
    }
    for (const caseId of caseIds) {
      const definition = byId.get(caseId);
      if (definition === undefined) {
        throw new CaseError(`${profileWhere}.caseIds`, `references unknown case: ${caseId}`);
      }
      if (definition.schemaVersion === LEGACY_CASE_SCHEMA_VERSION) {
        throw new CaseError(
          `${profileWhere}.caseIds`,
          `references version 1 case without conformance semantics: ${caseId}`,
        );
      }
    }
    const module = isModuleSuite
      ? controlled(`${profileWhere}.module`, profile.module, [...CASE_MODULES, 'all'] as const)
      : null;
    if (module !== null && module !== 'all') {
      for (const caseId of caseIds) {
        const definition = byId.get(caseId)!;
        if (
          definition.schemaVersion !== MODULE_CASE_SCHEMA_VERSION ||
          definition.primaryModule !== module
        ) {
          throw new CaseError(
            `${profileWhere}.caseIds`,
            `${caseId} must be a version ${MODULE_CASE_SCHEMA_VERSION} ${module} case`,
          );
        }
      }
    }
    return {
      id: identifier(`${profileWhere}.id`, profile.id),
      module,
      caseIds,
      repeats: positiveInteger(`${profileWhere}.repeats`, profile.repeats),
    };
  });
  const profileIds = profiles.map((profile) => profile.id);
  if (new Set(profileIds).size !== profileIds.length) {
    throw new CaseError(`${where}.profiles`, 'must not contain duplicate profile ids');
  }
  if (isModuleSuite) {
    const moduleProfiles = CASE_MODULES.map((module) => {
      const selected = profiles.filter((profile) => profile.module === module);
      if (selected.length !== 1) {
        throw new CaseError(`${where}.profiles`, `must contain exactly one ${module} profile`);
      }
      return selected[0]!;
    });
    const allProfiles = profiles.filter((profile) => profile.module === 'all');
    if (allProfiles.length !== 1 || profiles.length !== CASE_MODULES.length + 1) {
      throw new CaseError(`${where}.profiles`, 'must contain four module profiles and one all profile');
    }
    if (cases.some((definition) => definition.schemaVersion !== MODULE_CASE_SCHEMA_VERSION)) {
      throw new CaseError(
        `${where}.profiles`,
        `version ${MODULE_SUITE_SCHEMA_VERSION} suites require version ${MODULE_CASE_SCHEMA_VERSION} cases`,
      );
    }
    const expectedAll = moduleProfiles.flatMap((profile) => profile.caseIds);
    if (
      expectedAll.length !== cases.length ||
      new Set(expectedAll).size !== cases.length ||
      cases.some((definition) => !expectedAll.includes(definition.id))
    ) {
      throw new CaseError(`${where}.profiles`, 'every case must appear in exactly one module profile');
    }
    if (JSON.stringify(allProfiles[0]!.caseIds) !== JSON.stringify(expectedAll)) {
      throw new CaseError(`${where}.profiles`, 'the all profile must concatenate the four module profiles');
    }
  }
  return {
    schemaVersion: source.schemaVersion as
      | typeof LEGACY_SUITE_SCHEMA_VERSION
      | typeof MODULE_SUITE_SCHEMA_VERSION,
    id: identifier(`${where}.id`, source.id),
    profiles,
    dir: resolve(dir),
  };
}

export function loadSuite(root: string, cases = loadCases(root)): SuiteDefinition {
  const absolute = resolve(root);
  const manifest = join(absolute, 'suite.json');
  if (!existsSync(manifest) || !statSync(manifest).isFile()) {
    throw new CaseError(absolute, 'suite.json is required');
  }
  if (lstatSync(manifest).isSymbolicLink()) {
    throw new CaseError(absolute, 'suite.json must not be a symlink');
  }
  return parseSuite(readJson(manifest), manifest, absolute, cases);
}
