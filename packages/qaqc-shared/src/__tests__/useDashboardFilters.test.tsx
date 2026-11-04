import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DashboardFilters, FilterSourceNote } from '../hooks/useDashboardFilters'
import { NOT_RECORDED_LABEL, type Row } from '../rowFilters'
import { makeWorkWeek } from '../workWeeks'
import {
  BUILDING_FIELD,
  badge,
  buttonNamed,
  checkbox,
  checkboxLabels,
  chipTexts,
  choose,
  click,
  CURRENT_KEY,
  DEFAULTED_FIELDS,
  filterButton,
  FilterHarness,
  type HarnessProps,
  openMenu,
  pick,
  PLAIN_FIELDS,
  ROWS,
  showing,
  STATUS_FIELD,
  toggleSection,
  typeInto,
  WEEKS,
} from './filterHarness'
import { render, type Rendered } from './render'

let view: Rendered | null = null
let filters: DashboardFilters | null = null

afterEach(() => {
  view?.unmount()
  view = null
  filters = null
})

function harness(props: HarnessProps = {}): ReactElement {
  return <FilterHarness onFilters={(next) => { filters = next }} {...props} />
}

function mount(props: HarnessProps = {}): HTMLDivElement {
  view = render(harness(props))
  return view.container
}

function current(): DashboardFilters {
  if (filters === null) throw new Error('hook did not render')
  return filters
}

function chipRemove(container: Element, index: number): HTMLButtonElement {
  const button = container.querySelectorAll<HTMLButtonElement>('.qaqc-filter-chip button')[index]
  if (button === undefined) throw new Error(`no chip ${index}`)
  return button
}

function fromSelect(container: Element): HTMLSelectElement {
  return pick(container, '.qaqc-filter-date select', HTMLSelectElement)
}

function toSelect(container: Element): HTMLSelectElement {
  const select = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')[1]
  if (select === undefined) throw new Error('To missing')
  return select
}

describe('useDashboardFilters', () => {
  describe('with nothing set', () => {
    it('filteredRows is the same rows reference and nothing is active', () => {
      mount()
      expect(current().filteredRows).toBe(ROWS)
      expect(current().isAnyActive).toBe(false)
      expect(current().isFieldFilterActive).toBe(false)
      expect(current().dateRange).toBeNull()
    })

    it('shows no chips', () => {
      const container = mount()
      expect(container.querySelector('.qaqc-filter-chips')).toBeNull()
    })
  })

  describe('ticking values', () => {
    it('ticking a value applies immediately and updates Showing X of Y rows', () => {
      const container = mount()
      openMenu(container)
      expect(showing(container)).toBe('Showing 6 of 6 rows')
      click(checkbox(container, 'F63.1'))
      expect(checkbox(container, 'F63.1').checked).toBe(true)
      expect(current().filteredRows).toEqual([ROWS[0], ROWS[3], ROWS[5]])
      expect(showing(container)).toBe('Showing 3 of 6 rows')
    })

    it('values are OR within a field and AND across fields', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      click(checkbox(container, 'F63.2'))
      expect(showing(container)).toBe('Showing 5 of 6 rows')
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      expect(current().filteredRows).toEqual([ROWS[1], ROWS[5]])
    })

    it('unticking the last value of a plain field means no filter on it', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      click(checkbox(container, 'F63.1'))
      expect(current().isFieldFilterActive).toBe(false)
      expect(current().filteredRows).toBe(ROWS)
    })
  })

  describe('the badge', () => {
    it('shows a count badge of active groups; date range counts as one', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      click(checkbox(container, 'F63.2'))
      expect(badge(container)).toBe('1')
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      expect(badge(container)).toBe('2')
      click(buttonNamed(container, 'Last 4 WW'))
      expect(badge(container)).toBe('3')
    })
  })

  describe('a field with a default', () => {
    it('default-only selection shows no badge and no chip', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      expect(checkbox(container, 'LotusWorks').checked).toBe(true)
      expect(badge(container)).toBeNull()
      expect(chipTexts(container)).toEqual([])
    })

    it('default-only selection leaves filteredRows the same rows reference but counts the default in Showing', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      expect(current().isFieldFilterActive).toBe(false)
      expect(current().isAnyActive).toBe(false)
      expect(current().filteredRows).toBe(ROWS)
      expect(showing(container)).toBe('Showing 3 of 6 rows')
    })

    it('ticking another value adds to the default', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(checkbox(container, 'Greyfox'))
      expect(checkbox(container, 'LotusWorks').checked).toBe(true)
      expect(current().isFieldFilterActive).toBe(true)
      expect(showing(container)).toBe('Showing 4 of 6 rows')
    })

    it('unticking every value on a default field returns to the default', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(checkbox(container, 'Greyfox'))
      click(checkbox(container, 'LotusWorks'))
      expect(checkbox(container, 'LotusWorks').checked).toBe(false)
      expect(showing(container)).toBe('Showing 1 of 6 rows')
      click(checkbox(container, 'Greyfox'))
      expect(checkbox(container, 'LotusWorks').checked).toBe(true)
      expect(checkbox(container, 'Greyfox').checked).toBe(false)
      expect(current().isFieldFilterActive).toBe(false)
      expect(badge(container)).toBeNull()
    })

    it('unticking the default alone keeps it ticked', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(checkbox(container, 'LotusWorks'))
      expect(checkbox(container, 'LotusWorks').checked).toBe(true)
      expect(current().isFieldFilterActive).toBe(false)
    })

    it('Select all ticks every value on a field with hasSelectAll', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(buttonNamed(container, 'Select all'))
      for (const label of ['LotusWorks', 'Greyfox', 'Bayside', NOT_RECORDED_LABEL]) {
        expect(checkbox(container, label).checked).toBe(true)
      }
      expect(showing(container)).toBe('Showing 6 of 6 rows')
      expect(badge(container)).toBe('1')
    })

    it('offers Select all only on a field with hasSelectAll', () => {
      const container = mount()
      openMenu(container)
      expect(() => buttonNamed(container, 'Select all')).toThrow()
    })
  })

  describe('Clear all', () => {
    it('Clear all restores defaults and clears the range', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(checkbox(container, 'Greyfox'))
      click(buttonNamed(container, 'Last 4 WW'))
      expect(current().isAnyActive).toBe(true)
      click(buttonNamed(pick(container, '.qaqc-filter-footer', HTMLElement), 'Clear all'))
      expect(current().isAnyActive).toBe(false)
      expect(current().dateRange).toBeNull()
      expect(checkbox(container, 'LotusWorks').checked).toBe(true)
      expect(checkbox(container, 'Greyfox').checked).toBe(false)
      expect(showing(container)).toBe('Showing 3 of 6 rows')
    })

    it('Clear all clears the search boxes', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      typeInto(pick(container, '.qaqc-filter-search input', HTMLInputElement), 'F63.2')
      click(buttonNamed(pick(container, '.qaqc-filter-footer', HTMLElement), 'Clear all'))
      expect(pick(container, '.qaqc-filter-search input', HTMLInputElement).value).toBe('')
      expect(checkboxLabels(container)).toEqual(['F63.1', 'F63.2', 'Unspecified'])
    })
  })

  describe('search', () => {
    it("search narrows a field's list; counts come from unfiltered rows", () => {
      const container = mount()
      openMenu(container)
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      typeInto(pick(container, '.qaqc-filter-search input', HTMLInputElement), 'f63.2')
      expect(checkboxLabels(container).filter((label) => label.startsWith('F63') || label === 'Unspecified')).toEqual(['F63.2'])
      // Three rows are Closed, one of them in F63.2; the count still says all F63.2 rows.
      expect(checkbox(container, 'F63.2').getAttribute('aria-label')).toBe('F63.2, 2 rows')
    })

    it('says so when a search matches nothing', () => {
      const container = mount()
      openMenu(container)
      typeInto(pick(container, '.qaqc-filter-search input', HTMLInputElement), 'zzz')
      expect(checkboxLabels(container)).toEqual([])
      expect(container.querySelector('.qaqc-filter-no-match')?.textContent).toBe('No matching values')
    })

    it('forgets the search when the menu closes', () => {
      const container = mount()
      openMenu(container)
      typeInto(pick(container, '.qaqc-filter-search input', HTMLInputElement), 'F63.2')
      click(filterButton(container))
      openMenu(container)
      expect(pick(container, '.qaqc-filter-search input', HTMLInputElement).value).toBe('')
    })
  })

  describe('chips', () => {
    it('chips list values by label; removing a chip clears only that group', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      click(checkbox(container, 'Unspecified'))
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      expect(chipTexts(container)).toEqual(['Building: F63.1, Unspecified', 'Status: Closed'])
      click(chipRemove(container, 0))
      expect(chipTexts(container)).toEqual(['Status: Closed'])
      expect(current().filteredRows).toEqual([ROWS[1], ROWS[4], ROWS[5]])
    })

    it('a date range chip names its weeks and removing it clears the range', () => {
      const container = mount()
      openMenu(container)
      click(buttonNamed(container, 'Last 4 WW'))
      expect(chipTexts(container)).toEqual(["Date range: WW42'2026 to WW45'2026"])
      click(chipRemove(container, 0))
      expect(current().dateRange).toBeNull()
      expect(chipTexts(container)).toEqual([])
    })

    it('a chip on a default field lists the default first, and removing it returns to the default', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(checkbox(container, 'Bayside'))
      expect(chipTexts(container)).toEqual(['Created By (Company): LotusWorks, Bayside'])
      click(chipRemove(container, 0))
      expect(chipTexts(container)).toEqual([])
      expect(checkbox(container, 'LotusWorks').checked).toBe(true)
      expect(checkbox(container, 'Bayside').checked).toBe(false)
    })

    it('shortens a long list and keeps every value in the title', () => {
      const container = mount({ fields: DEFAULTED_FIELDS })
      openMenu(container)
      click(buttonNamed(container, 'Select all'))
      expect(chipTexts(container)).toEqual(['Created By (Company): LotusWorks, Bayside, Greyfox +1'])
      expect(pick(container, '.qaqc-filter-chip', HTMLElement).title)
        .toBe(`Created By (Company): LotusWorks, Bayside, Greyfox, ${NOT_RECORDED_LABEL}`)
    })

    it('Clear all in the chips clears everything and returns focus to the button', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      click(buttonNamed(pick(container, '.qaqc-filter-chips', HTMLElement), 'Clear all'))
      expect(current().isAnyActive).toBe(false)
      expect(document.activeElement).toBe(filterButton(container))
    })

    it('removing a chip moves focus to the next chip, or to the button after the last', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      click(chipRemove(container, 0))
      expect(document.activeElement).toBe(chipRemove(container, 0))
      click(chipRemove(container, 0))
      expect(document.activeElement).toBe(filterButton(container))
    })

    it('names each remove button after its group', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      expect(chipRemove(container, 0).getAttribute('aria-label')).toBe('Remove Building filter')
    })
  })

  describe('notes', () => {
    const NOTES: readonly FilterSourceNote[] = [{ message: "Welding isn't filtered by Status", whenFieldActive: ['status'] }]

    it('a note shows only while its field is active', () => {
      const container = mount({ notes: NOTES })
      const noteTexts = (): (string | null)[] => [...container.querySelectorAll('.qaqc-filter-note')].map((node) => node.textContent)
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      expect(noteTexts()).toEqual([])
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      expect(noteTexts()).toEqual(["Welding isn't filtered by Status"])
      click(checkbox(container, 'Closed'))
      expect(noteTexts()).toEqual([])
    })
  })

  describe('new rows', () => {
    const REFRESHED: readonly Row[] = [
      ['LotusWorks', 'F63.2', 'Open'],
      ['Greyfox', 'F63.2', 'Closed'],
      ['Larch', '', 'Open'],
    ]

    it('selection survives new rows, dropping vanished values', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      click(checkbox(container, 'F63.2'))
      view?.rerender(harness({ rows: REFRESHED }))
      expect(chipTexts(container)).toEqual(['Building: F63.2'])
      expect(checkbox(container, 'F63.2').checked).toBe(true)
      expect(current().filteredRows).toEqual([REFRESHED[0], REFRESHED[1]])
      expect(showing(container)).toBe('Showing 2 of 3 rows')
    })

    it('a field emptied by new rows means no filter, not no rows', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      view?.rerender(harness({ rows: REFRESHED }))
      expect(current().isFieldFilterActive).toBe(false)
      expect(current().filteredRows).toBe(REFRESHED)
      expect(badge(container)).toBeNull()
      expect(chipTexts(container)).toEqual([])
    })

    it('updates counts when rows change with the menu open', () => {
      const container = mount()
      openMenu(container)
      view?.rerender(harness({ rows: REFRESHED }))
      expect(checkbox(container, 'F63.2').getAttribute('aria-label')).toBe('F63.2, 2 rows')
      expect(showing(container)).toBe('Showing 3 of 3 rows')
    })

    it('a selection held through a partial load applies again once the rest arrives', () => {
      const container = mount()
      openMenu(container)
      click(checkbox(container, 'F63.1'))
      view?.rerender(harness({ rows: REFRESHED }))
      view?.rerender(harness({ rows: ROWS }))
      expect(chipTexts(container)).toEqual(['Building: F63.1'])
    })

    it('a field that leaves the menu keeps its selection for when it returns, while another is changed', () => {
      const container = mount()
      openMenu(container)
      toggleSection(container, 'Status')
      click(checkbox(container, 'Closed'))
      view?.rerender(harness({ fields: [BUILDING_FIELD] }))
      expect(current().isFieldFilterActive).toBe(false)
      click(checkbox(container, 'F63.1'))
      view?.rerender(harness({ fields: PLAIN_FIELDS }))
      expect(chipTexts(container)).toEqual(['Building: F63.1', 'Status: Closed'])
    })

    it('clamps a date range to weeks still in the data', () => {
      const container = mount()
      openMenu(container)
      click(buttonNamed(container, 'Last 4 WW'))
      const fewer = WEEKS.filter((week) => week.key <= 202643)
      view?.rerender(harness({ weeks: fewer }))
      expect(current().dateRange).toEqual({ fromKey: 202642, toKey: 202643 })
      expect(chipTexts(container)).toEqual(["Date range: WW42'2026 to WW43'2026"])
    })

    it('stays off when a full range was chosen and a later refresh adds a week', () => {
      const container = mount()
      openMenu(container)
      choose(fromSelect(container), 202640)
      choose(fromSelect(container), 202630)
      expect(current().dateRange).toBeNull()
      view?.rerender(harness({ weeks: [...WEEKS, makeWorkWeek(2026, 46)], currentKey: 202646 }))
      expect(current().dateRange).toBeNull()
      expect(current().isAnyActive).toBe(false)
      expect(badge(container)).toBeNull()
    })

    it('keeps a partial range as chosen when a later refresh adds a week', () => {
      const container = mount()
      openMenu(container)
      choose(fromSelect(container), 202640)
      view?.rerender(harness({ weeks: [...WEEKS, makeWorkWeek(2026, 46)], currentKey: 202646 }))
      expect(current().dateRange).toEqual({ fromKey: 202640, toKey: CURRENT_KEY })
    })

    it('a date range drops out when the clamped range covers all the weeks', () => {
      const container = mount()
      openMenu(container)
      click(buttonNamed(container, 'Last 4 WW'))
      view?.rerender(harness({ weeks: WEEKS.filter((week) => week.key >= 202642) }))
      expect(current().dateRange).toBeNull()
      expect(badge(container)).toBeNull()
    })
  })

  describe('date range', () => {
    it('From and To list the full weeks, newest first, marking the limits', () => {
      const container = mount()
      openMenu(container)
      const fromOptions = [...fromSelect(container).options].map((option) => option.textContent)
      expect(fromOptions).toHaveLength(WEEKS.length)
      expect(fromOptions[0]).toBe("WW45'2026")
      expect(fromOptions[fromOptions.length - 1]).toBe("WW30'2026 (start)")
      const toOptions = [...toSelect(container).options].map((option) => option.textContent)
      expect(toOptions).toHaveLength(WEEKS.length)
      expect(toOptions[0]).toBe("WW45'2026 (now)")
      expect(toOptions[toOptions.length - 1]).toBe("WW30'2026")
    })

    it('From and To show the data limits with no range', () => {
      const container = mount()
      openMenu(container)
      expect(fromSelect(container).value).toBe('202630')
      expect(toSelect(container).value).toBe(String(CURRENT_KEY))
    })

    it('presets set From and To', () => {
      const container = mount()
      openMenu(container)
      click(buttonNamed(container, 'Last 4 WW'))
      expect(current().dateRange).toEqual({ fromKey: 202642, toKey: CURRENT_KEY })
      expect(fromSelect(container).value).toBe('202642')
      expect(toSelect(container).value).toBe(String(CURRENT_KEY))
      click(buttonNamed(container, 'Last 13 WW'))
      expect(current().dateRange).toEqual({ fromKey: 202633, toKey: CURRENT_KEY })
    })

    it('marks the preset in force and clears it when clicked again', () => {
      const container = mount()
      openMenu(container)
      const preset = buttonNamed(container, 'Last 4 WW')
      expect(preset.getAttribute('aria-pressed')).toBe('false')
      click(preset)
      expect(preset.getAttribute('aria-pressed')).toBe('true')
      click(preset)
      expect(preset.getAttribute('aria-pressed')).toBe('false')
      expect(current().dateRange).toBeNull()
    })

    it('This year covers the current year from its first data week', () => {
      const weeks = [makeWorkWeek(2025, 50), makeWorkWeek(2026, 1), makeWorkWeek(2026, 2)]
      const container = mount({ weeks, currentKey: 202602 })
      openMenu(container)
      click(buttonNamed(container, 'This year'))
      expect(current().dateRange).toEqual({ fromKey: 202601, toKey: 202602 })
    })

    it('a range equal to all weeks is not active', () => {
      const container = mount()
      openMenu(container)
      choose(fromSelect(container), 202640)
      expect(current().dateRange).toEqual({ fromKey: 202640, toKey: CURRENT_KEY })
      expect(current().isAnyActive).toBe(true)
      choose(fromSelect(container), 202630)
      expect(current().dateRange).toBeNull()
      expect(current().isAnyActive).toBe(false)
      expect(badge(container)).toBeNull()
    })

    it('a date range does not change the rows', () => {
      const container = mount()
      openMenu(container)
      click(buttonNamed(container, 'Last 4 WW'))
      expect(current().filteredRows).toBe(ROWS)
      expect(current().isFieldFilterActive).toBe(false)
      expect(current().isAnyActive).toBe(true)
    })

    it('From cannot pass To, nor To pass From', () => {
      const container = mount()
      openMenu(container)
      choose(toSelect(container), 202640)
      const isOffered = (select: HTMLSelectElement, key: number): boolean =>
        [...select.options].some((option) => option.value === String(key) && !option.disabled)
      expect(isOffered(fromSelect(container), 202641)).toBe(false)
      expect(isOffered(fromSelect(container), 202640)).toBe(true)
      choose(fromSelect(container), 202635)
      expect(isOffered(toSelect(container), 202634)).toBe(false)
      expect(isOffered(toSelect(container), 202635)).toBe(true)
    })

    it('survives having no weeks', () => {
      const container = mount({ weeks: [] })
      openMenu(container)
      expect(current().dateRange).toBeNull()
      expect(fromSelect(container).disabled).toBe(true)
      expect(toSelect(container).disabled).toBe(true)
    })
  })

  describe('the range toggle', () => {
    it('is disabled by isRangeDisabled, leaving the week picker enabled', () => {
      const container = mount({ isRangeDisabled: true })
      const toggles = [...container.querySelectorAll<HTMLButtonElement>('.qaqc-segmented button')]
      expect(toggles.every((button) => button.disabled)).toBe(true)
      expect(pick(container, '.qaqc-week-picker select', HTMLSelectElement).disabled).toBe(false)
    })
  })

  it('reads a field with no values without failing', () => {
    const container = mount({ rows: [], fields: [STATUS_FIELD] })
    openMenu(container)
    expect(checkboxLabels(container)).toEqual([])
    expect(showing(container)).toBe('Showing 0 of 0 rows')
  })
})

describe('useDashboardFilters with rowWeekKey', () => {
  /** Column 3 holds the week key; a row without one has no readable week. */
  const WEEK_ROWS: readonly Row[] = [
    ['LotusWorks', 'F63.1', 'Open', 202632],
    ['LotusWorks', 'F63.2', 'Closed', 202640],
    ['Greyfox', 'F63.1', 'Open', 202640],
    ['Bayside', 'F63.1', 'Closed', null],
  ]
  const rowWeekKey = (row: Row): number | null => (typeof row[3] === 'number' ? row[3] : null)

  it('counts rows with no readable week while no range is set', () => {
    const container = mount({ rows: WEEK_ROWS, rowWeekKey })
    openMenu(container)
    expect(showing(container)).toBe('Showing 4 of 4 rows')
  })

  it('narrows Showing to rows in the range, keeping every row in the total', () => {
    const container = mount({ rows: WEEK_ROWS, rowWeekKey })
    openMenu(container)
    choose(fromSelect(container), 202635)
    expect(showing(container)).toBe('Showing 2 of 4 rows')
  })

  it('applies the range on top of the field filters', () => {
    const container = mount({ rows: WEEK_ROWS, rowWeekKey })
    openMenu(container)
    click(checkbox(container, 'F63.1'))
    expect(showing(container)).toBe('Showing 3 of 4 rows')
    choose(fromSelect(container), 202635)
    expect(showing(container)).toBe('Showing 1 of 4 rows')
  })

  it('leaves Showing alone in a range when no reader is given', () => {
    const container = mount({ rows: WEEK_ROWS })
    openMenu(container)
    choose(fromSelect(container), 202635)
    expect(showing(container)).toBe('Showing 4 of 4 rows')
  })
})

describe('FilterChips when interactions are not allowed', () => {
  it('disables each remove button and Clear all', () => {
    const container = mount({ fields: PLAIN_FIELDS })
    openMenu(container)
    click(checkbox(container, 'F63.1'))
    view?.rerender(harness({ fields: PLAIN_FIELDS, interactive: false }))
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.qaqc-filter-chips button')]
    expect(buttons.map((button) => button.disabled)).toEqual([true, true])
    click(buttons[0])
    expect(chipTexts(container)).toEqual(['Building: F63.1'])
  })
})
