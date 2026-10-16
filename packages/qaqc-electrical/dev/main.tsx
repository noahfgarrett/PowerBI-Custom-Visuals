import { ListChecks, LoaderCircle, Zap } from 'lucide-react'
import { createRoot } from 'react-dom/client'

import '../style/visual.less'

import { ELECTRICAL_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { syntheticInspectionRows } from '../../qaqc-shared/src/__tests__/fixtures/syntheticRows'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { InspectionDashboard } from '../../qaqc-shared/src/components/InspectionDashboard'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { REQUIRED_SLOTS } from '../../qaqc-shared/src/dataView'
import { buildFootnotes } from '../../qaqc-shared/src/footnotes'
import { buildInspectionIndex } from '../../qaqc-shared/src/inspections'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'

const params = new URLSearchParams(window.location.search)
const width = Number(params.get('w') ?? 1280)
const height = Number(params.get('h') ?? 720)
const presetParam = params.get('preset') ?? 'qaqc'
const data = params.get('data') ?? 'fixture'
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

const root = createRoot(frame)
const columns = { workWeek: 0, phase: 1, issue: 2, building: 3 }

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the Electrical Inspection Log columns"
      message="Drag these columns from your Smartsheet table into the matching field slots."
      items={REQUIRED_SLOTS.map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else if (data === 'loading') {
  root.render(<StatusPanel icon={LoaderCircle} title="Loading inspections" message="Power BI is sending the rows in batches." items={[]} />)
} else {
  const rows = data === 'synthetic'
    ? syntheticInspectionRows(Number(params.get('rows') ?? 500_000))
    : data === 'empty' ? [] : ELECTRICAL_ROWS
  const started = performance.now()
  const index = buildInspectionIndex(rows, columns, today)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  root.render(
    <InspectionDashboard
      title="QCx Electrical Inspections"
      icon={Zap}
      index={index}
      theme={theme}
      interactive={params.get('interactive') !== '0'}
      animate
      describeCharts
      loading={false}
      footnotes={buildFootnotes(index, false)}
      viewport={{ width, height }}
      onHover={showTooltip}
    />,
  )
}
