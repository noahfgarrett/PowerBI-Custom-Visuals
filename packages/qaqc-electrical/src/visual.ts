import { ListChecks, TriangleAlert, Zap } from 'lucide-react'
import type powerbi from 'powerbi-visuals-api'
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { createElement, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { InspectionDashboard } from '../../qaqc-shared/src/components/InspectionDashboard'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { readInspectionTable, type FieldSlot, type TableReadResult } from '../../qaqc-shared/src/dataView'
import { buildFootnotes } from '../../qaqc-shared/src/footnotes'
import type { InspectionFilterSource } from '../../qaqc-shared/src/inspectionFilters'
import { buildInspectionIndex } from '../../qaqc-shared/src/inspections'
import { resolveTheme, type HighContrastColors, type ResolvedTheme } from '../../qaqc-shared/src/theme'
import type { InspectionIndex } from '../../qaqc-shared/src/types'
import { ElectricalSettingsModel, readDisplaySettings } from './settings'

import '../style/visual.less'

type VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions
type VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type IVisualHost = powerbi.extensibility.visual.IVisualHost

// powerbi.VisualUpdateType.Data and powerbi.VisualDataChangeOperationKind.Append / Segment.
// The API package has no runtime enums, so the const enum values are spelled out.
// Create (0) is any other operation kind: it starts a fresh data load.
const DATA_UPDATE_FLAG = 2
const APPEND_OPERATION = 1
const SEGMENT_OPERATION = 2

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class QaqcElectricalVisual implements powerbi.extensibility.visual.IVisual {
  private readonly host: IVisualHost
  private readonly element: HTMLElement
  private readonly root: Root
  private readonly selectionManager: powerbi.extensibility.ISelectionManager
  private readonly formattingSettingsService: FormattingSettingsService
  private settings = new ElectricalSettingsModel()
  private table: TableReadResult | null = null
  private index: InspectionIndex | null = null
  private filterSource: InspectionFilterSource | null = null
  private loading = false
  private rowLimitReached = false
  private renderError: unknown = null
  private viewport: powerbi.IViewport = { width: 0, height: 0 }

  constructor(options?: VisualConstructorOptions) {
    if (!options) throw new Error('QCx Electrical requires a Power BI visual host.')
    this.host = options.host
    this.element = options.element
    this.element.classList.add('qaqc-host')
    this.element.setAttribute('role', 'region')
    this.element.setAttribute('aria-label', 'QCx electrical inspections dashboard')
    this.selectionManager = this.host.createSelectionManager()
    this.formattingSettingsService = new FormattingSettingsService(this.host.createLocalizationManager())
    // React 19 reports render errors here instead of re-throwing from flushSync; commit() re-throws them.
    this.root = createRoot(this.element, {
      onUncaughtError: (error) => {
        this.renderError = error
      },
    })
    this.element.addEventListener('contextmenu', this.handleContextMenu)
    this.element.addEventListener('keydown', this.handleKeyDown)
  }

  public update(options: VisualUpdateOptions): void {
    this.notifyRenderingStarted(options)
    try {
      const dataView = options.dataViews?.[0]
      this.viewport = options.viewport
      this.settings = dataView
        ? this.formattingSettingsService.populateFormattingSettingsModel(ElectricalSettingsModel, dataView)
        : new ElectricalSettingsModel()
      const isDataUpdate = (options.type & DATA_UPDATE_FLAG) !== 0
      if (isDataUpdate && options.operationKind !== APPEND_OPERATION && options.operationKind !== SEGMENT_OPERATION) {
        this.rowLimitReached = false
      }

      if (isDataUpdate && dataView?.metadata.segment && !this.rowLimitReached) {
        if (this.host.fetchMoreData(true)) {
          this.loading = true
          // First segment: nothing has rendered yet, so show the rows received so far under the loading bar.
          if (this.table?.kind !== 'ready') this.readTable(dataView)
          this.render()
          this.notifyRenderingFinished(options)
          return
        }
        this.rowLimitReached = true
      }

      if (isDataUpdate || this.table === null) {
        this.readTable(dataView)
      }
      if (isDataUpdate) this.loading = false
      this.render()
      this.notifyRenderingFinished(options)
    } catch (error) {
      this.notifyRenderingFailed(options, error instanceof Error ? error.message : String(error))
      this.renderFailureState()
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings)
  }

  public destroy(): void {
    this.element.removeEventListener('contextmenu', this.handleContextMenu)
    this.element.removeEventListener('keydown', this.handleKeyDown)
    this.root.unmount()
  }

  private readTable(dataView: powerbi.DataView | undefined): void {
    this.table = readInspectionTable(dataView?.table)
    if (this.table.kind !== 'ready') {
      this.index = null
      this.filterSource = null
      return
    }
    const { rows, columns, optional } = this.table
    const today = new Date()
    this.index = buildInspectionIndex(rows, columns, today)
    this.filterSource = { rows, columns, optional, today }
  }

  /** flushSync does not re-throw React 19 render errors, so surface the one captured by onUncaughtError. */
  private commit(node: ReactNode): void {
    flushSync(() => {
      this.root.render(node)
    })
    if (this.renderError === null) return
    const error = this.renderError
    this.renderError = null
    throw error instanceof Error ? error : new Error(String(error))
  }

  private renderFailureState(): void {
    try {
      this.commit(
        createElement(StatusPanel, {
          icon: TriangleAlert,
          title: 'Could not draw the QCx Electrical visual',
          message: 'Check the bound columns, then refresh the report.',
          items: [],
        }),
      )
    } catch {
      // The failure has already been reported; there is nothing left to draw.
    }
  }

  private render(): void {
    const display = readDisplaySettings(this.settings)
    const theme = resolveTheme({
      preset: display.preset,
      backgroundColor: display.backgroundColor,
      backgroundOpacity: display.backgroundOpacity,
      cardOpacity: display.cardOpacity,
      highContrast: this.highContrastColors(),
    })
    this.applyTheme(theme)

    if (this.index === null || this.filterSource === null || this.table === null || this.table.kind === 'missing') {
      this.renderEmptyState(this.table?.kind === 'missing' ? this.table.missing : [])
      return
    }

    const index = this.index
    const footnotes = buildFootnotes(index, this.rowLimitReached)
    this.commit(
      createElement(InspectionDashboard, {
        title: 'QCx Electrical Inspections',
        icon: Zap,
        index,
        filterSource: this.filterSource,
        theme,
        interactive: this.interactionsAllowed(),
        animate: display.animate && !prefersReducedMotion(),
        describeCharts: display.describeCharts,
        loading: this.loading,
        footnotes,
        viewport: { width: this.viewport.width, height: this.viewport.height },
        onHover: this.handleTooltip,
      }),
    )
  }

  /** Setup state: tells the author which Smartsheet columns still need a field slot. */
  private renderEmptyState(missing: FieldSlot[]): void {
    this.commit(
      createElement(StatusPanel, {
        icon: ListChecks,
        title: 'Add the Electrical Inspection Log columns',
        message: 'Drag these columns from your Smartsheet table into the matching field slots.',
        items: missing.map((slot) => `${slot.column} → ${slot.slot}`),
      }),
    )
  }

  private applyTheme(theme: ResolvedTheme): void {
    for (const [name, value] of Object.entries(theme.cssVariables)) {
      this.element.style.setProperty(name, value)
    }
  }

  private highContrastColors(): HighContrastColors | null {
    const palette = this.host.colorPalette
    if (!palette.isHighContrast) return null
    return {
      foreground: palette.foreground.value,
      background: palette.background.value,
      foregroundSelected: palette.foregroundSelected.value,
    }
  }

  private interactionsAllowed(): boolean {
    return this.host.hostCapabilities?.allowInteractions !== false
  }

  private openContextMenu(x: number, y: number): void {
    if (!this.interactionsAllowed()) return
    const emptySelection = this.host.createSelectionIdBuilder().createSelectionId()
    void this.selectionManager.showContextMenu(emptySelection, { x, y })
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    this.openContextMenu(event.clientX, event.clientY)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const bounds = this.element.getBoundingClientRect()
    this.openContextMenu(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
  }

  private readonly handleTooltip = (request: TooltipRequest | null): void => {
    if (request === null) {
      this.host.tooltipService.hide({ immediately: true, isTouchEvent: false })
      return
    }
    const bounds = this.element.getBoundingClientRect()
    this.host.tooltipService.show({
      coordinates: [request.clientX - bounds.left, request.clientY - bounds.top],
      isTouchEvent: false,
      identities: [],
      dataItems: request.rows.map((row) => ({ displayName: row.label, value: row.value, header: request.title })),
    })
  }

  private notifyRenderingStarted(options: VisualUpdateOptions): void {
    this.host.eventService?.renderingStarted(options)
  }

  private notifyRenderingFinished(options: VisualUpdateOptions): void {
    this.host.eventService?.renderingFinished(options)
  }

  private notifyRenderingFailed(options: VisualUpdateOptions, reason: string): void {
    this.host.eventService?.renderingFailed(options, reason)
  }
}
