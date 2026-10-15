import { describe, expect, it } from 'vitest';
import { DataViewBuilder } from '../../../core/src/__test-utils__';
import {
  buildAdvancedFilter,
  buildBasicFilter,
  buildBetweenFilter,
  buildFiltersFromState,
  createAdvancedRule,
  createInitialState,
  ensureFieldState,
  extractFilterFields,
  getActiveFilterCount,
  restoreStateFromFilters,
  type FilterPaneState,
} from '../filter-model';

function buildFilterDataView() {
  const dataView = new DataViewBuilder()
    .withCategory('Region', ['North', 'South', 'North', 'West'], 'filterCategory')
    .withCategory('Status', ['Open', 'Closed', 'Open', 'Review'], 'filterCategory')
    .withCategory('Issue Count', [1, 5, 2, 8], 'filterCategory')
    .withValues('Measure Only', [10, 20, 30, 40], 'filterMeasure')
    .build();
  dataView.categorical!.categories![2].source.type = { numeric: true };
  return dataView;
}

describe('filter model', () => {
  it('extracts category and numeric fields with stable filter targets', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);

    expect(fields.map((field) => field.displayName)).toEqual([
      'Region',
      'Status',
      'Issue Count',
      'Measure Only',
    ]);
    expect(fields[0]).toMatchObject({
      id: 'Region.Region',
      fieldType: 'category',
      target: { table: 'Region', column: 'Region' },
      options: [
        { key: 'North', value: 'North', label: 'North', count: 2 },
        { key: 'South', value: 'South', label: 'South', count: 1 },
        { key: 'West', value: 'West', label: 'West', count: 1 },
      ],
    });
    expect(fields[2]).toMatchObject({
      id: 'Issue Count.Issue Count',
      fieldType: 'numeric',
      target: { table: 'Issue Count', column: 'Issue Count' },
    });
    expect(fields[3]).toMatchObject({
      id: 'Measure Only.Measure Only',
      fieldType: 'numeric',
      target: {
        kind: 'measure',
        table: 'Measure Only',
        measure: 'Measure Only',
      },
      options: [],
    });
  });

  it('builds basic In filters from selected option keys', () => {
    const [region] = extractFilterFields(buildFilterDataView() as never);
    const filter = buildBasicFilter(region, ['North', 'West']) as Record<string, unknown>;

    expect(filter).toMatchObject({
      $schema: 'https://powerbi.com/product/schema#basic',
      target: { table: 'Region', column: 'Region' },
      operator: 'In',
      values: ['North', 'West'],
    });
  });

  it('does not emit a basic filter when all loaded options are selected', () => {
    const [region] = extractFilterFields(buildFilterDataView() as never);

    expect(buildBasicFilter(region, region.options.map((option) => option.key))).toBeNull();
  });

  it('preserves restored values that are not in the current option window', () => {
    const [region] = extractFilterFields(buildFilterDataView() as never);
    const filter = buildBasicFilter(region, ['South', 'Archived']) as Record<string, unknown>;

    expect(filter).toMatchObject({
      values: ['South', 'Archived'],
    });
  });

  it('builds readable advanced rules and Power BI advanced filters', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const issueCount = fields.find((field) => field.displayName === 'Issue Count');
    const rule = createAdvancedRule(issueCount, 'GreaterThanOrEqual', '5');
    const filter = buildAdvancedFilter(issueCount!, rule) as Record<string, unknown>;

    expect(rule.display).toBe('Issue Count Greater than or equal to 5');
    expect(rule.isValid).toBe(true);
    expect(filter).toMatchObject({
      $schema: 'https://powerbi.com/product/schema#advanced',
      target: { table: 'Issue Count', column: 'Issue Count' },
      logicalOperator: 'And',
      conditions: [{ operator: 'GreaterThanOrEqual', value: 5 }],
    });
  });

  it('builds advanced measure filters with a measure target', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const measure = fields.find((field) => field.displayName === 'Measure Only')!;
    const rule = createAdvancedRule(measure, 'GreaterThanOrEqual', '5.5');
    const filter = buildAdvancedFilter(measure, rule) as Record<string, unknown>;

    expect(buildBasicFilter(measure, ['5.5'])).toBeNull();
    expect(filter).toMatchObject({
      $schema: 'https://powerbi.com/product/schema#advanced',
      target: {
        // Power BI's documented measure-target schema uses HTTP.
        // eslint-disable-next-line powerbi-visuals/no-http-string
        $schema: 'http://powerbi.com/product/schema#measure',
        table: 'Measure Only',
        measure: 'Measure Only',
      },
      conditions: [{ operator: 'GreaterThanOrEqual', value: 5.5 }],
    });
  });

  it('builds between filters as a pair of advanced conditions', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const issueCount = fields.find((field) => field.displayName === 'Issue Count');
    const rule = createAdvancedRule(issueCount, 'Between', '2.5', '7.75');
    const filter = buildBetweenFilter(issueCount!, rule) as Record<string, unknown>;

    expect(rule.display).toBe('Issue Count Between 2.5 and 7.75');
    expect(filter).toMatchObject({
      conditions: [
        { operator: 'GreaterThanOrEqual', value: 2.5 },
        { operator: 'LessThanOrEqual', value: 7.75 },
      ],
    });
  });

  it('marks invalid numeric advanced rules invalid instead of emitting null values', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const issueCount = fields.find((field) => field.displayName === 'Issue Count');
    const rule = createAdvancedRule(issueCount, 'GreaterThanOrEqual', 'not-a-number');

    expect(rule.isValid).toBe(false);
    expect(buildAdvancedFilter(issueCount!, rule)).toBeNull();
  });

  it('combines basic selections and advanced rules from visual state', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    let state = ensureFieldState(createInitialState('advanced', true), fields);
    state.fieldFilters[fields[0].id].selectedValues = ['North'];
    state.advancedRules = [createAdvancedRule(fields[2], 'LessThan', '8')];

    const filters = buildFiltersFromState(fields, state);

    expect(filters).toHaveLength(2);
    expect(getActiveFilterCount(state)).toBe(2);
  });

  it('groups repeated advanced rules for one field with OR conditions', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const state = ensureFieldState(createInitialState('advanced', true), fields);
    state.advancedRules = [
      createAdvancedRule(fields[0], 'Equals', 'North'),
      createAdvancedRule(fields[0], 'Equals', 'West'),
    ];

    const filters = buildFiltersFromState(fields, state) as Array<Record<string, unknown>>;

    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({
      target: { table: 'Region', column: 'Region' },
      logicalOperator: 'Or',
      conditions: [
        { operator: 'Is', value: 'North' },
        { operator: 'Is', value: 'West' },
      ],
    });
  });

  it('combines exclusion conditions with AND semantics', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const state = ensureFieldState(createInitialState('advanced', true), fields);
    state.advancedRules = [
      createAdvancedRule(fields[0], 'DoesNotEqual', 'North'),
      createAdvancedRule(fields[0], 'DoesNotEqual', 'West'),
    ];

    const filters = buildFiltersFromState(fields, state) as Array<Record<string, unknown>>;

    expect(filters[0]).toMatchObject({
      logicalOperator: 'And',
      conditions: [
        { operator: 'IsNot', value: 'North' },
        { operator: 'IsNot', value: 'West' },
      ],
    });
  });

  it('never emits more than two advanced conditions for one field', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const state = ensureFieldState(createInitialState('advanced', true), fields);
    state.advancedRules = [
      createAdvancedRule(fields[2], 'Between', '2', '8'),
      createAdvancedRule(fields[2], 'DoesNotEqual', '5'),
    ];

    const filters = buildFiltersFromState(fields, state) as Array<Record<string, unknown>>;

    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({
      logicalOperator: 'And',
      conditions: [
        { operator: 'GreaterThanOrEqual', value: 2 },
        { operator: 'LessThanOrEqual', value: 8 },
      ],
    });
  });

  it('restores basic selections and advanced rules from host JSON filters', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const state: FilterPaneState = restoreStateFromFilters(fields, [
      buildBasicFilter(fields[0], ['South'])!,
      buildAdvancedFilter(fields[2], createAdvancedRule(fields[2], 'LessThanOrEqual', '5'))!,
    ]);

    expect(state.fieldFilters[fields[0].id].selectedValues).toEqual(['South']);
    expect(state.advancedRules).toHaveLength(1);
    expect(state.advancedRules[0]).toMatchObject({
      fieldId: fields[2].id,
      operator: 'LessThanOrEqual',
      value: '5',
      isValid: true,
    });
  });

  it('does not reinterpret an OR range as a Between rule', () => {
    const fields = extractFilterFields(buildFilterDataView() as never);
    const issueCount = fields[2];
    const state = restoreStateFromFilters(fields, [{
      $schema: 'https://powerbi.com/product/schema#advanced',
      target: { table: 'Issue Count', column: 'Issue Count' },
      logicalOperator: 'Or',
      conditions: [
        { operator: 'GreaterThanOrEqual', value: 8 },
        { operator: 'LessThanOrEqual', value: 2 },
      ],
    } as never]);

    expect(state.advancedRules).toHaveLength(2);
    expect(state.advancedRules.map((rule) => rule.operator)).toEqual([
      'GreaterThanOrEqual',
      'LessThanOrEqual',
    ]);
    expect(state.advancedRules.every((rule) => rule.fieldId === issueCount.id)).toBe(true);
  });
});
