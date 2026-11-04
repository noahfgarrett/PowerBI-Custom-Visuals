import { ListChecks, LoaderCircle, Users } from 'lucide-react'
import { createRoot } from 'react-dom/client'

import '../style/visual.less'

import { COMBINED_COLUMNS, COMBINED_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { syntheticCombinedRows } from '../../qaqc-shared/src/__tests__/fixtures/syntheticCombined'
import { COMBINED_FILTER_POSITIONS, withPlaceholderCombinedColumns } from '../../qaqc-shared/src/__tests__/overviewFilterFixture'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { splitCombinedRows } from '../../qaqc-shared/src/combined'
import { PerformanceDashboard } from '../../qaqc-shared/src/components/PerformanceDashboard'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { PERFORMANCE_SLOTS } from '../../qaqc-shared/src/dataView'
import { buildPerformanceIndex } from '../../qaqc-shared/src/performance'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'
import type { CombinedColumns } from '../../qaqc-shared/src/types'
import { clampMinimum, DEFAULT_MINIMUM_FINALS, DEFAULT_MINIMUM_WELDS } from '../src/settings'

const params = new URLSearchParams(window.location.search)
const width = Number(params.get('w') ?? 1280)
const height = Number(params.get('h') ?? 720)
const presetParam = params.get('preset') ?? 'qaqc'
const data = params.get('data') ?? 'fixture'
const isBound = params.get('bound') !== '0'
const today = new Date(2026, 9, 15)

const frame = document.getElementById('frame')
const tooltip = document.getElementById('tooltip')
if (!frame || !tooltip) throw new Error('preview markup missing')
frame.style.width = `${width}px`
frame.style.height = `${height}px`
frame.classList.add('qaqc-host')

const theme = resolveTheme({
  preset: isPresetName(presetParam) ? presetParam : 'qaqc',
  backgroundColor: params.get('color') ?? '',
  backgroundOpacity: Number(params.get('bg') ?? 100),
  cardOpacity: Number(params.get('card') ?? 100),
  highContrast: params.get('hc') === '1' ? { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' } : null,
})
for (const [name, value] of Object.entries(theme.cssVariables)) frame.style.setProperty(name, value)

function showTooltip(request: TooltipRequest | null): void {
  if (!tooltip) return
  if (request === null) {
    tooltip.style.display = 'none'
    return
  }
  tooltip.innerHTML = ''
  const title = document.createElement('strong')
  title.textContent = request.title
  tooltip.appendChild(title)
  for (const row of request.rows) {
    const line = document.createElement('div')
    line.textContent = `${row.label}: ${row.value}`
    tooltip.appendChild(line)
  }
  tooltip.style.left = `${request.clientX + 12}px`
  tooltip.style.top = `${request.clientY + 12}px`
  tooltip.style.display = 'block'
}

function position(name: (typeof COMBINED_COLUMNS)[number]): number {
  return COMBINED_COLUMNS.indexOf(name)
}

/**
 * The fixture and the synthetic rows share the QCx Combined column order, with made-up values for the new columns on
 * the fixture. Performance binds only its own slots. `?bound=0` leaves the filter slots unbound.
 */
const columns: CombinedColumns = {
  source: position('Source'),
  workWeek: position('Work Week'),
  phase: position('Inspection Phase'),
  issue: position('Issue'),
  building: position('Building'),
  qcr: position('QCR/FE'),
  welder: position('Welder'),
  tagNo: position('Tag No'),
  signature: -1,
  signedWeek: -1,
  id: -1,
  status: -1,
  type: -1,
  createdOn: -1,
  updatedOn: -1,
  createdBy: -1,
  rootCause: -1,
  greenTags: -1,
  ...(isBound
    ? {
        generalContractor: COMBINED_FILTER_POSITIONS.generalContractor,
        discipline: COMBINED_FILTER_POSITIONS.discipline,
        pipeSpec: COMBINED_FILTER_POSITIONS.pipeSpec,
        fluidCode: COMBINED_FILTER_POSITIONS.fluidCode,
      }
    : {}),
}

const root = createRoot(frame)

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the QCx Combined columns"
      message="Drag these columns from the QCx Combined table into the matching field slots. See QCx_Performance_SETUP.md."
      items={PERFORMANCE_SLOTS.map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else if (data === 'loading') {
  root.render(<StatusPanel icon={LoaderCircle} title="Loading rows" message="Power BI is sending the rows in batches." items={[]} />)
} else {
  const rows = data === 'synthetic'
    ? syntheticCombinedRows(Number(params.get('rows') ?? 500_000))
    : data === 'empty' ? [] : isBound ? withPlaceholderCombinedColumns(COMBINED_ROWS) : COMBINED_ROWS
  const started = performance.now()
  const index = buildPerformanceIndex(splitCombinedRows(rows, columns.source), columns, today)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  root.render(
    <PerformanceDashboard
      title="QCx Performance"
      icon={Users}
      index={index}
      minimumFinals={clampMinimum(Number(params.get('minFinals') ?? DEFAULT_MINIMUM_FINALS), DEFAULT_MINIMUM_FINALS)}
      minimumWelds={clampMinimum(Number(params.get('minWelds') ?? DEFAULT_MINIMUM_WELDS), DEFAULT_MINIMUM_WELDS)}
      theme={theme}
      interactive={params.get('interactive') !== '0'}
      animate
      describeCharts
      loading={false}
      rowLimitReached={false}
      viewport={{ width, height }}
      onHover={showTooltip}
    />,
  )
}
