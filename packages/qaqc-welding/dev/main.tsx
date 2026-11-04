import { Flame, ListChecks, LoaderCircle } from 'lucide-react'
import { createRoot } from 'react-dom/client'

import '../style/visual.less'

import { syntheticWeldRows } from '../../qaqc-shared/src/__tests__/fixtures/syntheticRows'
import { WELDING_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/weldingRows'
import { PLACEHOLDER_WELD_OPTIONAL, UNBOUND_WELD_OPTIONAL, WELD_COLUMNS, weldFilterSourceFor, withPlaceholderWeldColumns } from '../../qaqc-shared/src/__tests__/weldFilterFixture'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { WeldingDashboard } from '../../qaqc-shared/src/components/WeldingDashboard'
import { WELD_SLOTS } from '../../qaqc-shared/src/dataView'
import { buildFootnotes } from '../../qaqc-shared/src/footnotes'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'
import { buildWeldIndex } from '../../qaqc-shared/src/welds'

const params = new URLSearchParams(window.location.search)
const width = Number(params.get('w') ?? 1280)
const height = Number(params.get('h') ?? 720)
const presetParam = params.get('preset') ?? 'qaqc'
const data = params.get('data') ?? 'fixture'
const minWelds = Number(params.get('minWelds') ?? 10)
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

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the Welding Signoffs columns"
      message="Drag these columns from your Smartsheet table into the matching field slots."
      items={WELD_SLOTS.map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else if (data === 'loading') {
  root.render(<StatusPanel icon={LoaderCircle} title="Loading welds" message="Power BI is sending the rows in batches." items={[]} />)
} else {
  // The fixture has only the required columns, so made-up ones fill the filter menu here.
  const rows = data === 'synthetic'
    ? syntheticWeldRows(Number(params.get('rows') ?? 500_000))
    : data === 'empty' ? [] : withPlaceholderWeldColumns(WELDING_ROWS)
  const started = performance.now()
  const index = buildWeldIndex(rows, WELD_COLUMNS, today)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  root.render(
    <WeldingDashboard
      title="QCx Welding Signoffs"
      icon={Flame}
      index={index}
      filterSource={weldFilterSourceFor(rows, today, data === 'synthetic' ? UNBOUND_WELD_OPTIONAL : PLACEHOLDER_WELD_OPTIONAL)}
      minWelds={minWelds}
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
