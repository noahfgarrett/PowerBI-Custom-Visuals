import { LayoutDashboard, ListChecks, LoaderCircle } from 'lucide-react'
import { createRoot } from 'react-dom/client'

import { COMBINED_COLUMNS, COMBINED_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { syntheticCombinedRows } from '../../qaqc-shared/src/__tests__/fixtures/syntheticCombined'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { splitCombinedRows } from '../../qaqc-shared/src/combined'
import { OverviewDashboard } from '../../qaqc-shared/src/components/OverviewDashboard'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { OPTIONAL_COMBINED_ROLES, OVERVIEW_SLOTS } from '../../qaqc-shared/src/dataView'
import { buildOverviewFootnotes } from '../../qaqc-shared/src/footnotes'
import { buildOverviewIndex } from '../../qaqc-shared/src/overview'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'
import type { CombinedColumns } from '../../qaqc-shared/src/types'

import '../style/visual.less'

const params = new URLSearchParams(window.location.search)
const width = Number(params.get('w') ?? 1280)
const height = Number(params.get('h') ?? 720)
const presetParam = params.get('preset') ?? 'qaqc'
const data = params.get('data') ?? 'fixture'
/** `?greenTags=N` binds the Green tags measure with N on every row, as Power BI repeats an unrelated measure. */
const greenTagsParam = params.get('greenTags')
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
 * The fixture and the synthetic rows share the QAQC Combined column order. The Overview binds every slot but the
 * Performance-only ones; the Green tags measure, when given, is one extra column after the combined columns.
 */
const columns: CombinedColumns = {
  source: position('Source'),
  workWeek: position('Work Week'),
  phase: position('Inspection Phase'),
  issue: position('Issue'),
  building: position('Building'),
  qcr: -1,
  welder: -1,
  tagNo: -1,
  signature: position('Signature'),
  signedWeek: position('Work Week Signed'),
  id: position('ID'),
  status: position('Status'),
  type: position('Type'),
  createdOn: position('Created On'),
  updatedOn: position('Updated On'),
  createdBy: position('Created By'),
  greenTags: greenTagsParam === null ? -1 : COMBINED_COLUMNS.length,
}

function withGreenTags(rows: ReadonlyArray<ReadonlyArray<unknown>>): ReadonlyArray<ReadonlyArray<unknown>> {
  if (greenTagsParam === null) return rows
  return rows.map((row) => [...row, greenTagsParam])
}

const root = createRoot(frame)

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the QAQC Combined columns"
      message="Drag these columns from the QAQC Combined table into the matching field slots. See QAQC_Overview_SETUP.md."
      items={OVERVIEW_SLOTS.filter((slot) => !OPTIONAL_COMBINED_ROLES.has(slot.role)).map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else if (data === 'loading') {
  root.render(<StatusPanel icon={LoaderCircle} title="Loading rows" message="Power BI is sending the rows in batches." items={[]} />)
} else {
  const source = data === 'synthetic'
    ? syntheticCombinedRows(Number(params.get('rows') ?? 500_000))
    : data === 'empty' ? [] : COMBINED_ROWS
  const rows = withGreenTags(source)
  const started = performance.now()
  const index = buildOverviewIndex(splitCombinedRows(rows, columns.source), columns, today)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  root.render(
    <OverviewDashboard
      title="QAQC Overview"
      icon={LayoutDashboard}
      index={index}
      theme={theme}
      interactive={params.get('interactive') !== '0'}
      animate
      describeCharts
      loading={false}
      footnotes={buildOverviewFootnotes(index, false)}
      viewport={{ width, height }}
      onHover={showTooltip}
    />,
  )
}
