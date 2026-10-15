import { ListChecks } from 'lucide-react'
import type powerbi from 'powerbi-visuals-api'
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

import type { TooltipRequest } from '../../qaqc-shared/src/chartTypes'
import { StatusPanel } from '../../qaqc-shared/src/components/StatusPanel'
import { buildFootnotes } from '../../qaqc-shared/src/footnotes'
import { buildInspectionIndex } from '../../qaqc-shared/src/inspections'
import { resolveTheme, type HighContrastColors, type ResolvedTheme } from '../../qaqc-shared/src/theme'
import type { InspectionIndex } from '../../qaqc-shared/src/types'
import { readInspectionTable, type FieldSlot, type TableReadResult } from './dataView'
import { ElectricalDashboard } from './ElectricalDashboard'
import { ElectricalSettingsModel, readDisplaySettings } from './settings'

type VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions
type VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type IVisualHost = powerbi.extensibility.visual.IVisualHost

// powerbi.VisualUpdateType.Data and powerbi.VisualDataChangeOperationKind.Create.
// The API package has no runtime enums, so the const enum values are spelled out.
const DATA_UPDATE_FLAG = 2
const CREATE_OPERATION = 0

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
  private loading = false
  private rowLimitReached = false
  private viewport: powerbi.IViewport = { width: 0, height: 0 }

  constructor(options: VisualConstructorOptions) {
    this.host = options.host
    this.element = options.element
    this.element.classList.add('qaqc-host')
    this.element.setAttribute('role', 'region')
    this.element.setAttribute('aria-label', 'Electrical inspections dashboard')
    this.selectionManager = this.host.createSelectionManager()
    this.formattingSettingsService = new FormattingSettingsService(this.host.createLocalizationManager())
    this.root = createRoot(this.element)
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
      if (options.operationKind === CREATE_OPERATION) this.rowLimitReached = false

      if (dataView?.metadata.segment && !this.rowLimitReached) {
        if (this.host.fetchMoreData(true)) {
          this.loading = true
          // First segment: nothing has rendered yet, so show the rows received so far under the loading bar.
          if (this.table === null) this.readTable(dataView)
          this.render()
          this.notifyRenderingFinished(options)
          return
        }
        this.rowLimitReached = true
      }

      const isDataUpdate = (options.type & DATA_UPDATE_FLAG) !== 0
      if (isDataUpdate || this.table === null) {
        this.readTable(dataView)
      }
      this.loading = false
      this.render()
      this.notifyRenderingFinished(options)
    } catch (error) {
      this.notifyRenderingFailed(options, error instanceof Error ? error.message : String(error))
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
    this.table = readInspectionTable(dataView)
    this.index = this.table.kind === 'ready'
      ? buildInspectionIndex(this.table.rows, this.table.columns, new Date())
      : null
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

    if (this.index === null || this.table === null || this.table.kind === 'missing') {
      this.renderEmptyState(this.table?.kind === 'missing' ? this.table.missing : [])
      return
    }

    const index = this.index
    const footnotes = buildFootnotes(index, this.rowLimitReached)
    flushSync(() => {
      this.root.render(
        createElement(ElectricalDashboard, {
          index,
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
    })
  }

  /** Setup state: tells the author which Smartsheet columns still need a field slot. */
  private renderEmptyState(missing: FieldSlot[]): void {
    flushSync(() => {
      this.root.render(
        createElement(StatusPanel, {
          icon: ListChecks,
          title: 'Add the Electrical Inspection Log columns',
          message: 'Drag these columns from your Smartsheet table into the matching field slots.',
          items: missing.map((slot) => `${slot.column} → ${slot.slot}`),
        }),
      )
    })
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
