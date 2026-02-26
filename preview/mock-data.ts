/**
 * QC-themed mock data for the preview dashboard.
 * Modeled after real QCx Dashboard metrics.
 */

// ── KPI Card Data ────────────────────────────────────────────

export interface KpiData {
  label: string;
  value: number | null;
  previousValue?: number | null;
  target?: number;
  trend?: number[];
  format: 'number' | 'currency' | 'percent';
}

export const KPI_DATA: Record<string, KpiData> = {
  inspections: {
    label: 'Final Inspections',
    value: 32,
    previousValue: 28,
    trend: [18, 22, 19, 25, 28, 30, 32],
    format: 'number',
  },
  sors: {
    label: 'SOR Count',
    value: 34,
    previousValue: 29,
    trend: [12, 18, 22, 25, 29, 31, 34],
    format: 'number',
  },
  cors: {
    label: 'COR Count',
    value: 7,
    previousValue: 5,
    trend: [2, 3, 4, 3, 5, 6, 7],
    format: 'number',
  },
  ncrs: {
    label: 'NCR Count',
    value: 3,
    previousValue: 4,
    trend: [6, 5, 4, 5, 3, 4, 3],
    format: 'number',
  },
};

// ── Radial Gauge Data ────────────────────────────────────────

export interface GaugeData {
  label: string;
  value: number;
  min: number;
  max: number;
  target: number;
  zones: Array<{ threshold: number; color: string }>;
  format: 'percent' | 'number';
}

export const GAUGE_DATA: GaugeData = {
  label: 'NCR Pass Rate',
  value: 97.1,
  min: 0,
  max: 100,
  target: 95,
  zones: [
    { threshold: 80, color: '#F87171' },   // red zone: 0–80%
    { threshold: 95, color: '#FBBF24' },   // yellow zone: 80–95%
    { threshold: 100, color: '#34D399' },  // green zone: 95–100%
  ],
  format: 'percent',
};

// ── Bar Chart Data ───────────────────────────────────────────

export interface BarChartData {
  title: string;
  categories: string[];
  series: Array<{
    name: string;
    values: number[];
    type: 'bar' | 'line';
    color?: string;
  }>;
  referenceLine?: {
    label: string;
    value: number;
    style: 'dashed' | 'solid';
  };
}

export const WELDING_DATA: BarChartData = {
  title: 'Welding Signoffs by Work Week',
  categories: ['WW01', 'WW02', 'WW03', 'WW04', 'WW05', 'WW06', 'WW07'],
  series: [
    {
      name: 'Signed Welds',
      values: [8, 12, 15, 18, 22, 25, 28],
      type: 'bar',
      color: '#64748B',
    },
    {
      name: 'Total Welds',
      values: [20, 25, 28, 30, 35, 38, 42],
      type: 'bar',
      color: '#7DD3FC',
    },
    {
      name: 'Sign-off %',
      values: [40, 48, 54, 60, 63, 66, 67],
      type: 'line',
      color: '#F28C38',
    },
  ],
  referenceLine: {
    label: 'Baseline 10%',
    value: 10,
    style: 'dashed',
  },
};

export const SOR_DATA: BarChartData = {
  title: 'Cumulative SORs by Work Week',
  categories: ['WW01', 'WW02', 'WW03', 'WW04', 'WW05', 'WW06', 'WW07'],
  series: [
    {
      name: 'Weekly SORs',
      values: [3, 5, 4, 7, 5, 6, 4],
      type: 'bar',
      color: '#7DD3FC',
    },
    {
      name: 'Cumulative Total',
      values: [3, 8, 12, 19, 24, 30, 34],
      type: 'line',
      color: '#F28C38',
    },
  ],
};

export const ELECTRICAL_DATA: BarChartData = {
  title: 'Electrical Inspections vs. Issues Found',
  categories: ['WW01', 'WW02', 'WW03', 'WW04', 'WW05', 'WW06', 'WW07'],
  series: [
    {
      name: 'Final Inspection',
      values: [5, 7, 6, 8, 7, 9, 8],
      type: 'bar',
      color: '#64748B',
    },
    {
      name: 'COR Count',
      values: [1, 2, 1, 3, 2, 2, 3],
      type: 'line',
      color: '#5EEAD4',
    },
    {
      name: 'NCR Count',
      values: [0, 1, 0, 1, 1, 0, 1],
      type: 'line',
      color: '#A78BFA',
    },
  ],
};

// ── Sankey Data ──────────────────────────────────────────────

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  title: string;
  links: SankeyLink[];
}

export const SANKEY_DATA: SankeyData = {
  title: 'Inspection → Finding → Outcome',
  links: [
    { source: 'Welding Inspection', target: 'Minor Defect', value: 12 },
    { source: 'Welding Inspection', target: 'Major Defect', value: 4 },
    { source: 'Welding Inspection', target: 'No Issues', value: 18 },
    { source: 'Electrical Inspection', target: 'Minor Defect', value: 8 },
    { source: 'Electrical Inspection', target: 'Major Defect', value: 2 },
    { source: 'Electrical Inspection', target: 'No Issues', value: 14 },
    { source: 'Structural Inspection', target: 'Minor Defect', value: 6 },
    { source: 'Structural Inspection', target: 'Major Defect', value: 1 },
    { source: 'Structural Inspection', target: 'No Issues', value: 22 },
    { source: 'Minor Defect', target: 'Rework Completed', value: 20 },
    { source: 'Minor Defect', target: 'Waiver Granted', value: 6 },
    { source: 'Major Defect', target: 'Rework Completed', value: 4 },
    { source: 'Major Defect', target: 'NCR Issued', value: 3 },
    { source: 'No Issues', target: 'Passed', value: 54 },
  ],
};

// ── Donut / Polar / Ring Stack ──────────────────────────────

export interface CategoryValue { label: string; value: number; color?: string }

export const DONUT_DATA: CategoryValue[] = [
  { label: 'Welding', value: 34, color: '#3B82F6' },
  { label: 'Electrical', value: 22, color: '#8B5CF6' },
  { label: 'Structural', value: 18, color: '#F28C38' },
  { label: 'Piping', value: 14, color: '#10B981' },
  { label: 'HVAC', value: 8, color: '#F43F5E' },
];

export const POLAR_DATA: CategoryValue[] = [
  { label: 'Safety', value: 92 },
  { label: 'Quality', value: 87 },
  { label: 'Schedule', value: 73 },
  { label: 'Cost', value: 81 },
  { label: 'Scope', value: 65 },
  { label: 'Comm.', value: 78 },
];

export interface RingData { label: string; value: number; max: number; color: string }

export const RING_STACK_DATA: RingData[] = [
  { label: 'Inspections', value: 32, max: 40, color: '#EF4444' },
  { label: 'SORs Closed', value: 28, max: 34, color: '#34D399' },
  { label: 'NCRs Resolved', value: 2, max: 3, color: '#3B82F6' },
];

// ── Gauge Cluster ───────────────────────────────────────────

export interface MiniGauge { label: string; value: number; max: number; color: string }

export const GAUGE_CLUSTER_DATA: MiniGauge[] = [
  { label: 'Weld Pass', value: 97, max: 100, color: '#34D399' },
  { label: 'Elec Pass', value: 91, max: 100, color: '#3B82F6' },
  { label: 'NCR Rate', value: 3.2, max: 10, color: '#FBBF24' },
  { label: 'On-Time', value: 88, max: 100, color: '#8B5CF6' },
];

// ── Progress Bar / Bullet / Funnel ──────────────────────────

export interface ProgressItem { label: string; value: number; target?: number; color?: string }

export const PROGRESS_DATA: ProgressItem[] = [
  { label: 'Phase 1 — Foundation', value: 100, target: 100, color: '#34D399' },
  { label: 'Phase 2 — Steel', value: 85, target: 100, color: '#3B82F6' },
  { label: 'Phase 3 — MEP', value: 42, target: 100, color: '#F28C38' },
  { label: 'Phase 4 — Finishing', value: 12, target: 100, color: '#8B5CF6' },
];

export interface BulletItem { label: string; value: number; target: number; ranges: [number, number, number] }

export const BULLET_DATA: BulletItem[] = [
  { label: 'Inspections/Wk', value: 32, target: 28, ranges: [15, 25, 40] },
  { label: 'SOR Close Rate', value: 82, target: 90, ranges: [50, 75, 100] },
  { label: 'NCR Response (h)', value: 18, target: 24, ranges: [48, 36, 24] },
];

export interface FunnelStage { label: string; value: number }

export const FUNNEL_DATA: FunnelStage[] = [
  { label: 'Inspections Scheduled', value: 120 },
  { label: 'Inspections Completed', value: 98 },
  { label: 'Issues Found', value: 34 },
  { label: 'NCRs Raised', value: 7 },
  { label: 'NCRs Closed', value: 3 },
];

// ── Waffle ──────────────────────────────────────────────────

export interface WaffleData { label: string; value: number; max: number }

export const WAFFLE_DATA: WaffleData = { label: 'QC Completion', value: 73, max: 100 };

// ── Area / Stream / Line Charts ─────────────────────────────

export interface MultiSeriesData {
  title: string;
  categories: string[];
  series: Array<{ name: string; values: number[]; color: string }>;
}

export const AREA_DATA: MultiSeriesData = {
  title: 'Defect Trends',
  categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  series: [
    { name: 'Welding', values: [12, 15, 11, 18, 14, 10], color: '#3B82F6' },
    { name: 'Electrical', values: [8, 6, 9, 7, 5, 6], color: '#8B5CF6' },
    { name: 'Structural', values: [3, 4, 2, 5, 3, 2], color: '#F28C38' },
  ],
};

export const STREAM_DATA: MultiSeriesData = {
  title: 'Issue Volume by Type',
  categories: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
  series: [
    { name: 'SOR', values: [5, 8, 6, 9, 7, 4, 6, 5], color: '#3B82F6' },
    { name: 'COR', values: [2, 3, 1, 4, 2, 3, 1, 2], color: '#F28C38' },
    { name: 'NCR', values: [1, 0, 1, 2, 1, 0, 1, 0], color: '#EF4444' },
  ],
};

// ── Dumbbell / Slope ────────────────────────────────────────

export interface DumbbellItem { label: string; start: number; end: number }

export const DUMBBELL_DATA: DumbbellItem[] = [
  { label: 'Welding', start: 72, end: 94 },
  { label: 'Electrical', start: 65, end: 88 },
  { label: 'Structural', start: 80, end: 91 },
  { label: 'Piping', start: 58, end: 85 },
  { label: 'HVAC', start: 70, end: 82 },
];

export const SLOPE_DATA: DumbbellItem[] = [
  { label: 'Pass Rate', start: 85, end: 97 },
  { label: 'On-Time %', start: 72, end: 88 },
  { label: 'Budget %', start: 95, end: 91 },
  { label: 'Safety Score', start: 88, end: 96 },
];

// ── Scatter Bubble ──────────────────────────────────────────

export interface ScatterPoint { label: string; x: number; y: number; size: number; color?: string }

export const SCATTER_DATA: ScatterPoint[] = [
  { label: 'Zone A', x: 85, y: 92, size: 30, color: '#3B82F6' },
  { label: 'Zone B', x: 72, y: 78, size: 45, color: '#8B5CF6' },
  { label: 'Zone C', x: 90, y: 88, size: 20, color: '#34D399' },
  { label: 'Zone D', x: 60, y: 65, size: 55, color: '#F28C38' },
  { label: 'Zone E', x: 78, y: 95, size: 15, color: '#F43F5E' },
  { label: 'Zone F', x: 55, y: 70, size: 35, color: '#FBBF24' },
];

// ── Box Plot ────────────────────────────────────────────────

export interface BoxPlotItem { label: string; min: number; q1: number; median: number; q3: number; max: number; outliers?: number[] }

export const BOX_PLOT_DATA: BoxPlotItem[] = [
  { label: 'Welding', min: 2, q1: 8, median: 14, q3: 20, max: 28, outliers: [35] },
  { label: 'Electrical', min: 1, q1: 5, median: 10, q3: 15, max: 22 },
  { label: 'Structural', min: 0, q1: 3, median: 7, q3: 12, max: 18 },
  { label: 'Piping', min: 3, q1: 9, median: 16, q3: 22, max: 30, outliers: [38] },
];

// ── Waterfall ───────────────────────────────────────────────

export interface WaterfallItem { label: string; value: number; type: 'increase' | 'decrease' | 'total' }

export const WATERFALL_DATA: WaterfallItem[] = [
  { label: 'Starting NCRs', value: 12, type: 'total' },
  { label: 'New Welding', value: 5, type: 'increase' },
  { label: 'New Electrical', value: 3, type: 'increase' },
  { label: 'Resolved', value: -8, type: 'decrease' },
  { label: 'Waived', value: -2, type: 'decrease' },
  { label: 'New Piping', value: 2, type: 'increase' },
  { label: 'End Total', value: 12, type: 'total' },
];

// ── Sunburst / Treemap ──────────────────────────────────────

export interface HierarchyNode { name: string; value?: number; children?: HierarchyNode[]; color?: string }

export const SUNBURST_DATA: HierarchyNode = {
  name: 'All Inspections',
  children: [
    { name: 'Welding', color: '#3B82F6', children: [
      { name: 'Pass', value: 28 }, { name: 'Fail', value: 4 }, { name: 'Pending', value: 2 },
    ] },
    { name: 'Electrical', color: '#8B5CF6', children: [
      { name: 'Pass', value: 20 }, { name: 'Fail', value: 2 }, { name: 'Pending', value: 1 },
    ] },
    { name: 'Structural', color: '#F28C38', children: [
      { name: 'Pass', value: 18 }, { name: 'Fail', value: 1 }, { name: 'Pending', value: 3 },
    ] },
  ],
};

export const TREEMAP_DATA: HierarchyNode = {
  name: 'QC Hours',
  children: [
    { name: 'Inspections', color: '#3B82F6', children: [
      { name: 'Welding', value: 120 }, { name: 'Electrical', value: 85 }, { name: 'Structural', value: 95 },
    ] },
    { name: 'Documentation', color: '#8B5CF6', children: [
      { name: 'Reports', value: 60 }, { name: 'NCR Processing', value: 40 },
    ] },
    { name: 'Training', color: '#34D399', children: [
      { name: 'Safety', value: 30 }, { name: 'Procedures', value: 25 },
    ] },
  ],
};

// ── Chord / Network ─────────────────────────────────────────

export interface ChordLink { source: string; target: string; value: number }

export const CHORD_DATA: ChordLink[] = [
  { source: 'Welding', target: 'Electrical', value: 8 },
  { source: 'Welding', target: 'Structural', value: 5 },
  { source: 'Electrical', target: 'Piping', value: 6 },
  { source: 'Structural', target: 'HVAC', value: 4 },
  { source: 'Piping', target: 'Welding', value: 3 },
  { source: 'HVAC', target: 'Electrical', value: 2 },
];

export const NETWORK_DATA: ChordLink[] = [
  { source: 'NCR-001', target: 'Welding Team', value: 3 },
  { source: 'NCR-001', target: 'QC Lead', value: 2 },
  { source: 'NCR-002', target: 'Electrical Team', value: 4 },
  { source: 'NCR-002', target: 'QC Lead', value: 1 },
  { source: 'QC Lead', target: 'Project Mgr', value: 5 },
  { source: 'Welding Team', target: 'Supervisor', value: 2 },
  { source: 'Electrical Team', target: 'Supervisor', value: 3 },
];

// ── Bump Chart ──────────────────────────────────────────────

export interface BumpSeriesData {
  items: string[];
  periods: string[];
  ranks: number[][]; // ranks[itemIdx][periodIdx]
}

export const BUMP_DATA: BumpSeriesData = {
  items: ['Welding', 'Electrical', 'Structural', 'Piping'],
  periods: ['Q1', 'Q2', 'Q3', 'Q4'],
  ranks: [
    [2, 1, 1, 1],
    [1, 2, 3, 2],
    [3, 3, 2, 3],
    [4, 4, 4, 4],
  ],
};

// ── Bar Race ────────────────────────────────────────────────

export interface BarRaceFrame { period: string; items: Array<{ label: string; value: number }> }

export const BAR_RACE_DATA: BarRaceFrame[] = [
  { period: 'Jan', items: [{ label: 'Welding', value: 12 }, { label: 'Electrical', value: 8 }, { label: 'Structural', value: 15 }, { label: 'Piping', value: 6 }] },
  { period: 'Feb', items: [{ label: 'Welding', value: 20 }, { label: 'Electrical', value: 14 }, { label: 'Structural', value: 22 }, { label: 'Piping', value: 11 }] },
  { period: 'Mar', items: [{ label: 'Welding', value: 34 }, { label: 'Electrical', value: 22 }, { label: 'Structural', value: 28 }, { label: 'Piping', value: 18 }] },
];

// ── Heatmap Calendar ────────────────────────────────────────

export interface CalendarDay { date: string; value: number }

export const HEATMAP_DATA: CalendarDay[] = (() => {
  const days: CalendarDay[] = [];
  const base = new Date(2025, 0, 1);
  for (let i = 0; i < 90; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), value: Math.floor(Math.random() * 10) });
  }
  return days;
})();

// ── Radar ───────────────────────────────────────────────────

export interface RadarSeriesData {
  axes: string[];
  series: Array<{ name: string; values: number[]; color: string }>;
}

export const RADAR_DATA: RadarSeriesData = {
  axes: ['Safety', 'Quality', 'Schedule', 'Cost', 'Scope', 'Risk'],
  series: [
    { name: 'Current', values: [92, 87, 73, 81, 65, 78], color: '#3B82F6' },
    { name: 'Target', values: [95, 90, 85, 85, 80, 85], color: '#34D399' },
  ],
};

// ── Status Indicator ────────────────────────────────────────

export interface StatusItem { label: string; value: number; warnThreshold: number; critThreshold: number }

export const STATUS_DATA: StatusItem[] = [
  { label: 'Weld Pass Rate', value: 97.1, warnThreshold: 90, critThreshold: 80 },
  { label: 'Elec Pass Rate', value: 88.5, warnThreshold: 90, critThreshold: 80 },
  { label: 'NCR Response', value: 72, warnThreshold: 85, critThreshold: 70 },
  { label: 'Safety Score', value: 96, warnThreshold: 90, critThreshold: 80 },
];

// ── Timeline ────────────────────────────────────────────────

export interface MilestoneItem { date: string; label: string; category?: string }

export const TIMELINE_DATA: MilestoneItem[] = [
  { date: '2025-01-15', label: 'Foundation Complete', category: 'Structural' },
  { date: '2025-03-01', label: 'Steel Erection Start', category: 'Structural' },
  { date: '2025-04-20', label: 'MEP Rough-In', category: 'Electrical' },
  { date: '2025-06-15', label: 'Envelope Closed', category: 'Structural' },
  { date: '2025-08-01', label: 'Systems Testing', category: 'QC' },
  { date: '2025-09-30', label: 'Substantial Completion', category: 'QC' },
];

// ── Gantt ───────────────────────────────────────────────────

export interface GanttTask { name: string; start: string; end: string; progress: number; category?: string }

export const GANTT_DATA: GanttTask[] = [
  { name: 'Foundation', start: '2025-01-01', end: '2025-02-15', progress: 100, category: 'Structural' },
  { name: 'Steel Erection', start: '2025-02-01', end: '2025-04-30', progress: 85, category: 'Structural' },
  { name: 'MEP Rough-In', start: '2025-03-15', end: '2025-06-15', progress: 42, category: 'Electrical' },
  { name: 'Envelope', start: '2025-04-01', end: '2025-07-01', progress: 20, category: 'Structural' },
  { name: 'Systems Test', start: '2025-07-01', end: '2025-09-01', progress: 0, category: 'QC' },
];
