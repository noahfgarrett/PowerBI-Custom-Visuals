import { ListChecks, Map as MapIcon } from 'lucide-react'
import { createRoot } from 'react-dom/client'

import '../style/visual.less'

import { syntheticFfuTable } from '../../qaqc-shared/src/__tests__/fixtures/syntheticFfu'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import type { InspectionTableSource } from '../../qaqc-shared/src/dataView'
import { FfuMapDashboard } from '../../qaqc-shared/src/components/FfuMapDashboard'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { buildFfuIndex, FFU_SLOTS, readFfuTable, REQUIRED_FFU_ROLES } from '../../qaqc-shared/src/ffuMap'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'
import { layoutTableOf } from './layoutTable'
import { measureDraw, runScriptedState, scriptedStateOf } from './scriptedState'

/** Served by the dev server from FFU_LAYOUT_CSV (see vite.config.ts). */
const LAYOUT_URL = '/__ffu-layout.csv'

const params = new URLSearchParams(window.location.search)
const width = Number(params.get('w') ?? 1280)
const height = Number(params.get('h') ?? 720)
const presetParam = params.get('preset') ?? 'qaqc'
const data = params.get('data') ?? 'synthetic'
const isLayoutFile = params.get('file') === '1'
const isDebug = params.get('debug') === '1'
const state = scriptedStateOf(params.get('state'))

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

/** Stands in for the host selection: the selected node indices, for inspecting the page. */
function showSelection(nodes: number[]): void {
  frame?.setAttribute('data-selected', nodes.join(','))
}

const root = createRoot(frame)

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the FFU layout and tracker columns"
      message="Drag the columns into the matching field slots. See QCx_FFU_Map_SETUP.md."
      items={FFU_SLOTS.filter((slot) => REQUIRED_FFU_ROLES.has(slot.role)).map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else {
  void renderMap().catch((error: unknown) => {
    showNote(`Could not load the map: ${error instanceof Error ? error.message : String(error)}`)
  })
}

/** A line of text above the frame: the data source, the debug timing, or a load error. */
function showNote(text: string): void {
  const note = document.getElementById('note')
  if (note) note.textContent = text
}

/** Made-up rows, or with `?file=1` the local layout CSV the dev server serves, with made-up tracker fields. */
async function tableOf(): Promise<InspectionTableSource> {
  if (!isLayoutFile) return syntheticFfuTable(Number(params.get('n') ?? 6000))
  const response = await fetch(LAYOUT_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(await response.text())
  return layoutTableOf(await response.text())
}

async function renderMap(): Promise<void> {
  const table = readFfuTable(await tableOf())
  if (table.kind !== 'ready') throw new Error('the table does not bind FFU Tag, X and Y')
  const started = performance.now()
  const index = buildFfuIndex(table.rows, table.columns)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  showNote(isLayoutFile ? 'Local layout file · sample tracker data' : 'Synthetic data')
  root.render(
    <FfuMapDashboard
      title="QCx FFU Map"
      icon={MapIcon}
      theme={theme}
      interactive={params.get('interactive') !== '0'}
      loading={params.get('loading') === '1'}
      index={index}
      dataVersion={0}
      onSelect={showSelection}
      onClear={() => showSelection([])}
      onHover={showTooltip}
    />,
  )
  if (isDebug) {
    const ratio = params.get('ratio')
    const timing = await measureDraw(index, theme, ratio === null ? null : Number(ratio))
    showNote(`${isLayoutFile ? 'Local layout file · sample tracker data' : 'Synthetic data'} · ${timing}`)
  }
  await runScriptedState(state, index)
  document.body.setAttribute('data-ready', state)
}
