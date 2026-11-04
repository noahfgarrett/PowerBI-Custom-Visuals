import {
  ChartBarStacked,
  ChartColumnBig,
  ChartColumnDecreasing,
  CheckCheck,
  CircleCheck,
  CircleDot,
  CircleAlert,
  CirclePlus,
  ClipboardCheck,
  Gauge,
  Hourglass,
  Layers,
  TableProperties,
} from 'lucide-react'
import { useCallback, useMemo, useRef, type ReactElement } from 'react'

import { useDashboardFilters } from '../hooks/useDashboardFilters'
import type { ElementSize } from '../hooks/useElementSize'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { AgingSplitTable } from './AgingSplitTable'
import { AgingStripChart } from './AgingStripChart'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type ChartExpansionHandle, type ExpandablePanel, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { FilterChips } from './FilterChips'
import { FilterEmptyState } from './FilterEmptyState'
import { Footnotes } from './Footnotes'
import { HeaderOverlayButton } from './HeaderOverlayButton'
import { IssueAgingPage, issueAgingTitle } from './IssueAgingPage'
import { IssueDetail } from './IssueDetail'
import { issueTrendLegend, IssuesTrendChart } from './IssuesTrendChart'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { OpenAgingChart } from './OpenAgingChart'
import { OpenIssuesTable } from './OpenIssuesTable'
import { paretoTitle, RootCauseParetoPage } from './RootCauseParetoPage'
import { WeekIssuesPage } from './WeekIssuesPage'
import { IssueWindowSummary } from './WindowSummary'
import { issueDrillColumns, weekRows, type DrillGroup } from '../drilldown'
import { restateIssueFootnotes } from '../footnotes'
import { formatCount, formatDelta, formatPercent, formatPointsDelta, formatSignedCount, pointsTrend, trendOf } from '../format'
import { passRateInWeeks, RECENT_WEEK_COUNT } from '../inspections'
import {
  buildIssueIndex,
  buildIssueModel,
  issueDataWeeks,
  issueFilterFields,
  issueFilterRows,
  issueRowWeekKey,
  type IssueFilterSource,
} from '../issues'
import { effectiveKeys, isFieldActive, type FilterCatalog, type FilterSelection } from '../rowFilters'
import { chartColorsFromTheme } from '../theme'
import type { ClosureRateCard, InspectionIndex, IssueIndex, RangeClosure } from '../types'

const NO_ROWS_MESSAGE = 'No issues match the current filters'
const NO_OPEN_MESSAGE = 'No open issues'
const OUTSIDE_WINDOW_MESSAGE = `Nothing in this window. These rows fall outside the last ${RECENT_WEEK_COUNT} WW: switch to All to see them.`
const COMPANY_FIELD_ID = 'company'
/** The Project to date group's width share with its usual four cards, kept when NCR Pass Rate joins them. */
const FOUR_CARD_SHARE = 4

type ChartId = 'trend' | 'openAging' | 'overallAging'
type PanelId = ChartId | 'detail' | 'pareto' | 'aging' | 'drill'

const CHART_IDS: readonly ChartId[] = ['trend', 'openAging', 'overallAging'] as const

export interface IssuesDashboardProps extends DashboardChromeProps {
  /** Built over all of `filterSource.rows`, once per data update: the LotusWorks-only view. */
  index: IssueIndex
  filterSource: IssueFilterSource
  /** Feeds the NCR Pass Rate card, built over the Electrical and Mechanical rows once per data update. No index, no card. */
  inspections?: { index: InspectionIndex | null }
}

/** A project-to-date count's change in the selected week, in the other dashboards' "+N this WW" style. */
function thisWeekChange(delta: number): string {
  return `${delta === 0 ? '+0' : formatSignedCount(delta)} this WW`
}

function closureRateDetail(card: ClosureRateCard, previousLabel: string, rangeClosure: RangeClosure | null): string {
  if (rangeClosure !== null) {
    return rangeClosure.opened === 0
      ? 'No issues opened in range'
      : `${formatCount(rangeClosure.nowClosed)} of ${formatCount(rangeClosure.opened)} closed`
  }
  if (card.value === null) return 'No issues opened yet'
  if (card.deltaPoints === null) return 'First issues opened this WW'
  return `${formatPointsDelta(card.deltaPoints)} vs ${previousLabel}`
}

/** The rows a Created By (Company) selection leaves out, or null when none is set: the LotusWorks limit still holds. */
function rowsLeftOutByCompany(catalog: FilterCatalog, selection: FilterSelection): number | null {
  const field = catalog.fields.find((candidate) => candidate.def.id === COMPANY_FIELD_ID)
  if (field === undefined || !isFieldActive(field, selection.get(COMPANY_FIELD_ID))) return null
  const keys = effectiveKeys(field, selection)
  return field.options.reduce((sum, option) => (keys.has(option.key) ? sum : sum + option.count), 0)
}

export function IssuesDashboard({
  title,
  icon,
  index: baseIndex,
  filterSource,
  inspections,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: IssuesDashboardProps): ReactElement {
  const { rows, columns, today } = filterSource
  const fields = useMemo(() => issueFilterFields(columns), [columns])
  const filterRows = useMemo(() => issueFilterRows(rows, columns), [rows, columns])
  const rowWeekKey = useMemo(() => issueRowWeekKey(columns), [columns])
  const hasCompanyField = fields.some((field) => field.id === COMPANY_FIELD_ID)
  // With a company to pick, From and To reach every company's weeks, not only the opening view's.
  const dataWeeks = useMemo(
    () => (hasCompanyField ? issueDataWeeks(rows, columns, today) : baseIndex.weeks.map((item) => item.week)),
    [hasCompanyField, rows, columns, today, baseIndex],
  )
  const filters = useDashboardFilters({ rows: filterRows, fields, weeks: dataWeeks, currentKey: baseIndex.currentWeek.key, rowWeekKey })
  const { filteredRows, isFieldFilterActive, dateRange } = filters
  const baseFirstKey = baseIndex.weeks[0].week.key
  // A date range can start before the LotusWorks issues do, and the charts show exactly its weeks.
  const axisFromKey = dateRange === null ? baseFirstKey : Math.min(baseFirstKey, dateRange.fromKey)
  // The drill list's positions index the rows that built `index`.
  const indexRows = isFieldFilterActive ? filteredRows : rows
  const index = useMemo(() => {
    if (!isFieldFilterActive && axisFromKey === baseFirstKey) return baseIndex
    // The rows have already been through the company field, so its default or selection holds. With no company field,
    // and for a range alone, the index keeps the LotusWorks rule.
    const includeAllCreators = isFieldFilterActive && hasCompanyField
    return buildIssueIndex(indexRows, columns, today, { includeAllCreators, axisFromKey })
  }, [isFieldFilterActive, axisFromKey, baseFirstKey, baseIndex, indexRows, columns, today, hasCompanyField])
  const { view, unrangedView, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index, dateRange)
  const frame = useRef<ChartExpansionHandle<PanelId> | null>(null)
  // The Issue Aging page's Esc handler: it closes the page's issue list before Esc closes the page.
  const agingEscapeRef = useRef<(() => boolean) | null>(null)
  const registerAgingEscape = useCallback((handler: (() => boolean) | null): void => {
    agingEscapeRef.current = handler
  }, [])

  const model = useMemo(() => buildIssueModel(index, view), [index, view])
  // Issue Aging and the Pareto aren't restated by a date range, so their pages read the weeks as if none were set.
  const pageModel = useMemo(
    () => (unrangedView === view ? model : buildIssueModel(index, unrangedView)),
    [unrangedView, view, model, index],
  )

  const selectedKey = model.selectedWeek.key
  const inspectionIndex = inspections?.index ?? null
  // Issue filters don't reach the inspection rows; only the date range and the selected week do.
  const ncrPassRate = useMemo(() => {
    if (inspectionIndex === null) return null
    return dateRange === null ? passRateInWeeks(inspectionIndex, null, selectedKey) : passRateInWeeks(inspectionIndex, dateRange.fromKey, dateRange.toKey)
  }, [inspectionIndex, dateRange, selectedKey])
  const drillColumns = useMemo(() => issueDrillColumns(columns), [columns])
  const drillGroups = useMemo((): DrillGroup[] => {
    const opened = weekRows(index.positionByKey, index.openedRowsByWeek, indexRows, selectedKey)
    const closed = weekRows(index.positionByKey, index.closedRowsByWeek, indexRows, selectedKey)
    return [
      { title: 'Opened', columns: drillColumns, rows: opened },
      { title: 'Closed', columns: drillColumns, rows: closed },
    ].filter((group) => group.rows.length > 0)
  }, [drillColumns, index, indexRows, selectedKey])

  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const { thisWeek, toDate } = model
  const previousLabel = model.previousWeek.label
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  const openCount = model.openAging.reduce((sum, bucket) => sum + bucket.count, 0)
  const closureRate = toDate.closureRate
  const isInRange = model.rangeLabel !== null
  const hasNoMatch = filters.isAnyActive && !model.hasData
  // In a range the toggle is off and the chart shows the range's weeks, so there's no window for rows to fall outside.
  const areRowsOutsideWindow = isFieldFilterActive && !isInRange && range === 'recent' && model.windowTotals.opened + model.windowTotals.closed === 0
  const notes = isFieldFilterActive
    ? restateIssueFootnotes(footnotes, baseIndex, index, rowsLeftOutByCompany(filters.menu.catalog, filters.menu.selection))
    : footnotes

  /** A week click or Enter on the chart: selects the week, and opens its list when anything opened or closed in it. */
  function selectChartWeek(key: number): void {
    selectWeek(key)
    const position = index.positionByKey.get(key)
    if (position === undefined) return
    const { opened, closed } = index.weeks[position]
    if (opened + closed > 0) frame.current?.openPageFromChart('drill', 'trend')
  }

  function renderTrend(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <IssuesTrendChart
        points={model.trend}
        selectedKey={model.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={selectChartWeek}
        onHover={onHover}
      />
    )
  }

  function renderOverallAging(): ReactElement {
    return <AgingStripChart buckets={model.overallAging} colors={colors} isHighContrast={theme.isHighContrast} />
  }

  const charts: Record<ChartId, GridPanel> = {
    trend: {
      title: 'Issues by Work Week',
      icon: ChartColumnBig,
      legend: issueTrendLegend(colors),
      emptyMessage: !model.hasData ? NO_ROWS_MESSAGE : areRowsOutsideWindow ? OUTSIDE_WINDOW_MESSAGE : null,
      className: 'qaqc-panel-main',
      renderChart: (size) => renderTrend(size, false),
      renderExpanded: () => (
        <div className="qaqc-expanded-stack">
          <IssueWindowSummary totals={model.windowTotals} />
          <ChartFill>{(size) => renderTrend(size, true)}</ChartFill>
        </div>
      ),
    },
    openAging: {
      title: 'Open Issue Aging',
      icon: Hourglass,
      legend: [{ label: 'Open issues by weeks open', color: colors.series1, shape: 'bar' }],
      // The expanded table has no bar colours to explain.
      expandedLegend: [],
      emptyMessage: !model.hasData ? NO_ROWS_MESSAGE : openCount > 0 ? null : NO_OPEN_MESSAGE,
      renderChart: (size) => (
        <OpenAgingChart
          buckets={model.openAging}
          width={size.width}
          height={size.height}
          colors={colors}
          isHighContrast={theme.isHighContrast}
          describe={describeCharts}
          onHover={onHover}
        />
      ),
      renderExpanded: () => <OpenIssuesTable rows={model.openIssues} />,
    },
    overallAging: {
      title: 'Overall Issue Aging',
      icon: ChartBarStacked,
      // Each bucket row carries its own swatch and label.
      legend: [],
      emptyMessage: model.hasData ? null : NO_ROWS_MESSAGE,
      renderChart: renderOverallAging,
      renderExpanded: () => (
        <div className="qaqc-aging-expanded">
          {renderOverallAging()}
          <AgingSplitTable buckets={model.overallAging} />
        </div>
      ),
    },
  }

  const panels: Record<PanelId, ExpandablePanel> = {
    ...charts,
    detail: {
      title: 'QCx Issues Detail',
      icon: TableProperties,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      // Mounted only while the page is open, so the detail is built only then.
      renderExpanded: () => <IssueDetail index={index} selectedKey={model.selectedWeek.key} />,
    },
    pareto: {
      title: paretoTitle(index, unrangedView),
      icon: ChartColumnDecreasing,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      // Mounted only while the page is open, so the Pareto is built only then. It shares the dashboard's week
      // window, so its own range toggle and week picker move the dashboard too.
      renderExpanded: () => (
        <RootCauseParetoPage
          index={index}
          view={unrangedView}
          weekOptions={pageModel.weekOptions}
          colors={colors}
          isHighContrast={theme.isHighContrast}
          onPickWeek={pickWeek}
          onRangeChange={changeRange}
          onHover={onHover}
        />
      ),
    },
    aging: {
      title: issueAgingTitle(pageModel.selectedWeek),
      icon: Hourglass,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      onEscape: () => agingEscapeRef.current?.() ?? false,
      // Mounted only while the page is open, so the benchmarks are built only then. It shares the dashboard's week
      // window, so its own range toggle and week picker move the dashboard too.
      renderExpanded: () => (
        <IssueAgingPage
          index={index}
          view={unrangedView}
          weekOptions={pageModel.weekOptions}
          colors={colors}
          animate={animate}
          footnotes={notes}
          onSelectWeek={selectWeek}
          onPickWeek={pickWeek}
          onRangeChange={changeRange}
          onHover={onHover}
          registerEscape={registerAgingEscape}
        />
      ),
    },
    drill: {
      title: `Issues · ${model.selectedWeek.label}`,
      icon: CircleAlert,
      kind: 'page',
      legend: [],
      // Only a data refresh can leave the open week with no activity.
      emptyMessage: drillGroups.length > 0 ? null : 'No issues opened or closed in this week',
      renderExpanded: () => <WeekIssuesPage weekLabel={model.selectedWeek.label} groups={drillGroups} />,
    },
  }

  return (
    <ChartExpansionFrame
      panels={panels}
      handle={frame}
      interactive={interactive}
      animate={animate}
      isCompact={isCompact}
      isCardsOnly={isCardsOnly}
      onHover={onHover}
    >
      {(expandable) => (
        <>
          <LoadingBar active={loading} />
          <DashboardHeader
            title={title}
            icon={icon}
            interactive={interactive}
            range={range}
            onRangeChange={changeRange}
            isRangeDisabled={dateRange !== null}
            filterMenu={filters.menu}
            weekOptions={model.weekOptions}
            selectedKey={model.selectedWeek.key}
            onPickWeek={pickWeek}
          >
            <HeaderOverlayButton {...expandable('detail')} label="Issue Detail" ariaLabel="Open Issue Detail" icon={TableProperties} />
            {index.hasRootCause && (
              <HeaderOverlayButton
                {...expandable('pareto')}
                label="Issues by Root Cause Pareto"
                ariaLabel="Open the Issues by Root Cause Pareto page"
                icon={ChartColumnDecreasing}
              />
            )}
            <HeaderOverlayButton {...expandable('aging')} label="Issue Aging" ariaLabel="Open the Issue Aging page" icon={Hourglass} />
          </DashboardHeader>

          <FilterChips {...filters.chips} disabled={!interactive} />

          {hasNoMatch ? (
            <FilterEmptyState
              rowsName="issues"
              isInRange={isInRange}
              disabled={!interactive}
              onClear={() => {
                filters.clearAll()
                filters.chips.onFocusLost()
              }}
            />
          ) : (
            <>
              <div className="qaqc-kpi-row">
                <KpiGroup title="This WW" subtitle={model.selectedWeek.label} variant="week">
                  <KpiCard
                    label="Issues Opened"
                    icon={CirclePlus}
                    value={formatCount(thisWeek.opened.value)}
                    detail={formatDelta(thisWeek.opened.delta, previousLabel)}
                    tone={thisWeek.opened.tone}
                    trend={trendOf(thisWeek.opened.delta)}
                  />
                  <KpiCard
                    label="Issues Closed"
                    icon={CircleCheck}
                    value={formatCount(thisWeek.closed.value)}
                    detail={formatDelta(thisWeek.closed.delta, previousLabel)}
                    tone={thisWeek.closed.tone}
                    trend={trendOf(thisWeek.closed.delta)}
                  />
                </KpiGroup>
                <KpiGroup
                  title={isInRange ? 'In range' : 'Project to date'}
                  subtitle={model.rangeLabel ?? `Through ${model.selectedWeek.label}`}
                  variant="toDate"
                  wrapShare={inspectionIndex === null ? undefined : FOUR_CARD_SHARE}
                >
                  <KpiCard
                    label="Total Opened"
                    icon={Layers}
                    value={formatCount(toDate.opened.value)}
                    detail={thisWeekChange(toDate.opened.delta)}
                    tone={toDate.opened.tone}
                    trend="none"
                  />
                  <KpiCard
                    label="Total Closed"
                    icon={CheckCheck}
                    value={formatCount(toDate.closed.value)}
                    detail={thisWeekChange(toDate.closed.delta)}
                    tone={toDate.closed.tone}
                    trend="none"
                  />
                  <KpiCard
                    label="Remaining Open"
                    icon={CircleDot}
                    value={formatCount(toDate.remaining.value)}
                    detail={thisWeekChange(toDate.remaining.delta)}
                    tone={toDate.remaining.tone}
                    trend="none"
                  />
                  <KpiCard
                    label="Closure Rate"
                    icon={Gauge}
                    value={formatPercent(closureRate.value)}
                    detail={closureRateDetail(closureRate, previousLabel, model.rangeClosure)}
                    tone={closureRate.tone}
                    trend={pointsTrend(closureRate.deltaPoints)}
                  />
                  {inspectionIndex !== null && (
                    <KpiCard
                      label="NCR Pass Rate"
                      icon={ClipboardCheck}
                      value={formatPercent(ncrPassRate)}
                      context={isFieldFilterActive ? 'All inspections' : undefined}
                      tone="neutral"
                      trend="none"
                    />
                  )}
                </KpiGroup>
              </div>

              {!isCardsOnly && (
                <div className="qaqc-charts">
                  {CHART_IDS.map((id) => {
                    const chart = charts[id]
                    return (
                      <ChartPanel
                        key={id}
                        className={chart.className}
                        title={chart.title}
                        icon={chart.icon}
                        legend={chart.legend}
                        emptyMessage={chart.emptyMessage}
                        {...expandable(id)}
                      >
                        {chart.renderChart}
                      </ChartPanel>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <Footnotes notes={notes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
