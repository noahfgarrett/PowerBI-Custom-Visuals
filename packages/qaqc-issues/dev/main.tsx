import { CircleAlert, ListChecks, LoaderCircle } from 'lucide-react'
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import '../style/visual.less'

import { ENRICHED_ISSUE_COLUMNS, ENRICHED_ISSUE_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/enrichedIssueRows'
import { ISSUE_ROWS } from '../../qaqc-shared/src/__tests__/fixtures/issueRows'
import { syntheticIssueRows } from '../../qaqc-shared/src/__tests__/fixtures/syntheticRows'
import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { IssuesDashboard } from '../../qaqc-shared/src/components/IssuesDashboard'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { ISSUE_SLOTS, OPTIONAL_ISSUE_ROLES } from '../../qaqc-shared/src/dataView'
import { buildIssueFootnotes } from '../../qaqc-shared/src/footnotes'
import { buildIssueIndex } from '../../qaqc-shared/src/issues'
import { isPresetName, resolveTheme } from '../../qaqc-shared/src/theme'
import type { InspectionRows, IssueColumns } from '../../qaqc-shared/src/types'

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
const columns: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  createdOn: 5,
  updatedOn: 6,
  dueDate: 7,
  createdBy: 8,
  rootCause: 9,
  rootCauseCategory: 10,
}

function enrichedPosition(name: (typeof ENRICHED_ISSUE_COLUMNS)[number]): number {
  return ENRICHED_ISSUE_COLUMNS.indexOf(name)
}

/** ?data=enriched: the enriched Autodesk export in its own column order, every enrichment slot bound. */
const enrichedColumns: IssueColumns = {
  id: enrichedPosition('ID'),
  title: enrichedPosition('Title'),
  status: enrichedPosition('Status'),
  type: enrichedPosition('Type'),
  contractor: enrichedPosition('Contractor'),
  createdOn: enrichedPosition('Created on'),
  updatedOn: enrichedPosition('Updated on'),
  dueDate: enrichedPosition('Due date'),
  createdBy: enrichedPosition('Created by'),
  rootCause: enrichedPosition('Root cause'),
  rootCauseCategory: -1,
  bim360CreatedBy: enrichedPosition('BIM360_Created By'),
  bim360CreatedOn: enrichedPosition('BIM360_Created On'),
  bim360ClosedOn: enrichedPosition('BIM360_Closed On'),
  closedAt: enrichedPosition('Closed at'),
}

interface HarnessData {
  rows: InspectionRows
  columns: IssueColumns
}

/** ?data=synthetic|empty|enriched; anything else is the Smartsheet fixture. */
function harnessData(): HarnessData {
  if (data === 'synthetic') return { rows: syntheticIssueRows(Number(params.get('rows') ?? 200_000)), columns }
  if (data === 'empty') return { rows: [], columns }
  if (data === 'enriched') return { rows: ENRICHED_ISSUE_ROWS, columns: enrichedColumns }
  return { rows: ISSUE_ROWS, columns }
}

if (data === 'missing') {
  root.render(
    <StatusPanel
      icon={ListChecks}
      title="Add the BIM Issues Log columns"
      message="Drag these columns from your Smartsheet table into the matching field slots."
      items={ISSUE_SLOTS.filter((slot) => !OPTIONAL_ISSUE_ROLES.has(slot.role)).map((slot) => `${slot.column} → ${slot.slot}`)}
    />,
  )
} else if (data === 'loading') {
  root.render(<StatusPanel icon={LoaderCircle} title="Loading issues" message="Power BI is sending the rows in batches." items={[]} />)
} else {
  const { rows, columns: boundColumns } = harnessData()
  const started = performance.now()
  const index = buildIssueIndex(rows, boundColumns, today)
  document.title = `index ${Math.round(performance.now() - started)} ms`
  root.render(
    <Harness>
      <IssuesDashboard
        title="QCx BIM Issues"
        icon={CircleAlert}
        index={index}
        theme={theme}
        interactive={params.get('interactive') !== '0'}
        animate={params.get('animate') !== '0'}
        describeCharts
        loading={false}
        footnotes={buildIssueFootnotes(index, false)}
        viewport={{ width, height }}
        onHover={showTooltip}
      />
    </Harness>,
  )
}

interface HarnessProps {
  children: ReactNode
}

/** Draws the dashboard, then opens any page the URL asks for once the dashboard has mounted. */
function Harness({ children }: HarnessProps): ReactElement {
  useEffect(() => {
    openRequestedPage().catch((error: unknown) => {
      document.title = `open failed: ${error instanceof Error ? error.message : String(error)}`
    })
  }, [])
  return <>{children}</>
}

/**
 * Resolves with the first element matching `selector`, now or as soon as the dashboard draws it. A page's content
 * appears only after its open animation, so this waits on the DOM rather than on a guess at the timing.
 */
function whenPresent(selector: string): Promise<Element> {
  const found = document.querySelector(selector)
  if (found !== null) return Promise.resolve(found)
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element === null) return
      observer.disconnect()
      resolve(element)
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

function clickElement(element: Element | null | undefined): void {
  element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function clickButton(scope: ParentNode, text: string): void {
  const button = [...scope.querySelectorAll('button')].find((item) => item.textContent === text)
  button?.click()
}

/**
 * Screenshot helpers: ?open=aging opens the Issue Aging page, and with it &list=all|past|<bucket position> opens
 * its issue list. ?open=pareto opens the Issues by Root Cause Pareto page, with &range=all for every week,
 * &scope=open for Open only and &bar=<position> to select a bar.
 */
async function openRequestedPage(): Promise<void> {
  const page = params.get('open')
  if (page === 'aging') await openAgingPage()
  else if (page === 'pareto') await openParetoPage()
}

async function openAgingPage(): Promise<void> {
  clickElement(await whenPresent('button[aria-label="Open the Issue Aging page"]'))
  const list = params.get('list')
  // The buckets are drawn once the page has opened and measured its charts.
  await whenPresent('.qaqc-aging-page .qaqc-aging-bucket')
  if (list === null) return
  const target = list === 'past'
    ? document.querySelector('.qaqc-aging-card-button')
    : list === 'all'
      ? document.querySelector('.qaqc-aging-page .qaqc-expand-button')
      : document.querySelectorAll('.qaqc-aging-bucket')[Number(list)]
  clickElement(target)
}

async function openParetoPage(): Promise<void> {
  const button = await whenPresent('button[aria-label="Open the Issues by Root Cause Pareto page"]')
  if (params.get('range') === 'all') clickButton(document.querySelector('.qaqc-header') ?? document, 'All')
  clickElement(button)
  // The bars are drawn once the page has opened and measured its chart.
  await whenPresent('.qaqc-pareto-chart .qaqc-hit')
  if (params.get('scope') === 'open') clickButton(document.querySelector('.qaqc-pareto-controls') ?? document, 'Open only')
  const bar = params.get('bar')
  if (bar === null) return
  clickElement(document.querySelectorAll('.qaqc-pareto-chart .qaqc-hit')[Number(bar)])
}
