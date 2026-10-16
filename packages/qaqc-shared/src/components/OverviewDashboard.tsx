import {
  Activity,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CirclePlus,
  ClipboardCheck,
  FilePen,
  FileText,
  Flame,
  Gauge,
  Layers,
  Percent,
  ShieldCheck,
  Signature,
  TrendingUp,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { ElementSize } from '../hooks/useElementSize'
import { useOverviewModel } from '../hooks/useOverviewModel'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { activityLegend, ActivityLinesChart } from './ActivityLinesChart'
import { ChartExpansionFrame, COMPACT_WIDTH, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { Footnotes } from './Footnotes'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { OverviewDenseValue, OverviewDisciplineRow, OverviewKpiCard, OverviewRowLabel, type OverviewCardIcons } from './OverviewDisciplineRow'
import { OverviewWeekTable } from './OverviewWeekTable'
import { QualityRatesChart, qualityRatesLegend } from './QualityRatesChart'
import { SegmentedToggle, type SegmentedOption } from './SegmentedToggle'
import type { CardMode, OverviewIndex, OverviewRows } from '../overview'
import { chartColorsFromTheme } from '../theme'

const NO_ROWS_MESSAGE = 'No QCx Combined rows match the current filters'

/**
 * Tiles shorter than this show the cards only, without the charts. The Overview stacks far more than the other
 * dashboards, so the shared CARDS_ONLY_HEIGHT (420) would leave the charts no room. Measured from the stylesheet: the
 * root's 12 + 10 px padding, the 30 px header, the root's two 10 px gaps (header, footnotes), the 267 px discipline rows
 * (a 15 px head and four 61 px rows of cards inside 8 px padding and the border), the body's two 8 px gaps, the 110 px
 * two-line quality strip, the 180 px chart minimum (`.qaqc-overview-charts`) and a 12 px footnote line:
 * 22 + 30 + 20 + 267 + 16 + 110 + 180 + 12 = 657, rounded up to 660.
 */
export const OVERVIEW_CARDS_ONLY_HEIGHT = 660

/**
 * Cards-only tiles shorter than this use the dense one-line layout: the full cards alone need the same parts without
 * the charts and the body gap above them, 22 + 30 + 20 + 267 + 8 + 110 + 12 = 469, rounded up to 480. Narrow
 * cards-only tiles are always dense, since their full cards stack two by two.
 */
export const OVERVIEW_DENSE_HEIGHT = 480

/** The `This WW | To date` switch for the cards. */
const CARD_MODE_OPTIONS: ReadonlyArray<SegmentedOption<CardMode>> = [
  { value: 'week', text: 'This WW' },
  { value: 'toDate', text: 'To date' },
]

type ChartId = 'activity' | 'rates'

const CHART_IDS: readonly ChartId[] = ['activity', 'rates'] as const

interface DisciplineConfig {
  key: keyof OverviewRows
  name: string
  icon: LucideIcon
  /** What the row's sparkline plots. */
  metric: string
  cardIcons: OverviewCardIcons
}

const INSPECTION_CARD_ICONS: OverviewCardIcons = [ClipboardCheck, Wrench, CircleAlert, Gauge] as const

const DISCIPLINES: readonly DisciplineConfig[] = [
  { key: 'electrical', name: 'Electrical', icon: Zap, metric: 'Finals + SORs', cardIcons: INSPECTION_CARD_ICONS },
  { key: 'mechanical', name: 'Mechanical', icon: Wrench, metric: 'Finals + SORs', cardIcons: INSPECTION_CARD_ICONS },
  { key: 'welding', name: 'Welding', icon: Flame, metric: 'Welds logged', cardIcons: [Layers, Signature, Percent, CircleAlert] },
  { key: 'bim', name: 'BIM Issues', icon: CircleAlert, metric: 'Remaining open', cardIcons: [CirclePlus, CircleCheck, CircleDot, Gauge] },
] as const

/** One icon per quality card, in the strip's order. */
type QualityIcons = readonly [LucideIcon, LucideIcon, LucideIcon, LucideIcon, LucideIcon]

/** CORs, NCRs, Inspection NCR pass rate, Welding NCR pass rate, DWNs. */
const QUALITY_ICONS: QualityIcons = [FilePen, CircleAlert, ClipboardCheck, Flame, FileText] as const

export interface OverviewDashboardProps extends DashboardChromeProps {
  index: OverviewIndex
}

/** The QCx Overview: every discipline's cards for one week or to date, the quality strip, and two charts. */
export function OverviewDashboard({
  title,
  icon,
  index,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: OverviewDashboardProps): ReactElement {
  const { view, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index)
  const [mode, setMode] = useState<CardMode>('week')

  // The series are memoised on the view alone, so a card mode switch never rebuilds the charts' data.
  const { cards, series } = useOverviewModel(index, view, mode)
  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < OVERVIEW_CARDS_ONLY_HEIGHT
  const isDense = isCardsOnly && (isCompact || viewport.height < OVERVIEW_DENSE_HEIGHT)
  const isWeekMode = mode === 'week'
  const cardsSubtitle = isWeekMode ? cards.selectedWeek.label : `Through ${cards.selectedWeek.label}`
  const emptyMessage = cards.hasData ? null : NO_ROWS_MESSAGE
  const groupClass = `qaqc-kpi-group is-${mode}`
  const rowsClass = isDense ? `${groupClass} qaqc-overview-rows is-dense` : `${groupClass} qaqc-overview-rows`

  function renderActivity(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <ActivityLinesChart
        points={series.activity}
        selectedKey={cards.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        isHighContrast={theme.isHighContrast}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={selectWeek}
        onHover={onHover}
      />
    )
  }

  function renderRates(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <QualityRatesChart
        points={series.rates}
        selectedKey={cards.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        isHighContrast={theme.isHighContrast}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={selectWeek}
        onHover={onHover}
      />
    )
  }

  const charts: Record<ChartId, GridPanel> = {
    activity: {
      title: 'Inspection activity by Work Week',
      icon: Activity,
      legend: activityLegend(colors, theme.isHighContrast),
      emptyMessage,
      className: 'qaqc-panel-main',
      renderChart: (size) => renderActivity(size, false),
      renderExpanded: () => (
        <div className="qaqc-overview-expanded">
          <ChartFill>{(size) => renderActivity(size, true)}</ChartFill>
          <OverviewWeekTable variant="activity" points={series.activity} />
        </div>
      ),
    },
    rates: {
      title: 'Quality rates by Work Week',
      icon: TrendingUp,
      legend: qualityRatesLegend(colors, theme.isHighContrast),
      emptyMessage,
      renderChart: (size) => renderRates(size, false),
      renderExpanded: () => (
        <div className="qaqc-overview-expanded">
          <ChartFill>{(size) => renderRates(size, true)}</ChartFill>
          <OverviewWeekTable variant="rates" points={series.rates} />
        </div>
      ),
    },
  }

  return (
    <ChartExpansionFrame
      panels={charts}
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
            weekOptions={cards.weekOptions}
            selectedKey={cards.selectedWeek.key}
            onPickWeek={pickWeek}
          >
            <SegmentedToggle label="Card values" options={CARD_MODE_OPTIONS} value={mode} disabled={!interactive} onChange={setMode} />
          </DashboardHeader>

          <div className="qaqc-overview-body">
            <section className={rowsClass} aria-label="Disciplines">
              <header className="qaqc-kpi-group-head qaqc-overview-rows-head">
                <span>Disciplines</span>
                <em>{cardsSubtitle}</em>
              </header>
              {DISCIPLINES.map((discipline) => (
                <OverviewDisciplineRow
                  key={discipline.key}
                  name={discipline.name}
                  icon={discipline.icon}
                  metric={discipline.metric}
                  cardIcons={discipline.cardIcons}
                  row={cards.rows[discipline.key]}
                  isDense={isDense}
                  sparklineColor={colors.accent}
                  ringColor={colors.card}
                />
              ))}
            </section>

            <div className="qaqc-overview-quality">
              {isDense ? (
                <section className={`${groupClass} qaqc-overview-quality-dense`} aria-label="Quality">
                  <OverviewRowLabel name="Quality" icon={ShieldCheck} />
                  {cards.quality.map((card) => (
                    <OverviewDenseValue key={card.label} card={card} />
                  ))}
                </section>
              ) : (
                <KpiGroup title="Quality" subtitle={cardsSubtitle} variant={mode}>
                  {cards.quality.map((card, at) => (
                    <OverviewKpiCard key={card.label} card={card} icon={QUALITY_ICONS[at]} isTwoLine />
                  ))}
                </KpiGroup>
              )}
            </div>

            {!isCardsOnly && (
              <div className="qaqc-charts qaqc-overview-charts">
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
          </div>

          <Footnotes notes={footnotes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
