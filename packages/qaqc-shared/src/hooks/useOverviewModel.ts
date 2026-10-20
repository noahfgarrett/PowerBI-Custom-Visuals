import { useMemo } from 'react'

import { buildOverviewCards, buildOverviewSeries, type CardMode, type OverviewCardsModel, type OverviewIndex, type OverviewSeries } from '../overview'
import type { ViewState } from '../types'

export interface OverviewParts {
  cards: OverviewCardsModel
  series: OverviewSeries
}

/** The Overview's cards and chart series, memoised apart so a card mode switch never rebuilds the series. */
export function useOverviewModel(index: OverviewIndex, view: ViewState, mode: CardMode): OverviewParts {
  const series = useMemo(() => buildOverviewSeries(index, view), [index, view])
  const cards = useMemo(() => buildOverviewCards(index, view, mode), [index, view, mode])
  return { cards, series }
}
