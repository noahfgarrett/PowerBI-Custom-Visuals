import { ClipboardCheck, Flame, Inbox, ListOrdered, Percent, TriangleAlert, UserRound, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import { buildPerformanceFootnotes } from '../footnotes'
import { formatCount } from '../format'
import { useDashboardFilters } from '../hooks/useDashboardFilters'
import { useWeekWindow } from '../hooks/useWeekWindow'
import {
  buildPerformanceModel,
  filterPerformanceIndex,
  performanceFilterFields,
  performanceFilterRows,
  performanceRowWeekKey,
  type DisciplineTag,
  type PerformanceGroup,
  type PerformanceIndex,
  type PerformanceWindow,
} from '../performance'
import { chartColorsFromTheme } from '../theme'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type ExpandablePanel, type OpenPage } from './ChartExpansionFrame'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { FilterChips } from './FilterChips'
import { FilterEmptyState } from './FilterEmptyState'
import { Footnotes } from './Footnotes'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { disciplineNames, formatPassRate, PerformanceTable } from './PerformanceTable'
import { PersonDetail } from './PersonDetail'
import { SegmentedToggle, type SegmentedOption } from './SegmentedToggle'

type PanelId = 'person'

/** The words that change with the group: the summary strip, the person page title and the empty state. */
interface GroupWords {
  /** The switch label and the summary strip title. */
  title: string
  /** The person page title's group, after the name. */
  personGroup: string
  rankedLabel: string
  volumeLabel: string
  volumeIcon: LucideIcon
  /** Lower case: "5 finals", "10 welds". */
  volumeNoun: string
  ncrDetail: string
  emptyTitle: string
}

const GROUP_WORDS: Record<PerformanceGroup, GroupWords> = {
  qcr: {
    title: 'QCR / FE',
    personGroup: 'QCR / FE',
    rankedLabel: 'QCR/FE ranked',
    volumeLabel: 'Finals',
    volumeIcon: ClipboardCheck,
    volumeNoun: 'finals',
    ncrDetail: 'Finals with an issue found',
    emptyTitle: 'No finals',
  },
  welders: {
    title: 'Welders',
    personGroup: 'Welder',
    rankedLabel: 'Welders ranked',
    volumeLabel: 'Welds',
    volumeIcon: Flame,
    volumeNoun: 'welds',
    ncrDetail: 'Welds with an issue',
    emptyTitle: 'No welds',
  },
}

/** The `QCR / FE | Welders` switch. */
const GROUP_OPTIONS: ReadonlyArray<SegmentedOption<PerformanceGroup>> = [
  { value: 'qcr', text: GROUP_WORDS.qcr.title },
  { value: 'welders', text: GROUP_WORDS.welders.title },
]

export interface PerformanceDashboardProps extends Omit<DashboardChromeProps, 'footnotes'> {
  /** Built over every row, once per data update. */
  index: PerformanceIndex
  /** People need at least this many finals in the period to be ranked (Format pane, Ranking). */
  minimumFinals: number
  /** Welders need at least this many welds in the period to be ranked (Format pane, Ranking). */
  minimumWelds: number
  /** The footnotes depend on the group and period shown, so the dashboard builds them; this adds the row-limit note. */
  rowLimitReached: boolean
}

/** "WW13'2026 to WW42'2026", or the one week's label. */
function periodLabel(window: PerformanceWindow): string {
  return window.weekCount === 1 ? window.first.label : `${window.first.label} to ${window.last.label}`
}

/** The person whose page is open, fixed when it opens: the dashboard behind the page is inert until it closes. */
interface OpenPerson {
  key: string
  name: string
  group: PerformanceGroup
  /** QCR/FE only: the disciplines the title names. Empty for welders. */
  tags: DisciplineTag[]
}

/** "QCR 02 · QCR / FE · Electrical", or "Welder 024 · Welder". */
function personTitle(person: OpenPerson): string {
  const parts = [person.name, GROUP_WORDS[person.group].personGroup]
  if (person.tags.length > 0) parts.push(disciplineNames(person.tags))
  return parts.join(' · ')
}

/**
 * NCR performance for one group at a time: a summary strip for the period, then everyone ranked by NCR Pass Rate, with a
 * page per person. The index is built once per data update; switching group, range or week only re-ranks it, and a field
 * filter rebuilds it over the matching rows. The Filter menu's state is shared: each group offers and applies its own
 * fields, and the other group's stay ticked, unapplied, until it's back on screen.
 */
export function PerformanceDashboard({
  title,
  icon,
  index: baseIndex,
  minimumFinals,
  minimumWelds,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  rowLimitReached,
  viewport,
  onHover,
}: PerformanceDashboardProps): ReactElement {
  const [group, setGroup] = useState<PerformanceGroup>('qcr')
  const { columns } = baseIndex
  const fields = useMemo(() => performanceFilterFields(columns, group), [columns, group])
  const rows = useMemo(() => performanceFilterRows(baseIndex, group), [baseIndex, group])
  const rowWeekKey = useMemo(() => performanceRowWeekKey(columns), [columns])
  const filters = useDashboardFilters({ rows, fields, weeks: baseIndex.weeks, currentKey: baseIndex.currentWeek.key, rowWeekKey })
  const { filteredRows, isFieldFilterActive, dateRange } = filters
  const index = useMemo(
    () => (isFieldFilterActive ? filterPerformanceIndex(baseIndex, filteredRows) : baseIndex),
    [isFieldFilterActive, baseIndex, filteredRows],
  )
  const { view, range, pickWeek, changeRange } = useWeekWindow(index, dateRange)
  const [openPerson, setOpenPerson] = useState<OpenPerson | null>(null)
  const minimum = group === 'qcr' ? minimumFinals : minimumWelds

  const model = useMemo(() => buildPerformanceModel(index, view, group, minimum), [index, view, group, minimum])
  const notes = useMemo(() => buildPerformanceFootnotes(index, group, model, rowLimitReached), [index, group, model, rowLimitReached])
  // Memoized so the table's and the page's chart memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const words = GROUP_WORDS[group]
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  const period = periodLabel(model.window)
  const hasRows = model.ranked.length > 0 || model.belowMinimum.length > 0 || model.notRecorded !== null
  // Field-filtered rows outside the 30 WW do match: the message below points to All instead.
  const hasNoMatch = filters.isAnyActive && !hasRows && (dateRange !== null || !index.totals[group].volume.some((volume) => volume > 0))
  const { summary } = model

  const panels: Record<PanelId, ExpandablePanel> = {
    person: {
      title: openPerson === null ? 'Person' : personTitle(openPerson),
      icon: UserRound,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      // Mounted only while the page is open, so the person's detail is built only then.
      renderExpanded: () =>
        openPerson === null ? null : (
          <PersonDetail
            index={index}
            allTimeIndex={baseIndex}
            group={openPerson.group}
            personKey={openPerson.key}
            view={view}
            colors={colors}
            animate={animate}
            describe={describeCharts}
            onHover={onHover}
          />
        ),
    },
  }

  function openFrom(openPage: OpenPage<PanelId>, key: string, row: HTMLTableRowElement): void {
    const person = model.ranked.find((candidate) => candidate.key === key) ?? model.belowMinimum.find((candidate) => candidate.key === key)
    const name = row.querySelector<HTMLElement>('.qaqc-perf-name')
    if (!person || !name) return
    // The period row's disciplines; the person's all-time ones if the period row has none.
    const tags = person.tags.length > 0 ? person.tags : index[group].find((candidate) => candidate.key === key)?.disciplines ?? []
    setOpenPerson({ key, name: person.name, group, tags })
    openPage('person', row, name)
  }

  return (
    <ChartExpansionFrame
      panels={panels}
      interactive={interactive}
      animate={animate}
      isCompact={isCompact}
      isCardsOnly={isCardsOnly}
      onHover={onHover}
    >
      {(_expandable, openPage) => (
        <>
          <LoadingBar active={loading} />
          <DashboardHeader
            title={title}
            icon={icon}
            interactive={interactive}
            range={range}
            onRangeChange={changeRange}
            rangeLabel="Ranking period"
            isRangeDisabled={dateRange !== null}
            filterMenu={filters.menu}
            weekOptions={model.weekOptions}
            selectedKey={model.selectedWeek.key}
            onPickWeek={pickWeek}
          >
            <SegmentedToggle label="People group" options={GROUP_OPTIONS} value={group} disabled={!interactive} onChange={setGroup} />
          </DashboardHeader>

          <FilterChips {...filters.chips} disabled={!interactive} />

          {hasNoMatch ? (
            <FilterEmptyState
              rowsName={words.volumeNoun}
              isInRange={dateRange !== null}
              disabled={!interactive}
              onClear={() => {
                filters.clearAll()
                filters.chips.onFocusLost()
              }}
            />
          ) : (
            <>
              <div className="qaqc-kpi-row qaqc-perf-summary">
                <KpiGroup title={words.title} subtitle={period} variant="period">
                  <KpiCard
                    label={words.rankedLabel}
                    icon={ListOrdered}
                    value={formatCount(summary.peopleRanked)}
                    detail={`Minimum ${formatCount(minimum)} ${words.volumeNoun} · ${formatCount(model.belowMinimum.length)} below`}
                    tone="neutral"
                    trend="none"
                  />
                  <KpiCard
                    label={words.volumeLabel}
                    icon={words.volumeIcon}
                    value={formatCount(summary.volume)}
                    detail="Whole group, incl. unranked"
                    tone="neutral"
                    trend="none"
                  />
                  <KpiCard
                    label="NCRs"
                    icon={TriangleAlert}
                    value={formatCount(summary.ncrs)}
                    detail={words.ncrDetail}
                    tone="neutral"
                    trend="none"
                  />
                  <KpiCard
                    label="NCR Pass Rate"
                    icon={Percent}
                    value={formatPassRate(summary.passRate)}
                    tone="neutral"
                    trend="none"
                  />
                </KpiGroup>
              </div>

              {!isCardsOnly && (hasRows ? (
                <PerformanceTable
                  // Keyed on the group, so switching groups starts with the below-minimum group collapsed and no sort.
                  key={group}
                  group={group}
                  ranked={model.ranked}
                  belowMinimum={model.belowMinimum}
                  notRecorded={model.notRecorded}
                  colors={colors}
                  isHighContrast={theme.isHighContrast}
                  onOpenPerson={interactive ? (key, row) => openFrom(openPage, key, row) : null}
                />
              ) : (
                <p className="qaqc-issue-detail-empty qaqc-perf-empty-state">
                  <Inbox size={22} aria-hidden="true" />
                  <strong>{`${words.emptyTitle} in ${period}`}</strong>
                  <span>Pick another work week, or choose All to rank the whole history.</span>
                </p>
              ))}
            </>
          )}

          <Footnotes notes={notes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
