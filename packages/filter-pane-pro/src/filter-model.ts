import powerbi from 'powerbi-visuals-api';

export type FilterPaneTab = 'basic' | 'advanced';
export type FilterFieldType = 'category' | 'numeric' | 'date';
export type AdvancedOperator =
  | 'Equals'
  | 'DoesNotEqual'
  | 'GreaterThan'
  | 'GreaterThanOrEqual'
  | 'LessThan'
  | 'LessThanOrEqual'
  | 'Contains'
  | 'DoesNotContain'
  | 'StartsWith'
  | 'On'
  | 'Before'
  | 'After'
  | 'IsBlank'
  | 'IsNotBlank'
  | 'Between';

export type FilterPrimitive = string | number | boolean;

export interface FilterTarget {
  kind: 'column' | 'measure';
  table: string;
  column?: string;
  measure?: string;
  queryName: string;
}

export interface FilterValueOption {
  key: string;
  value: FilterPrimitive;
  label: string;
  count: number;
}

export interface FilterField {
  id: string;
  displayName: string;
  role: string;
  fieldType: FilterFieldType;
  target: FilterTarget;
  options: FilterValueOption[];
}

export interface FieldFilterState {
  selectedValues: string[];
}

export interface AdvancedRuleState {
  id: string;
  fieldId: string;
  operator: AdvancedOperator;
  value: string | null;
  valueTo: string | null;
  display: string;
  isValid: boolean;
}

export interface FilterPaneState {
  activeTab: FilterPaneTab;
  isOpen: boolean;
  fieldFilters: Record<string, FieldFilterState>;
  advancedRules: AdvancedRuleState[];
}

const BASIC_SCHEMA = 'https://powerbi.com/product/schema#basic';
const ADVANCED_SCHEMA = 'https://powerbi.com/product/schema#advanced';
// Power BI's documented measure-target schema uses HTTP.
// eslint-disable-next-line powerbi-visuals/no-http-string
const MEASURE_TARGET_SCHEMA = 'http://powerbi.com/product/schema#measure';

export const MAX_ADVANCED_CONDITIONS_PER_FIELD = 2;

const OPERATOR_LABELS: Record<AdvancedOperator, string> = {
  Equals: 'Equals',
  DoesNotEqual: 'Does not equal',
  GreaterThan: 'Greater than',
  GreaterThanOrEqual: 'Greater than or equal to',
  LessThan: 'Less than',
  LessThanOrEqual: 'Less than or equal to',
  Contains: 'Contains',
  DoesNotContain: 'Does not contain',
  StartsWith: 'Starts with',
  On: 'On',
  Before: 'Before',
  After: 'After',
  IsBlank: 'Is blank',
  IsNotBlank: 'Is not blank',
  Between: 'Between',
};

const PAYLOAD_OPERATOR_BY_RULE: Record<AdvancedOperator, string> = {
  Equals: 'Is',
  DoesNotEqual: 'IsNot',
  GreaterThan: 'GreaterThan',
  GreaterThanOrEqual: 'GreaterThanOrEqual',
  LessThan: 'LessThan',
  LessThanOrEqual: 'LessThanOrEqual',
  Contains: 'Contains',
  DoesNotContain: 'DoesNotContain',
  StartsWith: 'StartsWith',
  On: 'Is',
  Before: 'LessThan',
  After: 'GreaterThan',
  IsBlank: 'IsBlank',
  IsNotBlank: 'IsNotBlank',
  Between: 'Between',
};

const RULE_OPERATOR_BY_PAYLOAD: Record<string, AdvancedOperator> = {
  Is: 'Equals',
  IsNot: 'DoesNotEqual',
  GreaterThan: 'GreaterThan',
  GreaterThanOrEqual: 'GreaterThanOrEqual',
  LessThan: 'LessThan',
  LessThanOrEqual: 'LessThanOrEqual',
  Contains: 'Contains',
  DoesNotContain: 'DoesNotContain',
  StartsWith: 'StartsWith',
  IsBlank: 'IsBlank',
  IsNotBlank: 'IsNotBlank',
};

export function createInitialState(activeTab: FilterPaneTab = 'basic', isOpen = false): FilterPaneState {
  return { activeTab, isOpen, fieldFilters: {}, advancedRules: [] };
}

export function buildFilterTarget(
  source: powerbi.DataViewMetadataColumn,
  kind: 'column' | 'measure' = 'column',
): FilterTarget {
  const queryName = source.queryName || source.displayName || 'Field.Field';
  const [tablePart, ...columnParts] = queryName.split('.');
  const fieldName = stripFieldBrackets(columnParts.join('.') || source.displayName || queryName);
  return {
    kind,
    table: tablePart || source.displayName || 'Field',
    ...(kind === 'measure' ? { measure: fieldName } : { column: fieldName }),
    queryName,
  };
}

export function extractFilterFields(dataView: powerbi.DataView | undefined): FilterField[] {
  const fields: FilterField[] = [];
  const categorical = dataView?.categorical;
  if (!categorical) return fields;

  const categoryColumns = Array.from(categorical.categories ?? []);
  for (const column of categoryColumns) {
    if (!column.source.roles?.filterCategory) continue;
    fields.push(createField(
      column.source,
      column.values ?? [],
      'filterCategory',
      detectFieldType(column.source),
      'column',
    ));
  }

  for (const column of Array.from(categorical.values ?? [])) {
    if (!column.source.roles?.filterMeasure) continue;
    fields.push(createField(
      column.source,
      [],
      'filterMeasure',
      'numeric',
      'measure',
    ));
  }

  return fields;
}

export function ensureFieldState(state: FilterPaneState, fields: FilterField[]): FilterPaneState {
  const fieldIds = new Set(fields.map((field) => field.id));
  const fieldFilters: Record<string, FieldFilterState> = {};
  for (const field of fields) {
    fieldFilters[field.id] = {
      selectedValues: [...(state.fieldFilters[field.id]?.selectedValues ?? [])],
    };
  }

  return {
    ...state,
    fieldFilters,
    advancedRules: state.advancedRules.filter((rule) => fieldIds.has(rule.fieldId)),
  };
}

export function buildBasicFilter(field: FilterField, selectedKeys: string[]): powerbi.IFilter | null {
  if (field.target.kind !== 'column') return null;
  if (selectedKeys.length === 0) return null;
  if (areAllLoadedOptionsSelected(field, selectedKeys)) return null;

  const selected = selectedKeys
    .map((key) => {
      const option = field.options.find((candidate) => candidate.key === key);
      return option?.value ?? parseSelectedKey(field, key);
    })
    .filter((value): value is FilterPrimitive => value !== null);

  if (selected.length === 0) return null;

  return {
    $schema: BASIC_SCHEMA,
    target: toJsonTarget(field.target),
    operator: 'In',
    values: selected,
  } as unknown as powerbi.IFilter;
}

export function buildAdvancedFilter(field: FilterField, rule: AdvancedRuleState): powerbi.IFilter | null {
  if (!rule.isValid) return null;
  if (rule.operator === 'Between') return buildBetweenFilter(field, rule);

  const condition = buildAdvancedCondition(field, rule);
  if (!condition) return null;

  return {
    $schema: ADVANCED_SCHEMA,
    target: toJsonTarget(field.target),
    logicalOperator: 'And',
    conditions: [condition],
  } as unknown as powerbi.IFilter;
}

export function buildBetweenFilter(field: FilterField, rule: AdvancedRuleState): powerbi.IFilter | null {
  if (!rule.isValid || rule.value === null || rule.valueTo === null) return null;
  const value = parseInputValue(field, rule.value);
  const valueTo = parseInputValue(field, rule.valueTo);
  if (value === null || valueTo === null) return null;

  return {
    $schema: ADVANCED_SCHEMA,
    target: toJsonTarget(field.target),
    logicalOperator: 'And',
    conditions: [
      { operator: 'GreaterThanOrEqual', value },
      { operator: 'LessThanOrEqual', value: valueTo },
    ],
  } as unknown as powerbi.IFilter;
}

export function buildFiltersFromState(fields: FilterField[], state: FilterPaneState): powerbi.IFilter[] {
  const filters: powerbi.IFilter[] = [];
  for (const field of fields) {
    const selectedValues = state.fieldFilters[field.id]?.selectedValues ?? [];
    const basicFilter = buildBasicFilter(field, selectedValues);
    if (basicFilter) filters.push(basicFilter);
  }

  const rulesByField = new Map<string, AdvancedRuleState[]>();
  for (const rule of state.advancedRules.filter((candidate) => candidate.isValid)) {
    const existing = rulesByField.get(rule.fieldId) ?? [];
    existing.push(rule);
    rulesByField.set(rule.fieldId, existing);
  }

  for (const [fieldId, rules] of rulesByField) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (!field) continue;
    const supportedRules: AdvancedRuleState[] = [];
    let conditionCount = 0;
    for (const rule of rules) {
      const ruleConditionCount = getAdvancedConditionCost(rule.operator);
      if (conditionCount + ruleConditionCount > MAX_ADVANCED_CONDITIONS_PER_FIELD) continue;
      supportedRules.push(rule);
      conditionCount += ruleConditionCount;
    }
    const rangeRules = supportedRules.filter((rule) => rule.operator === 'Between');
    const conditionRules = supportedRules.filter((rule) => rule.operator !== 'Between');
    for (const rangeRule of rangeRules) {
      const advancedFilter = buildBetweenFilter(field, rangeRule);
      if (advancedFilter) filters.push(advancedFilter);
    }
    const conditions = conditionRules
      .map((rule) => buildAdvancedCondition(field, rule))
      .filter((condition): condition is Record<string, unknown> => condition !== null);
    if (conditions.length > 0) {
      filters.push({
        $schema: ADVANCED_SCHEMA,
        target: toJsonTarget(field.target),
        logicalOperator: shouldCombineWithOr(conditionRules) ? 'Or' : 'And',
        conditions,
      } as unknown as powerbi.IFilter);
    }
  }

  return filters;
}

export function restoreStateFromFilters(
  fields: FilterField[],
  filters: powerbi.IFilter[] | undefined,
  currentState: FilterPaneState = createInitialState(),
): FilterPaneState {
  let next = ensureFieldState(
    {
      ...currentState,
      fieldFilters: {},
      advancedRules: [],
    },
    fields,
  );
  if (!filters || filters.length === 0) return next;

  for (const filter of filters as Array<Record<string, unknown>>) {
    const target = filter.target as { table?: string; column?: string; measure?: string } | undefined;
    if (!target) continue;
    const field = fields.find((candidate) => targetsMatch(candidate.target, target));
    if (!field) continue;

    if (filter.$schema === BASIC_SCHEMA && filter.operator === 'In' && Array.isArray(filter.values)) {
      next.fieldFilters[field.id].selectedValues = filter.values.map((value) => serializeFilterValue(value));
      continue;
    }

    if (filter.$schema === ADVANCED_SCHEMA && Array.isArray(filter.conditions)) {
      const conditions = filter.conditions as Array<{ operator?: string; value?: unknown }>;
      const between = filter.logicalOperator === 'Or'
        ? null
        : restoreBetweenRule(field, conditions);
      if (between) {
        next.advancedRules.push(between);
        continue;
      }

      for (const condition of conditions) {
        const operator = condition.operator ? RULE_OPERATOR_BY_PAYLOAD[condition.operator] : undefined;
        if (!operator) continue;
        next.advancedRules.push(createAdvancedRule(
          field,
          operator,
          condition.value === undefined ? null : String(condition.value),
        ));
      }
    }
  }

  return next;
}

export function getActiveFilterCount(state: FilterPaneState): number {
  const basicCount = Object.values(state.fieldFilters)
    .filter((fieldState) => fieldState.selectedValues.length > 0)
    .length;
  const advancedCount = state.advancedRules.filter((rule) => rule.isValid).length;
  return basicCount + advancedCount;
}

export function createAdvancedRule(
  field: FilterField | undefined,
  operator: AdvancedOperator,
  value: string | null,
  valueTo: string | null = null,
): AdvancedRuleState {
  const fieldId = field?.id ?? '';
  const normalizedValue = normalizeInput(value);
  const normalizedValueTo = normalizeInput(valueTo);
  const isValueFree = operator === 'IsBlank' || operator === 'IsNotBlank';
  const hasValue = normalizedValue !== null;
  const hasValueTo = normalizedValueTo !== null;
  const isValid = Boolean(field)
    && (isValueFree || (operator === 'Between'
      ? hasValue && hasValueTo && isRuleValueValid(field!, normalizedValue) && isRuleValueValid(field!, normalizedValueTo)
      : hasValue && isRuleValueValid(field!, normalizedValue)));
  const display = field
    ? `${field.displayName} ${OPERATOR_LABELS[operator]}${operator === 'Between'
      ? ` ${normalizedValue ?? ''} and ${normalizedValueTo ?? ''}`
      : isValueFree ? '' : ` ${normalizedValue ?? ''}`}`
    : '';

  return {
    id: `rule-${fieldId}-${operator}-${normalizedValue ?? 'blank'}-${normalizedValueTo ?? ''}`,
    fieldId,
    operator,
    value: normalizedValue,
    valueTo: normalizedValueTo,
    display,
    isValid,
  };
}

export function getAdvancedOperatorLabel(operator: AdvancedOperator): string {
  return OPERATOR_LABELS[operator];
}

export function getAdvancedConditionCost(operator: AdvancedOperator): number {
  return operator === 'Between' ? 2 : 1;
}

function createField(
  source: powerbi.DataViewMetadataColumn,
  values: unknown[],
  role: string,
  fieldType: FilterFieldType,
  targetKind: 'column' | 'measure',
): FilterField {
  const target = buildFilterTarget(source, targetKind);
  return {
    id: target.queryName,
    displayName: source.displayName || target.column || target.measure || target.queryName,
    role,
    fieldType,
    target,
    options: buildOptions(values),
  };
}

function detectFieldType(source: powerbi.DataViewMetadataColumn): FilterFieldType {
  if (source.type?.dateTime === true || source.type?.temporal != null) return 'date';
  if (source.type?.numeric === true || source.type?.integer === true) return 'numeric';
  return 'category';
}

function buildOptions(values: unknown[]): FilterValueOption[] {
  const options = new Map<string, FilterValueOption>();
  for (const rawValue of values) {
    if (rawValue === null || rawValue === undefined) continue;
    const value = toFilterPrimitive(rawValue);
    if (value === null) continue;
    const key = serializeFilterValue(value);
    const existing = options.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      options.set(key, {
        key,
        value,
        label: key,
        count: 1,
      });
    }
  }
  return Array.from(options.values());
}

function toFilterPrimitive(value: unknown): FilterPrimitive | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function serializeFilterValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseInputValue(field: FilterField, value: string | null): FilterPrimitive | null {
  const normalized = normalizeInput(value);
  if (normalized === null) return null;
  if (field.fieldType === 'numeric') {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return normalized;
}

function parseSelectedKey(field: FilterField, key: string): FilterPrimitive | null {
  if (field.fieldType === 'numeric') {
    const parsed = Number(key);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return key;
}

function areAllLoadedOptionsSelected(field: FilterField, selectedKeys: string[]): boolean {
  if (field.options.length === 0 || selectedKeys.length !== field.options.length) return false;
  const selected = new Set(selectedKeys);
  return field.options.every((option) => selected.has(option.key));
}

function isRuleValueValid(field: FilterField, value: string | null): boolean {
  if (value === null) return false;
  if (field.fieldType !== 'numeric') return true;
  return Number.isFinite(Number(value));
}

function buildAdvancedCondition(field: FilterField, rule: AdvancedRuleState): Record<string, unknown> | null {
  if (!rule.isValid || rule.operator === 'Between') return null;
  const condition: Record<string, unknown> = {
    operator: PAYLOAD_OPERATOR_BY_RULE[rule.operator],
  };
  if (rule.operator !== 'IsBlank' && rule.operator !== 'IsNotBlank') {
    const value = parseInputValue(field, rule.value);
    if (value === null) return null;
    condition.value = value;
  }
  return condition;
}

function normalizeInput(value: string | null): string | null {
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toJsonTarget(target: FilterTarget): Record<string, unknown> {
  if (target.kind === 'measure') {
    return {
      $schema: MEASURE_TARGET_SCHEMA,
      table: target.table,
      measure: target.measure,
    };
  }
  return { table: target.table, column: target.column };
}

function targetsMatch(
  fieldTarget: FilterTarget,
  filterTarget: { table?: string; column?: string; measure?: string },
): boolean {
  if (fieldTarget.table !== filterTarget.table) return false;
  return fieldTarget.kind === 'measure'
    ? fieldTarget.measure === filterTarget.measure
    : fieldTarget.column === filterTarget.column;
}

function shouldCombineWithOr(rules: AdvancedRuleState[]): boolean {
  if (rules.length <= 1) return false;
  const alternativeOperators = new Set<AdvancedOperator>([
    'Equals',
    'On',
    'Contains',
    'StartsWith',
  ]);
  return rules.every((rule) => alternativeOperators.has(rule.operator));
}

function stripFieldBrackets(value: string): string {
  return value.replace(/^\[|\]$/g, '');
}

function restoreBetweenRule(
  field: FilterField,
  conditions: Array<{ operator?: string; value?: unknown }>,
): AdvancedRuleState | null {
  if (conditions.length !== 2) return null;
  const lower = conditions.find((condition) => condition.operator === 'GreaterThanOrEqual');
  const upper = conditions.find((condition) => condition.operator === 'LessThanOrEqual');
  if (!lower || !upper || lower.value === undefined || upper.value === undefined) return null;
  return createAdvancedRule(field, 'Between', String(lower.value), String(upper.value));
}
