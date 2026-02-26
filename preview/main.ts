/**
 * Preview dashboard entry point.
 * Renders all 30 visuals into glass card containers with mock data.
 */

import { renderKpiCard } from './renderers/kpi-card';
import { renderRadialGauge } from './renderers/radial-gauge';
import { renderBarChart } from './renderers/bar-chart';
import { renderSankey } from './renderers/sankey';
import { renderDonut, renderPolar, renderRingStack, renderGaugeCluster } from './renderers/arc-visuals';
import { renderProgressBars, renderBullet, renderFunnel, renderWaffle } from './renderers/bar-visuals';
import { renderArea, renderStream, renderDumbbell, renderSlope, renderBump } from './renderers/line-visuals';
import { renderScatter, renderBoxPlot, renderWaterfall } from './renderers/scatter-box-waterfall';
import { renderSunburst, renderTreemap } from './renderers/hierarchy-visuals';
import { renderChord, renderNetwork } from './renderers/network-chord';
import { renderBarRace } from './renderers/bar-race';
import { renderHeatmap, renderRadar, renderStatus, renderTimeline, renderGantt } from './renderers/special-visuals';

import {
  KPI_DATA, GAUGE_DATA, WELDING_DATA, SOR_DATA, ELECTRICAL_DATA, SANKEY_DATA,
  DONUT_DATA, POLAR_DATA, RING_STACK_DATA, GAUGE_CLUSTER_DATA,
  PROGRESS_DATA, BULLET_DATA, FUNNEL_DATA, WAFFLE_DATA,
  AREA_DATA, STREAM_DATA, DUMBBELL_DATA, SLOPE_DATA, BUMP_DATA,
  SCATTER_DATA, BOX_PLOT_DATA, WATERFALL_DATA,
  SUNBURST_DATA, TREEMAP_DATA, CHORD_DATA, NETWORK_DATA,
  BAR_RACE_DATA, HEATMAP_DATA, RADAR_DATA, STATUS_DATA,
  TIMELINE_DATA, GANTT_DATA,
} from './mock-data';
import type { ColorMode } from '../packages/core/src';

// ── Theme Toggle ─────────────────────────────────────────────

let currentMode: ColorMode = 'light';

function initThemeToggle(): void {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    currentMode = currentMode === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark', currentMode === 'dark');
    renderAll();
  });
}

// ── Render All Visuals ───────────────────────────────────────

function renderAll(): void {
  // ── Batch 1: Original 4 Visuals ───────────────────────────
  renderKpiCard('kpi-inspections', KPI_DATA.inspections, currentMode);
  renderKpiCard('kpi-sors', KPI_DATA.sors, currentMode);
  renderKpiCard('kpi-cors', KPI_DATA.cors, currentMode);
  renderKpiCard('kpi-ncrs', KPI_DATA.ncrs, currentMode);
  renderRadialGauge('gauge-ncr-pass', GAUGE_DATA, currentMode);
  renderBarChart('chart-welding', WELDING_DATA, 'combo', currentMode);
  renderBarChart('chart-sors', SOR_DATA, 'stacked', currentMode);
  renderBarChart('chart-electrical', ELECTRICAL_DATA, 'combo', currentMode);
  renderSankey('chart-sankey', SANKEY_DATA, currentMode);

  // ── Arc & Ring Visuals ────────────────────────────────────
  renderDonut('v-donut', DONUT_DATA, currentMode);
  renderPolar('v-polar', POLAR_DATA, currentMode);
  renderRingStack('v-ring-stack', RING_STACK_DATA, currentMode);
  renderGaugeCluster('v-gauge-cluster', GAUGE_CLUSTER_DATA, currentMode);

  // ── Bar & Progress Visuals ────────────────────────────────
  renderProgressBars('v-progress', PROGRESS_DATA, currentMode);
  renderBullet('v-bullet', BULLET_DATA, currentMode);
  renderFunnel('v-funnel', FUNNEL_DATA, currentMode);
  renderWaffle('v-waffle', WAFFLE_DATA, currentMode);
  renderBarRace('v-bar-race', BAR_RACE_DATA, currentMode);
  renderWaterfall('v-waterfall', WATERFALL_DATA, currentMode);

  // ── Line & Area Visuals ───────────────────────────────────
  renderArea('v-area', AREA_DATA, currentMode);
  renderStream('v-stream', STREAM_DATA, currentMode);
  renderBump('v-bump', BUMP_DATA, currentMode);

  // ── Comparison Visuals ────────────────────────────────────
  renderDumbbell('v-dumbbell', DUMBBELL_DATA, currentMode);
  renderSlope('v-slope', SLOPE_DATA, currentMode);
  renderScatter('v-scatter', SCATTER_DATA, currentMode);
  renderBoxPlot('v-box-plot', BOX_PLOT_DATA, currentMode);
  renderRadar('v-radar', RADAR_DATA, currentMode);

  // ── Hierarchy & Network ───────────────────────────────────
  renderSunburst('v-sunburst', SUNBURST_DATA, currentMode);
  renderTreemap('v-treemap', TREEMAP_DATA, currentMode);
  renderChord('v-chord', CHORD_DATA, currentMode);
  renderNetwork('v-network', NETWORK_DATA, currentMode);

  // ── Calendar, Grid & Indicators ───────────────────────────
  renderHeatmap('v-heatmap', HEATMAP_DATA, currentMode);
  renderStatus('v-status', STATUS_DATA, currentMode);

  // ── Timeline & Scheduling ─────────────────────────────────
  renderTimeline('v-timeline', TIMELINE_DATA, currentMode);
  renderGantt('v-gantt', GANTT_DATA, currentMode);
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  renderAll();
});
