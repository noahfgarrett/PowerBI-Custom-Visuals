/**
 * DataView mock builder for Power BI visual tests.
 * Provides a fluent API and static factories for common data shapes.
 */

import { createMockHost } from './mock-host';

interface CategoryColumn {
  source: {
    displayName: string;
    queryName: string;
    type: Record<string, boolean>;
    roles: Record<string, boolean>;
    objects?: Record<string, Record<string, unknown>>;
  };
  values: unknown[];
  identity?: unknown[];
}

interface ValueColumn {
  source: {
    displayName: string;
    queryName: string;
    type: { numeric: boolean };
    roles: Record<string, boolean>;
    objects?: Record<string, Record<string, unknown>>;
  };
  values: (number | null)[];
  maxLocal?: number;
  minLocal?: number;
}

interface BuiltDataView {
  metadata: {
    columns: Array<{ displayName: string; queryName: string; roles: Record<string, boolean>; type: Record<string, boolean> }>;
    objects?: Record<string, Record<string, unknown>>;
  };
  categorical?: {
    categories?: CategoryColumn[];
    values?: ValueColumn[];
  };
  table?: {
    columns: Array<{ displayName: string; queryName: string; roles: Record<string, boolean> }>;
    rows: unknown[][];
  };
}

/**
 * Fluent builder for constructing Power BI DataView mocks.
 */
export class DataViewBuilder {
  private categories: CategoryColumn[] = [];
  private values: ValueColumn[] = [];
  private metadataObjects?: Record<string, Record<string, unknown>>;

  withCategory(
    name: string,
    values: unknown[],
    role?: string,
  ): DataViewBuilder {
    const roleName = role ?? 'category';
    this.categories.push({
      source: {
        displayName: name,
        queryName: `${name}.${name}`,
        type: { text: true },
        roles: { [roleName]: true },
      },
      values,
      identity: values.map((_, i) => ({ key: `id_${i}` })),
    });
    return this;
  }

  withValues(
    name: string,
    values: (number | null)[],
    role?: string,
  ): DataViewBuilder {
    const roleName = role ?? 'values';
    const numericValues = values.filter((v): v is number => v !== null);
    this.values.push({
      source: {
        displayName: name,
        queryName: `${name}.${name}`,
        type: { numeric: true },
        roles: { [roleName]: true },
      },
      values,
      maxLocal: numericValues.length > 0 ? Math.max(...numericValues) : undefined,
      minLocal: numericValues.length > 0 ? Math.min(...numericValues) : undefined,
    });
    return this;
  }

  withMetadataObjects(objects: Record<string, Record<string, unknown>>): DataViewBuilder {
    this.metadataObjects = objects;
    return this;
  }

  withColumnObjects(
    valueIndex: number,
    objectName: string,
    properties: Record<string, unknown>,
  ): DataViewBuilder {
    if (this.values[valueIndex]) {
      if (!this.values[valueIndex].source.objects) {
        this.values[valueIndex].source.objects = {};
      }
      this.values[valueIndex].source.objects![objectName] = properties;
    }
    return this;
  }

  build(): BuiltDataView {
    const allColumns = [
      ...this.categories.map((c) => ({
        displayName: c.source.displayName,
        queryName: c.source.queryName,
        roles: c.source.roles,
        type: c.source.type,
      })),
      ...this.values.map((v) => ({
        displayName: v.source.displayName,
        queryName: v.source.queryName,
        roles: v.source.roles,
        type: v.source.type,
      })),
    ];

    const dv: BuiltDataView = {
      metadata: {
        columns: allColumns,
        ...(this.metadataObjects ? { objects: this.metadataObjects } : {}),
      },
      categorical: {
        categories: this.categories.length > 0 ? this.categories : undefined,
        values: this.values.length > 0 ? this.values : undefined,
      },
    };

    return dv;
  }

  // ── Static Factories ────────────────────────────────────────────

  /** Empty DataView with no data. */
  static empty(): BuiltDataView {
    return {
      metadata: { columns: [] },
      categorical: { categories: undefined, values: undefined },
    };
  }

  /** Single category column + single measure column. */
  static singleCategoryMeasure(
    categories: string[],
    values: (number | null)[],
    options?: { categoryRole?: string; valueRole?: string },
  ): BuiltDataView {
    return new DataViewBuilder()
      .withCategory('Category', categories, options?.categoryRole)
      .withValues('Value', values, options?.valueRole)
      .build();
  }

  /** Multiple value columns (measures only, no category axis). */
  static measuresOnly(
    measures: Array<{ name: string; values: (number | null)[]; role?: string }>,
  ): BuiltDataView {
    const builder = new DataViewBuilder();
    for (const m of measures) {
      builder.withValues(m.name, m.values, m.role);
    }
    return builder.build();
  }

  /** Multi-series: one category + multiple value columns. */
  static multiSeries(
    categories: string[],
    series: Array<{ name: string; values: (number | null)[]; role?: string }>,
    options?: { categoryRole?: string },
  ): BuiltDataView {
    const builder = new DataViewBuilder()
      .withCategory('Category', categories, options?.categoryRole);
    for (const s of series) {
      builder.withValues(s.name, s.values, s.role);
    }
    return builder.build();
  }

  /** Relational (source → target + weight) for chord/sankey/network. */
  static relational(
    rows: Array<{ source: string; target: string; weight: number }>,
    options?: { sourceRole?: string; targetRole?: string; weightRole?: string },
  ): BuiltDataView {
    const sourceRole = options?.sourceRole ?? 'source';
    const targetRole = options?.targetRole ?? 'target';
    const weightRole = options?.weightRole ?? 'weight';

    return new DataViewBuilder()
      .withCategory('Source', rows.map((r) => r.source), sourceRole)
      .withCategory('Target', rows.map((r) => r.target), targetRole)
      .withValues('Weight', rows.map((r) => r.weight), weightRole)
      .build();
  }
}
