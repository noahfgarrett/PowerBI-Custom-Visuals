import { ChevronRight, CircleDot, Hourglass, Timer, TimerOff, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'

import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatDelta, pluralize, trendOf } from '../format'
import { RECENT_WEEK_COUNT } from '../inspections'
import { ageBuckets, agingProfile, buildIssueBenchmarks, quarterMedians, type AgeBucket, type IssueBenchmarks, type OpenIssueAge } from '../issueBenchmarks'
import { riseIsBad } from '../issues'
import type { IssueIndex, RangeMode, ViewState, WorkWeek } from '../types'
import { previousWorkWeek } from '../workWeeks'
import { AgeBucketsChart, ageBucketsLegend } from './AgeBucketsChart'
import { AgingIssueList } from './AgingIssueList'
import { BacklogAgeChart, backlogLegend } from './BacklogAgeChart'
import { ChartPanel } from './ChartPanel'
import { Footnotes } from './Footnotes'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { QuarterCloseChart, quarterLegend } from './QuarterCloseChart'
import { RangeToggle } from './RangeToggle'
import { WorkWeekPicker } from './WorkWeekPicker'

const PAST_WINDOW_LABEL = 'Past the normal close window'

/** Which open issues the list shows: all of them, one age bucket (by key), or those past the window. */
type ListFilter =
  | { kind: 'all' }
  | { kind: 'bucket'; key: string }
  | { kind: 'past' }

interface ListContent {
  rows: OpenIssueAge[]
  /** Null for every open issue. */
  label: string | null
}

function listContent(filter: ListFilter, benchmarks: IssueBenchmarks, buckets: readonly AgeBucket[]): ListContent {
  switch (filter.kind) {
    case 'all':
      return { rows: benchmarks.open, label: null }
    case 'bucket': {
      // A new week can rebuild the buckets around a new window; a bucket that is gone falls back to every issue.
      const bucket = buckets.find((item) => item.key === filter.key)
      return bucket === undefined ? { rows: benchmarks.open, label: null } : { rows: bucket.issues, label: bucket.label }
    }
    case 'past': {
      const { window } = benchmarks
      return { rows: window === null ? [] : benchmarks.open.filter((open) => open.age > window), label: PAST_WINDOW_LABEL }
    }
    default: {
      const unreachable: never = filter
      return unreachable
    }
  }
}

const days = (value: number | null): string => (value === null ? 'n/a' : `${formatCount(value)} days`)

/** The page's footnotes: the dashboard's, then closed issues left out of the close times. */
function pageFootnotes(footnotes: string[], closedWithoutDate: number): string[] {
  if (closedWithoutDate === 0) return footnotes
  const note = `${formatCount(closedWithoutDate)} closed ${pluralize(closedWithoutDate, 'issue has', 'issues have')} no Updated On and ${pluralize(closedWithoutDate, 'is', 'are')} left out of close times`
  return [...footnotes, note]
}

/** The page overlay's title, as of the selected week. */
export function issueAgingTitle(selectedWeek: WorkWeek): string {
  return `Issue Aging · as of ${selectedWeek.label}`
}

export interface IssueAgingPageProps {
  index: IssueIndex
  /** The dashboard's week window: the page shows and changes the same selection. */
  view: ViewState
  /** Newest first. */
  weekOptions: WorkWeek[]
  colors: ChartColors
  animate: boolean
  /** The dashboard's footnotes. */
  footnotes: string[]
  onSelectWeek: (key: number) => void
  onPickWeek: (key: number) => void
  onRangeChange: (mode: RangeMode) => void
  onHover: TooltipHandler
}

/**
 * The Issue Aging page opened from the BIM Issues header: how old the open issues are as of the selected week,
 * against the normal close window, with the issues behind any bar or the red card in a list over the charts.
 * Mount it only while the page is open; it builds the benchmarks for the selected week.
 */
export function IssueAgingPage({
  index,
  view,
  weekOptions,
  colors,
  animate,
  footnotes,
  onSelectWeek,
  onPickWeek,
  onRangeChange,
  onHover,
}: IssueAgingPageProps): ReactElement {
  const benchmarks = useMemo(() => buildIssueBenchmarks(index, view.selectedKey, index.today), [index, view.selectedKey])
  const buckets = useMemo(() => ageBuckets(benchmarks), [benchmarks])
  const profile = useMemo(() => agingProfile(index, view, index.today), [index, view])
  const quarters = useMemo(() => quarterMedians(index, view.selectedKey, index.today), [index, view.selectedKey])
  const [listFilter, setListFilter] = useState<ListFilter | null>(null)
  const openerRef = useRef<HTMLElement | SVGElement | null>(null)
  const isRestoringFocusRef = useRef(false)
  const mainPanelRef = useRef<HTMLElement | null>(null)

  const { asOf, window, typical, closures, pastWindow, olderThanAny, openDelta } = benchmarks
  const open = benchmarks.open.length
  const previousLabel = previousWorkWeek(asOf).label
  const hasWindow = window !== null
  const isPastClickable = hasWindow && pastWindow > 0
  const content = listFilter === null ? null : listContent(listFilter, benchmarks, buckets)
  const hasOpenProfile = profile.some((point) => point.median !== null)

  // Focus returns to what opened the list: a bar, the red card, or the expand button; or to the chart panel when
  // that element is gone.
  useEffect(() => {
    if (listFilter !== null || !isRestoringFocusRef.current) return
    isRestoringFocusRef.current = false
    const opener = openerRef.current
    openerRef.current = null
    const fallback = mainPanelRef.current?.querySelector<HTMLButtonElement>('.qaqc-expand-button') ?? mainPanelRef.current
    const target = opener !== null && opener.isConnected ? opener : fallback
    target?.focus({ preventScroll: true })
  }, [listFilter])

  function openList(filter: ListFilter): void {
    const active = document.activeElement
    if (listFilter === null) openerRef.current = active instanceof HTMLElement || active instanceof SVGElement ? active : null
    onHover(null)
    setListFilter(filter)
  }

  function closeList(): void {
    isRestoringFocusRef.current = true
    setListFilter(null)
  }

  // Esc anywhere on the page closes the list first; with no list open it reaches the page overlay and closes it.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape' || listFilter === null) return
    event.preventDefault()
    event.stopPropagation()
    closeList()
  }

  function onPastCardKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openList({ kind: 'past' })
  }

  const pastCard = (
    <KpiCard
      label={PAST_WINDOW_LABEL}
      icon={TimerOff}
      value={hasWindow ? formatCount(pastWindow) : 'n/a'}
      detail={hasWindow
        ? `${formatCount(olderThanAny)} ${pluralize(olderThanAny, 'is', 'are')} older than any issue ever closed`
        : 'No closures yet, so no window'}
      tone={!hasWindow ? 'neutral' : pastWindow > 0 ? 'bad' : 'good'}
      trend="none"
      isValueBad={isPastClickable}
    />
  )

  return (
    <div className="qaqc-aging-page" onKeyDown={onKeyDown}>
      <div className="qaqc-aging-top">
        <KpiGroup title={`As of ${asOf.label}`} subtitle={`${formatCount(closures)} ${pluralize(closures, 'issue', 'issues')} closed to date`} variant="week">
          <KpiCard
            label="Open issues"
            icon={CircleDot}
            value={formatCount(open)}
            detail={formatDelta(openDelta, previousLabel)}
            tone={riseIsBad(openDelta)}
            trend={trendOf(openDelta)}
          />
          <KpiCard
            label="Most issues close within"
            icon={Timer}
            value={days(typical)}
            detail={window === null ? 'Nothing closed yet' : `90% within ${days(window)} · from ${formatCount(closures)} closed`}
            tone="neutral"
            trend="none"
          />
          {isPastClickable ? (
            <div
              role="button"
              tabIndex={0}
              className="qaqc-aging-card-button"
              aria-label={`View the ${formatCount(pastWindow)} open issues past the normal close window`}
              onClick={() => openList({ kind: 'past' })}
              onKeyDown={onPastCardKey}
            >
              {pastCard}
              <span className="qaqc-aging-card-hint" aria-hidden="true">
                View issues
                <ChevronRight size={12} />
              </span>
            </div>
          ) : pastCard}
        </KpiGroup>
        <div className="qaqc-aging-controls">
          <RangeToggle value={view.range} recentCount={RECENT_WEEK_COUNT} disabled={false} onChange={onRangeChange} />
          <WorkWeekPicker options={weekOptions} valueKey={asOf.key} disabled={false} onChange={onPickWeek} />
        </div>
      </div>

      <div className="qaqc-aging-body">
        <div className="qaqc-charts qaqc-aging-charts" inert={content !== null}>
          <ChartPanel
            className="qaqc-panel-main"
            title="How old are the open issues?"
            icon={Hourglass}
            legend={ageBucketsLegend(colors, hasWindow)}
            emptyMessage={open === 0 ? 'No open issues' : null}
            onExpand={() => openList({ kind: 'all' })}
            sectionRef={(element) => {
              mainPanelRef.current = element
            }}
          >
            {(size) => (
              <AgeBucketsChart
                benchmarks={benchmarks}
                buckets={buckets}
                width={size.width}
                height={size.height}
                colors={colors}
                onHover={onHover}
                onOpenBucket={(key) => openList({ kind: 'bucket', key })}
              />
            )}
          </ChartPanel>
          <ChartPanel
            title="Is the backlog getting older?"
            icon={TrendingUp}
            legend={backlogLegend(colors, window)}
            emptyMessage={hasOpenProfile ? null : 'No open issues in this range'}
          >
            {(size) => (
              <BacklogAgeChart
                points={profile}
                windowDays={window}
                selectedKey={asOf.key}
                width={size.width}
                height={size.height}
                colors={colors}
                onSelectWeek={onSelectWeek}
                onHover={onHover}
              />
            )}
          </ChartPanel>
          <ChartPanel
            title="Is closing getting faster or slower?"
            icon={Timer}
            legend={quarterLegend(colors, typical)}
            emptyMessage={quarters.length === 0 ? 'Nothing closed yet' : null}
          >
            {(size) => (
              <QuarterCloseChart points={quarters} typical={typical} width={size.width} height={size.height} colors={colors} onHover={onHover} />
            )}
          </ChartPanel>
        </div>
        {content !== null && (
          <AgingIssueList
            rows={content.rows}
            filterLabel={content.label}
            windowDays={window}
            asOfLabel={asOf.label}
            animate={animate}
            onClearFilter={() => setListFilter({ kind: 'all' })}
            onClose={closeList}
          />
        )}
      </div>

      <Footnotes notes={pageFootnotes(footnotes, benchmarks.closedWithoutDate)} />
    </div>
  )
}
