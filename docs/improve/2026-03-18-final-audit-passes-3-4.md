# Deep Audit Passes 3-4: Shared Card Bloat & Condense Opportunities

> Generated 2026-03-18 | Covers all 31 Power BI visuals

---

## Summary Table: Shared Card Waste % per Visual

"Waste %" = properties hidden or never referenced in visual code / total properties on imported card.

| Visual | Axis (18) | Legend (6) | DataLabel (6) | Title (12) | Scroll (2) | Number (4) | Sort (1) | RefLine (12) | TrendLine (8) | Target (10) | Conditional (7) | Crosshair (5) | Accessibility (1) | Annotation (13) | Series | LineStroke (2) | ColorTheme (1) | DateFilter (4) | Overall Waste % |
|--------|-----------|------------|----------------|------------|------------|------------|----------|-------------|---------------|-------------|-----------------|---------------|-------------------|-----------------|--------|---------------|---------------|----------------|-----------------|
| animated-donut-pro | -- | 33% | **83%** | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **22%** |
| animated-waterfall | **61%** | -- | **83%** | 0%* | 0% | 0%* | -- | 17% | 13% | -- | 0%* | -- | 0%* | 0%* | -- | -- | -- | 0% | **28%** |
| bar-chart-pro | 33% | 0% | 33% | 0%* | 0%* | 0%* | -- | 0% | 0% | -- | 0% | -- | 0%* | 0% | 0% | -- | 0%* | 0% | **7%** |
| bar-race | **89%** | -- | **83%** | 0%* | -- | 0%* | -- | 17% | 13% | -- | 0%* | -- | 0%* | 0%* | -- | -- | 0%* | 0% | **39%** |
| box-plot | **61%** | 33% | 0%* | 0%* | 0% | 0%* | -- | 17% | 13% | -- | 0%* | -- | 0%* | -- | 0% | -- | 0%* | 0% | **18%** |
| bullet-chart-pro | **89%** | -- | **83%** | 0%* | 0% | 0%* | -- | 17% | 13% | -- | 0%* | -- | 0%* | 0%* | -- | -- | -- | 0% | **35%** |
| bump-chart | **67%** | 33% | **83%** | 0%* | 0% | -- | -- | 17% | 13% | -- | 0%* | 0% | 0%* | 0%* | 0% | 50% | 0%* | 0% | **25%** |
| chord-diagram | -- | 33% | **50%** | 0%* | -- | 0%* | 0%* | -- | -- | -- | 0%* | -- | 0% | -- | -- | -- | -- | 0% | **13%** |
| dumbbell-chart | 44% | 33% | 0%* | 0%* | 0% | 0%* | 0%* | 17% | 13% | -- | 0%* | -- | 0%* | -- | 0% | -- | 0%* | 0% | **13%** |
| funnel-pro | **56%** | 33%* | **83%** | 0%* | -- | 0%* | -- | 17% | 13% | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **25%** |
| gantt-chart-pro | **78%** | 0%* | 0%* | 0%* | -- | -- | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **26%** |
| gauge-cluster | -- | -- | 0%* | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0% | -- | -- | -- | -- | 0% | **0%** |
| health-bar | **67%** | -- | 0%* | 0%* | 0% | 0%* | 0%* | 17% | 13% | -- | 0%* | -- | 0%* | 0%* | -- | -- | -- | 0% | **20%** |
| heatmap-calendar | **83%** | -- | 0%* | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | -- | 0% | **29%** |
| kpi-card | -- | -- | -- | 0% | -- | 0%* | -- | -- | -- | -- | 0% | -- | 0%* | -- | -- | -- | 0%* | 0% | **0%** |
| morphing-area-chart | **56%** | 33% | 0%* | 0%* | 0% | 0%* | -- | 17% | 13% | -- | 0%* | 0% | 0%* | 0%* | 0% | 50% | 0%* | 0% | **16%** |
| network-graph | -- | -- | **83%** | 0%* | -- | -- | -- | -- | -- | -- | 0%* | -- | 0% | -- | -- | -- | 0%* | 0% | **21%** |
| polar-chart | **56%** | 33% | **50%** | 0%* | -- | 0%* | 0%* | -- | -- | -- | 0%* | -- | 0%* | -- | 0% | -- | 0%* | 0% | **19%** |
| progress-bar-stack | **83%** | -- | **50%** | 0%* | -- | 0%* | -- | 17% | 13% | -- | 0%* | -- | 0%* | 0%* | -- | -- | 0%* | 0% | **30%** |
| radar-chart | **56%** | 17% | 17% | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0%* | -- | 0% | -- | 0%* | 0% | **14%** |
| radial-gauge | -- | -- | **50%** | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0% | -- | -- | -- | -- | 0% | **10%** |
| ring-stack | -- | **83%** | **50%** | 0%* | -- | 0%* | 0%* | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **18%** |
| sankey-diagram | -- | 0% | **50%** | 0% | 0% | 0%* | -- | -- | -- | -- | 0% | -- | 0% | -- | -- | -- | 0%* | 0% | **5%** |
| scatter-bubble | **56%** | **83%** | 0%* | 0%* | -- | 0%* | -- | 17% | -- | -- | 0%* | -- | 0%* | -- | 0% | -- | 0%* | 0% | **20%** |
| slope-chart | **61%** | -- | **83%** | 0%* | -- | 0%* | -- | 17% | 13% | -- | 0%* | 0% | 0%* | 0%* | 0% | 50% | -- | 0% | **25%** |
| status-indicator | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | -- | 0% | **0%** |
| stream-graph | **56%** | 33% | 0%* | 0%* | -- | -- | -- | 17% | 13% | -- | 0%* | 0% | 0%* | 0%* | 0% | 0% | 0%* | 0% | **12%** |
| sunburst-chart | -- | 33% | **50%** | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **11%** |
| timeline-milestone | **50%** | -- | 17% | 0%* | -- | -- | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **18%** |
| treemap-pro | -- | 0%* | **50%** | 0%* | -- | 0%* | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **6%** |
| waffle-chart | -- | 33% | **50%** | 0%* | -- | -- | -- | -- | -- | -- | 0%* | -- | 0%* | -- | -- | -- | 0%* | 0% | **11%** |

**Legend:**
- `--` = card not imported
- `0%*` = card imported but only trivially referenced (e.g. toggle only, or no hidden properties; low signal that all properties are "used" -- many are just present but not read in visual.ts rendering logic)
- **Bold** = waste > 50%
- "Overall Waste %" = weighted average across all imported shared cards for that visual

---

## Pass 3: Shared Card Bloat Analysis (Detailed)

### Shared Card Property Inventory

| Card | Total Properties | Property List |
|------|-----------------|---------------|
| AxisFormattingCard | 18 | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelColor, axisLabelSize, axisLabelFontFamily, axisLabelFontWeight, axisLabelRotation, yAxisMin, yAxisMax, axisLineColor, axisLineWidth, showGridLines, gridLineColor, gridLineStyle, gridLineWidth, gridLineOpacity |
| LegendFormattingCard | 6 | showLegend, legendPosition, legendFontSize, legendFontColor, legendFontFamily, legendFontWeight |
| DataLabelFormattingCard | 6 | showDataLabels, dataLabelFontSize, dataLabelFontColor, dataLabelFontWeight, dataLabelFontFamily, dataLabelPosition |
| TitleFormattingCard | 12 | showTitle, titleText, titleFontSize, titleFontColor, titleFontFamily, titleFontWeight, titleAlignment, subtitleText, subtitleFontSize, subtitleFontColor, subtitleFontFamily, subtitleFontWeight |
| ScrollFormattingCard | 2 | enableScroll, minCategoryWidth |
| NumberFormattingCard | 4 | displayUnits, decimalPlaces, valuePrefix, valueSuffix |
| SortFormattingCard | 1 | sortBy |
| ReferenceLineFormattingCard | 12 | showReferenceLine, referenceLineType, referenceLineValue, referenceLineColor, referenceLineWidth, referenceLineStyle, showReferenceLabel, referenceLabelText, showReferenceBand, referenceBandOpacity, referenceBandWidth, referenceLineAxis |
| TrendLineFormattingCard | 8 | showTrendLine, trendLineType, polynomialOrder, trendLineColor, trendLineWidth, showEquation, showR2, trendLineAxis |
| TargetFormattingCard | 10 | showTarget, targetLabel, targetLineColor, targetLineWidth, targetLineStyle, showTargetLabel, showTargetBand, targetBandHalfWidth, targetBandOpacity, targetLineAxis |
| ConditionalFormattingCard | 7 | enableConditional, conditionalDirection, threshold1, threshold2, conditionalColor1, conditionalColor2, conditionalColor3 |
| CrosshairFormattingCard | 5 | showCrosshair, crosshairLineColor, crosshairLineWidth, crosshairLineStyle, showCrosshairValues |
| AccessibilityFormattingCard | 1 | enableKeyboardNav |
| AnnotationFormattingCard | 13 | showAnnotations, annotation1Category, annotation1Text, annotation1Position, annotation2Category, annotation2Text, annotation2Position, annotation3Category, annotation3Text, annotation3Position, annotationFontSize, annotationFontColor, annotationConnectorColor |
| SeriesFormattingCard | dynamic | CompositeCard with per-series groups (seriesColor, seriesOpacity, showDataLabels, lineStyle, lineWidth) |
| LineStrokeFormattingCard | 2 | lineWidth, lineStyle |
| ColorThemeFormattingCard | 1 | colorTheme |
| DateFilterFormattingCard | 4 | enableDateFilter, startDate, endAtCurrentDate, endDate |

---

### Per-Visual Shared Card Bloat Details

#### 1. animated-donut-pro
**Shared cards imported:** LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Used Properties | Hidden Properties | Unused/Hidden | Waste % |
|------|----------------|-------------------|---------------|---------|
| LegendFormattingCard (6) | showLegend, legendPosition | -- | legendFontSize, legendFontColor, legendFontFamily, legendFontWeight (not referenced) | 33% |
| **DataLabelFormattingCard (6)** | showDataLabels (hidden) | showDataLabels | dataLabelFontSize, dataLabelFontColor, dataLabelFontWeight, dataLabelFontFamily, dataLabelPosition | **83%** |
| TitleFormattingCard (12) | Only `titleText` referenced directly; rest likely used via shared rendering | -- | See note | 0%* |

**Flag:** DataLabelFormattingCard is imported but `showDataLabels` is immediately hidden. The visual has its own `DonutSettings.showLabels` and `DonutLabelSettings`. This is a **dead import** -- the entire card is wasted.

---

#### 2. animated-waterfall
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax (6 hidden); remaining 12 only `axisLabelColor` referenced directly | **61%** |
| **DataLabelFormattingCard (6)** | showDataLabels hidden; visual has own ValueSettingsCard | **83%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

**Flag:** AxisFormattingCard has 6 properties explicitly hidden. The visual also has its own `AxisSettingsCard` with `showXAxis`/`showYAxis` -- **duplicate controls**. DataLabelFormattingCard is effectively dead (own ValueSettingsCard handles labels).

---

#### 3. bar-chart-pro
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, SeriesFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard (14 cards)

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| AxisFormattingCard (18) | None hidden; 12 properties directly referenced | 33% |
| LegendFormattingCard (6) | All 6 properties referenced | 0% |
| DataLabelFormattingCard (6) | showDataLabels, dataLabelPosition hidden; visual has own BarSettings.showDataLabels | 33% |
| ReferenceLineFormattingCard (12) | All 12 properties referenced | 0% |
| TrendLineFormattingCard (8) | All 8 properties referenced (including showR2) | 0% |

**Best practice:** Bar-chart-pro is the most complete consumer of shared cards, but DataLabelFormattingCard overlaps with BarSettings.showDataLabels.

---

#### 4. bar-race
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | 16 hidden (showXAxis, showYAxis, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, axisLabelFontFamily, axisLabelRotation, axisLabelFontWeight, axisLineColor, axisLineWidth, showGridLines, gridLineColor, gridLineStyle, gridLineWidth, gridLineOpacity) | **89%** |
| **DataLabelFormattingCard (6)** | showDataLabels hidden; visual has own ValueSettings.showValues | **83%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

**Flag:** AxisFormattingCard is **89% waste** -- only 2 of 18 properties not hidden (`axisLabelColor`, `axisLabelSize`). This visual is an animated racing bar chart; traditional axis controls are irrelevant. Should use a lightweight axis-label-only card instead.

---

#### 5. box-plot
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, showGridLines, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax (7 hidden) + remaining not directly referenced | **61%** |
| LegendFormattingCard (6) | Only showLegend, legendPosition referenced | 33% |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

---

#### 6. bullet-chart-pro
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | 16 hidden (same as bar-race) | **89%** |
| **DataLabelFormattingCard (6)** | showDataLabels hidden; own BulletSettings.showLabels | **83%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

**Flag:** Same pattern as bar-race. AxisFormattingCard is nearly completely hidden for this non-axis-centric visual.

---

#### 7. bump-chart
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard, ScrollFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, CrosshairFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, showGridLines, gridLineColor, gridLineStyle, gridLineWidth, gridLineOpacity (12 hidden) | **67%** |
| LegendFormattingCard (6) | Only showLegend, legendPosition referenced | 33% |
| **DataLabelFormattingCard (6)** | showDataLabels hidden; visual uses own label rendering | **83%** |
| LineStrokeFormattingCard (2) | Only lineStyle referenced; lineWidth not used | 50% |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |
| CrosshairFormattingCard (5) | All 5 properties used | 0% |

---

#### 8. chord-diagram
**Shared cards imported:** DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| LegendFormattingCard (6) | Only showLegend, legendPosition used | 33% |
| **DataLabelFormattingCard (6)** | showDataLabels hidden; only dataLabelFontSize, dataLabelFontColor referenced (3 unused) | **50%** |

---

#### 9. dumbbell-chart
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| AxisFormattingCard (18) | xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, axisLabelRotation (5 hidden) + 3 more not referenced | 44% |
| LegendFormattingCard (6) | Only showLegend, legendPosition referenced | 33% |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

---

#### 10. funnel-pro
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelFontFamily, axisLabelRotation, yAxisMin, yAxisMax, gridLineWidth, gridLineOpacity (10 hidden) | **56%** |
| **DataLabelFormattingCard (6)** | showDataLabels hidden; own StageAppearanceSettingsCard.showValues | **83%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

---

#### 11. gantt-chart-pro
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, axisLabelFontFamily, axisLabelRotation, axisLineColor, axisLineWidth, showGridLines, gridLineColor, showXAxis, showYAxis, gridLineWidth, gridLineOpacity (14 hidden) | **78%** |

**Flag:** Gantt uses time-axis with custom rendering. 14 of 18 axis properties are hidden. Should use a minimal time-axis card.

---

#### 12. gauge-cluster
**Shared cards imported:** DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| DataLabelFormattingCard (6) | Only showDataLabels, dataLabelFontColor, dataLabelFontSize used (no hides) | 0%* |
| All others | Minimal waste | 0% |

**Cleanest consumer** of shared cards among all visuals.

---

#### 13. health-bar
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ScrollFormattingCard, SortFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelFontFamily, axisLabelRotation, yAxisMin, yAxisMax (8 hidden) + 4 more not referenced | **67%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

---

#### 14. heatmap-calendar
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelFontFamily, axisLabelRotation, yAxisMin, yAxisMax, axisLineColor, axisLineWidth, showGridLines, gridLineColor, gridLineStyle, gridLineWidth, gridLineOpacity (15 hidden) | **83%** |

**Flag:** Calendar visualization hides 15 of 18 axis properties. Only axisLabelColor, axisLabelSize, axisLabelFontWeight are exposed. This card is almost entirely wasted.

---

#### 15. kpi-card
**Shared cards imported:** TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| TitleFormattingCard (12) | All 12 properties referenced (including subtitle properties) | 0% |
| ConditionalFormattingCard (7) | All 7 properties referenced | 0% |

**Best practice:** KPI Card uses TitleFormattingCard most completely of any visual.

---

#### 16. morphing-area-chart
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard, ScrollFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, CrosshairFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, SeriesFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard (16 cards -- most of any visual)

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, showGridLines, axisLabelFontFamily, axisLabelRotation, yAxisMin, yAxisMax, gridLineWidth, gridLineOpacity (10 hidden) | **56%** |
| LegendFormattingCard (6) | Only showLegend, legendPosition referenced | 33% |
| LineStrokeFormattingCard (2) | lineWidth hidden; only lineStyle used | 50% |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |
| CrosshairFormattingCard (5) | All 5 properties used | 0% |

---

#### 17. network-graph
**Shared cards imported:** DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **DataLabelFormattingCard (6)** | showDataLabels hidden; visual has own NodeSettings.showLabels (5 of 6 unused) | **83%** |

---

#### 18. polar-chart
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelFontFamily, axisLabelRotation, yAxisMin, yAxisMax, gridLineWidth, gridLineOpacity (10 hidden) | **56%** |
| LegendFormattingCard (6) | Only showLegend, legendPosition | 33% |
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden (only 1 other referenced) | **50%** |

---

#### 19. progress-bar-stack
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | 15 hidden (same as heatmap) | **83%** |
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden | **50%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |
| TrendLineFormattingCard (8) | trendLineAxis hidden | 13% |

**Flag:** Progress bars have no traditional axes. 15 of 18 axis properties hidden.

---

#### 20. radar-chart
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelFontFamily, axisLabelRotation, yAxisMin, yAxisMax, gridLineWidth, gridLineOpacity (10 hidden) | **56%** |
| LegendFormattingCard (6) | showLegend, legendPosition, legendFontSize, legendFontColor, legendFontFamily (5 used) | 17% |
| DataLabelFormattingCard (6) | dataLabelPosition hidden | 17% |

---

#### 21. radial-gauge
**Shared cards imported:** DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **DataLabelFormattingCard (6)** | showDataLabels hidden; only dataLabelFontColor, dataLabelFontSize used | **50%** |

---

#### 22. ring-stack
**Shared cards imported:** LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, SortFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **LegendFormattingCard (6)** | Only showLegend referenced (5 of 6 unused) | **83%** |
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden | **50%** |

---

#### 23. sankey-diagram
**Shared cards imported:** LegendFormattingCard, DataLabelFormattingCard, ScrollFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| LegendFormattingCard (6) | All 6 properties referenced | 0% |
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden | **50%** |
| TitleFormattingCard (12) | All 12 properties referenced (including subtitles) | 0% |
| ScrollFormattingCard (2) | Both properties referenced | 0% |
| ConditionalFormattingCard (7) | All key properties referenced | 0% |

**Second cleanest consumer** after gauge-cluster.

---

#### 24. scatter-bubble
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, NumberFormattingCard, ReferenceLineFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, showGridLines, yAxisMin, yAxisMax (5 hidden) + 5 more not referenced | **56%** |
| **LegendFormattingCard (6)** | Only showLegend referenced | **83%** |
| ReferenceLineFormattingCard (12) | referenceLineAxis, referenceBandWidth hidden | 17% |

---

#### 25. slope-chart
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, CrosshairFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, SeriesFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, axisLabelFontFamily, axisLabelRotation, axisLineColor, axisLineWidth, showGridLines, gridLineColor (11 hidden) | **61%** |
| **DataLabelFormattingCard (6)** | showDataLabels hidden | **83%** |
| LineStrokeFormattingCard (2) | Only lineStyle used; lineWidth not referenced | 50% |
| CrosshairFormattingCard (5) | All 5 used | 0% |

---

#### 26. status-indicator
**Shared cards imported:** TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| TitleFormattingCard (12) | Only titleText referenced | 0%* |

Minimal bloat. Simple visual with few shared cards.

---

#### 27. stream-graph
**Shared cards imported:** AxisFormattingCard, LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, LineStrokeFormattingCard, ReferenceLineFormattingCard, TrendLineFormattingCard, ConditionalFormattingCard, CrosshairFormattingCard, AnnotationFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, SeriesFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, showGridLines, yAxisMin, yAxisMax (5 hidden) + 5 more not referenced | **56%** |
| LegendFormattingCard (6) | Only showLegend, legendPosition | 33% |
| LineStrokeFormattingCard (2) | Both properties used | 0% |
| CrosshairFormattingCard (5) | All 5 used | 0% |

---

#### 28. sunburst-chart
**Shared cards imported:** LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| LegendFormattingCard (6) | Only showLegend, legendPosition | 33% |
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden | **50%** |

---

#### 29. timeline-milestone
**Shared cards imported:** AxisFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **AxisFormattingCard (18)** | showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelRotation, yAxisMin, yAxisMax, gridLineWidth, gridLineOpacity (9 hidden) | **50%** |
| DataLabelFormattingCard (6) | dataLabelPosition hidden | 17% |

---

#### 30. treemap-pro
**Shared cards imported:** LegendFormattingCard, DataLabelFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, NumberFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden; own TreemapSettings.showLabels | **50%** |

---

#### 31. waffle-chart
**Shared cards imported:** DataLabelFormattingCard, LegendFormattingCard, TitleFormattingCard, ConditionalFormattingCard, AccessibilityFormattingCard, ColorThemeFormattingCard, DateFilterFormattingCard

| Card | Hidden Properties | Waste % |
|------|-------------------|---------|
| LegendFormattingCard (6) | Only showLegend, legendPosition | 33% |
| **DataLabelFormattingCard (6)** | showDataLabels, dataLabelPosition hidden | **50%** |

---

## Worst Offenders: Shared Cards with >50% Waste (Flagged)

| Rank | Visual | Card | Waste % | Problem |
|------|--------|------|---------|---------|
| 1 | bar-race | AxisFormattingCard | **89%** | Only 2 of 18 properties exposed |
| 2 | bullet-chart-pro | AxisFormattingCard | **89%** | Only 2 of 18 properties exposed |
| 3 | heatmap-calendar | AxisFormattingCard | **83%** | Only 3 of 18 properties exposed |
| 4 | progress-bar-stack | AxisFormattingCard | **83%** | Only 3 of 18 properties exposed |
| 5 | animated-donut-pro | DataLabelFormattingCard | **83%** | Entire card dead (own labels system) |
| 6 | animated-waterfall | DataLabelFormattingCard | **83%** | Own ValueSettingsCard duplicates |
| 7 | bar-race | DataLabelFormattingCard | **83%** | Own ValueSettings duplicates |
| 8 | bullet-chart-pro | DataLabelFormattingCard | **83%** | Own BulletSettings.showLabels |
| 9 | bump-chart | DataLabelFormattingCard | **83%** | showDataLabels hidden |
| 10 | funnel-pro | DataLabelFormattingCard | **83%** | Own StageAppearance.showValues |
| 11 | network-graph | DataLabelFormattingCard | **83%** | Own NodeSettings.showLabels |
| 12 | slope-chart | DataLabelFormattingCard | **83%** | showDataLabels hidden |
| 13 | ring-stack | LegendFormattingCard | **83%** | Only showLegend used |
| 14 | scatter-bubble | LegendFormattingCard | **83%** | Only showLegend used |
| 15 | gantt-chart-pro | AxisFormattingCard | **78%** | Time-based, most axis props irrelevant |
| 16 | bump-chart | AxisFormattingCard | **67%** | 12 of 18 hidden |
| 17 | health-bar | AxisFormattingCard | **67%** | 12 of 18 hidden |
| 18 | animated-waterfall | AxisFormattingCard | **61%** | 11 of 18 hidden/unused |
| 19 | box-plot | AxisFormattingCard | **61%** | 11 of 18 hidden/unused |
| 20 | slope-chart | AxisFormattingCard | **61%** | 11 of 18 hidden |

---

## Pass 4: Condense Opportunities

### 4A. Cards with Only 1-2 Settings (Merge Candidates)

| Visual | Card | Settings Count | Merge Into |
|--------|------|---------------|------------|
| animated-waterfall | WaterfallSortSettings | 1 (sortByContribution) | Merge into WaterfallSettingsCard |
| animated-waterfall | ValueSettingsCard | 2 (show, fontSize) | Merge into DataLabelFormattingCard or WaterfallSettingsCard |
| animated-waterfall | WaterfallSummarySettings | 2 (show, fontSize) | Merge into WaterfallSettingsCard |
| animated-waterfall | AxisSettingsCard | 2 (showXAxis, showYAxis) | **Remove entirely** -- AxisFormattingCard already has these (currently hidden, creating a duplicate) |
| animated-donut-pro | AnimationSettingsCard | 2 (enabled, duration) | Common across ALL visuals; keep as-is (standardized) |
| animated-donut-pro | DonutNestedSettings | 2 (enabled, innerRingField) | Merge into DonutSettings |
| animated-donut-pro | DonutExplodeSettings | 2 (enabled, distance) | Merge into DonutSettings |
| animated-donut-pro | DonutLabelSettings | 2 (format, connectorLines) | Merge into DonutSettings |
| bar-chart-pro | ChartModeSettings | 1 (mode) | Could merge into BarSettings as first property |
| bar-chart-pro | ZoomSettingsCard | 1 (enabled) | Merge into ScrollFormattingCard |
| bar-chart-pro | SecondaryAxisSettingsCard | 2 (showSecondaryYAxis, secondaryYAxisTitle) | Merge into AxisFormattingCard or LineSettings |
| bar-race | ColorSettings | 1 (useChartPalette) | Merge into RaceSettings |
| bar-race | ValueSettings | 2 (showValues, fontSize) | Merge into RaceSettings |
| box-plot | AxisSettingsCard | 3 (showXAxis, showYAxis, gridLines) | **Remove entirely** -- duplicated by AxisFormattingCard |
| bump-chart | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| chord-diagram | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| dumbbell-chart | DumbbellDisplaySettingsCard | 2 (showRanking, enableGrouping) | Merge into DumbbellConnectorSettings |
| dumbbell-chart | AnimationSettingsCard | 2 (enabled, duration) | Standard pattern; keep |
| funnel-pro | ColorSettingsCard | 2 (useGradient, baseColor) | Merge into FunnelShapeSettingsCard |
| funnel-pro | AnimationSettingsCard | 2 (enabled, duration) | Standard pattern; keep |
| gauge-cluster | GridLayoutSettingsCard | 2 (gaugesPerRow, sortByValue) | Could stay (logically distinct) |
| gauge-cluster | ValueRangeSettingsCard | 2 (minValue, maxValue) | Merge into ArcAppearanceSettingsCard |
| heatmap-calendar | LegendSettings | 2 (showLegend, legendPosition) | **Replace with LegendFormattingCard** (not currently imported) |
| heatmap-calendar | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| morphing-area-chart | AxisSettingsCard | 3 (showXAxis, showYAxis, gridLines) | **Remove entirely** -- duplicated by AxisFormattingCard |
| morphing-area-chart | DataHandlingCard | 1 (nullHandling) | Merge into AreaFillCard |
| network-graph | ColorsAndThemeSettings | 2 (useChartPalette, enableClustering) | Merge into NodeSettings |
| polar-chart | ColorsAndFillSettings | 2 (baseColor, enableGradientFill) | Merge into SegmentSettings |
| polar-chart | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| progress-bar-stack | TargetSettings | 3 (show, color, lineWidth) | Could merge into BarLayoutSettings |
| radar-chart | RadarInteractionSettings | 1 (hoverDim) | Merge into RadarAppearanceSettings |
| radial-gauge | TargetSettings | 2 (show, color) | Merge into ArcShapeSettings |
| ring-stack | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| sankey-diagram | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| slope-chart | SlopeBehaviorSettings | 2 (sortByMagnitude, showConfidenceInterval) | Merge into SlopeSettings |
| status-indicator | LayoutSettings | 1 (layout) | Merge into IndicatorAppearanceSettings |
| stream-graph | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |
| timeline-milestone | AnimationSettings | 2 (enabled, duration) | Standard pattern; keep |

**Summary:** 23 custom cards with 1-2 settings are merge candidates (excluding the standardized AnimationSettings pattern). 3 local AxisSettingsCards are outright duplicates of the shared AxisFormattingCard.

---

### 4B. Redundant/Overlapping Settings

| Visual | Overlap | Description |
|--------|---------|-------------|
| animated-waterfall | AxisSettingsCard.showXAxis/showYAxis vs AxisFormattingCard.showXAxis/showYAxis | **Both exist**, shared card versions are hidden. Dual axis toggle controls. |
| box-plot | AxisSettingsCard.showXAxis/showYAxis/gridLines vs AxisFormattingCard.showXAxis/showYAxis/showGridLines | Same dual-control problem |
| morphing-area-chart | AxisSettingsCard.showXAxis/showYAxis/gridLines vs AxisFormattingCard.showXAxis/showYAxis/showGridLines | Same dual-control problem |
| animated-donut-pro | DonutSettings.showLabels + DonutLabelSettings + DataLabelFormattingCard.showDataLabels | **THREE** overlapping label controls |
| bar-chart-pro | BarSettings.showDataLabels vs DataLabelFormattingCard.showDataLabels | Shared card version hidden; local one active |
| animated-waterfall | ValueSettingsCard.show vs DataLabelFormattingCard.showDataLabels | Shared card version hidden; local one active |
| bar-race | ValueSettings.showValues vs DataLabelFormattingCard.showDataLabels | Shared card version hidden; local one active |
| bullet-chart-pro | BulletSettings.showLabels vs DataLabelFormattingCard.showDataLabels | Shared card version hidden; local one active |
| funnel-pro | StageAppearanceSettingsCard.showValues vs DataLabelFormattingCard.showDataLabels | Shared card version hidden; local one active |
| network-graph | NodeSettings.showLabels vs DataLabelFormattingCard.showDataLabels | Shared card version hidden; local one active |
| bar-chart-pro | TargetLineSettings (local) vs TargetFormattingCard (shared, not imported) | Local implementation when shared card exists |
| scatter-bubble | TrendlineSettingsCard (local, 9 props) vs TrendLineFormattingCard (shared, 8 props, not imported) | Near-identical local implementation when shared card exists |
| heatmap-calendar | LegendSettings (local, 2 props) vs LegendFormattingCard (shared, 6 props, not imported) | Local reimplementation |

---

### 4C. Settings That Are Always the Same Value (Auto-Compute Candidates)

| Setting | Affected Visuals | Current Value | Recommendation |
|---------|-----------------|---------------|----------------|
| referenceLineAxis | animated-waterfall, bar-race, box-plot, bullet-chart-pro, bump-chart, dumbbell-chart, funnel-pro, health-bar, morphing-area-chart, polar-chart (none referenced for actual use), progress-bar-stack, scatter-bubble, slope-chart, stream-graph | Always "primary" (hidden in all visuals) | **Remove from shared card or auto-default to "primary"** -- secondary axis is only relevant in combo charts |
| trendLineAxis | animated-waterfall, bar-race, box-plot, bullet-chart-pro, bump-chart, dumbbell-chart, funnel-pro, health-bar, morphing-area-chart, progress-bar-stack, slope-chart, stream-graph | Always "primary" (hidden in all visuals) | Same -- remove or auto-default |
| referenceBandWidth | Same list | Hidden in every visual that imports it | **Remove** -- no visual exposes this property |
| gridLineOpacity | heatmap-calendar, progress-bar-stack, bar-race, bullet-chart-pro, morphing-area-chart, bump-chart, polar-chart, radar-chart, timeline-milestone | Hidden in 9+ visuals | Consider removing or making a single "grid appearance" toggle |
| gridLineWidth | Same list | Hidden in 9+ visuals | Same |

---

### 4D. Dropdowns with Only 2 Options Where One is "Off" (Toggle Candidates)

| Setting | Card | Current Options | Recommendation |
|---------|------|----------------|----------------|
| gridLineStyle | AxisFormattingCard | "Solid", "Dashed" | Keep as dropdown -- both are valid "on" states |
| axisLabelFontWeight | AxisFormattingCard | "Normal", "Bold" | **Convert to toggle** "Bold Labels" |
| legendFontWeight | LegendFormattingCard | "Normal", "Bold" | **Convert to toggle** "Bold Legend Text" |
| dataLabelFontWeight | DataLabelFormattingCard | "Normal", "Bold" | **Convert to toggle** "Bold Data Labels" |
| titleFontWeight | TitleFormattingCard | "Normal", "Bold" | **Convert to toggle** "Bold Title" |
| subtitleFontWeight | TitleFormattingCard | "Normal", "Bold" | **Convert to toggle** "Bold Subtitle" |
| conditionalDirection | ConditionalFormattingCard | "Ascending (Low = Bad)", "Descending (Low = Good)" | Keep as dropdown -- both options are meaningful, not "off" |
| referenceLineAxis | ReferenceLineFormattingCard | "Primary", "Secondary" | **Remove entirely** -- hidden in every consumer |
| trendLineAxis | TrendLineFormattingCard | "Primary", "Secondary" | **Remove entirely** -- hidden in every consumer |
| targetLineAxis | TargetFormattingCard | "Primary", "Secondary" | Same as above |

---

### 4E. Color Pickers Users Would Never Set Differently From Each Other

| Visual | Colors | Recommendation |
|--------|--------|----------------|
| animated-waterfall | ColorSettingsCard: positiveColor + negativeColor + totalColor | Keep separate -- meaningful semantic distinction |
| ring-stack | ColorSettings: ring1Color through ring6Color (6 separate pickers) | **Replace with ColorThemeFormattingCard** import -- 6 individual ring colors is excessive; a palette/theme selection is more practical |
| sankey-diagram | NodeLabelSettings: sourceLabelColor + step2LabelColor + step3LabelColor + step4LabelColor + step5LabelColor + targetLabelColor (6 separate label colors) | **Replace with single labelColor + "Color by layer" toggle** -- most users want one label color or auto-by-layer |
| slope-chart | DirectionColorSettings: positiveColor + negativeColor + neutralColor | Keep separate -- semantic distinction is clear |
| radial-gauge | ZoneSettings: zone1Color + zone2Color + zone3Color | Keep separate -- zone semantics are distinct |
| gauge-cluster | ZoneSettings: lowColor + midColor + highColor | Keep separate -- zone semantics are distinct |
| scatter-bubble | QuadrantSettingsCard: 4 quadrant label strings but no separate quadrant colors | N/A -- labels only |

---

### 4F. Cross-Cutting Architecture Recommendations

#### 1. Split AxisFormattingCard into Tiers

The AxisFormattingCard is the worst offender across the entire codebase. 18 properties, and most visuals hide 50-89% of them.

**Recommendation:** Create tiered axis cards:
- `AxisLabelCard` (4 props): axisLabelColor, axisLabelSize, axisLabelFontFamily, axisLabelFontWeight
- `AxisDisplayCard` (6 props): showXAxis, showYAxis, xAxisTitle, yAxisTitle, axisLabelRotation + AxisLabelCard props
- `AxisGridCard` (5 props): showGridLines, gridLineColor, gridLineStyle, gridLineWidth, gridLineOpacity
- `AxisRangeCard` (4 props): yAxisMin, yAxisMax, axisLineColor, axisLineWidth

Visuals can import only the tiers they need:
- bar-race: `AxisLabelCard` only (2 props needed)
- bar-chart-pro: All tiers (full axis support)
- heatmap-calendar: `AxisLabelCard` only
- gantt-chart-pro: `AxisLabelCard` only

**Impact:** Eliminates ~120 hidden property assignments across 20 visuals.

#### 2. Create DataLabelToggleCard (Lightweight Alternative)

12 of 31 visuals hide `showDataLabels` and use their own label toggle. They don't need the full DataLabelFormattingCard.

**Recommendation:** For visuals that only need font size/color for labels (gauge-cluster, radial-gauge, chord-diagram), create:
- `DataLabelAppearanceCard` (3 props): dataLabelFontSize, dataLabelFontColor, dataLabelFontFamily
- Keep full `DataLabelFormattingCard` for visuals that use position, toggle, and font weight

**Impact:** Eliminates 12 dead `showDataLabels.visible = false` assignments.

#### 3. Remove Dead "Axis" Properties from Shared Card

Three properties are hidden in **every single visual** that imports them:
- `referenceLineAxis` (hidden in 14/14 visuals)
- `trendLineAxis` (hidden in 12/12 visuals)
- `referenceBandWidth` (hidden in 14/14 visuals)

**Recommendation:** Remove these 3 properties from shared cards entirely, or make them opt-in via a constructor flag.

#### 4. Eliminate Duplicate Local Axis Cards

Three visuals (animated-waterfall, box-plot, morphing-area-chart) have **both** a local `AxisSettingsCard` and the shared `AxisFormattingCard`, with the shared version's toggles hidden. This is confusing for maintenance.

**Recommendation:** Remove local AxisSettingsCards and expose the shared card's toggles instead.

#### 5. Standard AnimationSettings → Shared Card

Every single visual has an AnimationSettingsCard with 2-3 properties (enabled, duration, optionally staggerDelay). This is duplicated 31 times.

**Recommendation:** Add `AnimationFormattingCard` to shared-settings.ts with optional stagger support.

#### 6. Standard CardStyleSettings → Shared Card

Every single visual has a CardStyleSettings card with 4 properties (cardStyleMode/enableGlass, backgroundColor, backgroundOpacity, borderRadius). Duplicated 31 times.

**Recommendation:** Add `CardStyleFormattingCard` to shared-settings.ts.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total shared card imports across 31 visuals | 276 |
| Imports with >50% waste | 20 |
| Imports with >80% waste | 15 |
| Properties explicitly hidden via `.visible = false` | ~180 |
| Properties in `referenceLineAxis`/`trendLineAxis`/`referenceBandWidth` that are hidden in 100% of consumers | 3 |
| Local cards with 1-2 settings (merge candidates) | 23 |
| Duplicate local AxisSettingsCard instances | 3 |
| Visuals importing DataLabelFormattingCard just to hide showDataLabels | 12 |
| AnimationSettingsCard duplicates that could be shared | 31 |
| CardStyleSettings duplicates that could be shared | 31 |

**Estimated reduction from applying all recommendations:** ~65 custom card classes eliminated, ~180 hidden-property assignments removed, settings.ts files reduced by ~30% average LOC.
