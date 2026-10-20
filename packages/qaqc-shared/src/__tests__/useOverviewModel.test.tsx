import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useOverviewModel, type OverviewParts } from '../hooks/useOverviewModel'
import type { CardMode, OverviewIndex } from '../overview'
import type { ViewState } from '../types'
import { inspection, overviewIndexOf, weld } from './overviewRows'
import { render, type Rendered } from './render'

const INDEX = overviewIndexOf([inspection('Electrical', "WW41'2026", 'Final'), weld("WW42'2026")])
const VIEW: ViewState = { selectedKey: 202642, windowEndKey: 202642, range: 'recent' }

let view: Rendered | null = null
const seen: OverviewParts[] = []

afterEach(() => {
  view?.unmount()
  view = null
  seen.length = 0
})

interface ProbeProps {
  index: OverviewIndex
  view: ViewState
  mode: CardMode
}

function Probe({ index, view: state, mode }: ProbeProps): ReactElement {
  seen.push(useOverviewModel(index, state, mode))
  return <span />
}

function last(): OverviewParts {
  const parts = seen[seen.length - 1]
  if (parts === undefined) throw new Error('hook not rendered')
  return parts
}

describe('useOverviewModel', () => {
  it('keeps the same chart series when only the card mode changes', () => {
    view = render(<Probe index={INDEX} view={VIEW} mode="week" />)
    const before = last()
    view.rerender(<Probe index={INDEX} view={VIEW} mode="toDate" />)
    const after = last()
    expect(after.series).toBe(before.series)
    expect(after.cards).not.toBe(before.cards)
  })

  it('rebuilds the chart series when the view changes', () => {
    view = render(<Probe index={INDEX} view={VIEW} mode="week" />)
    const before = last()
    view.rerender(<Probe index={INDEX} view={{ ...VIEW, range: 'all' }} mode="week" />)
    expect(last().series).not.toBe(before.series)
  })
})
