import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { KpiCard } from './KpiCard'
import { Sparkline } from './Sparkline'
import type { OverviewCard, OverviewRow } from '../overview'

const SPARKLINE_WIDTH = 112
const SPARKLINE_HEIGHT = 28

/** One icon per card, in the row's card order. */
export type OverviewCardIcons = readonly [LucideIcon, LucideIcon, LucideIcon, LucideIcon]

/** A card's counts and its change on one line, joined the way the Inspection dashboard joins them. */
export function overviewCardDetail(card: OverviewCard): string {
  const parts = [card.subLine, card.deltaDisplay].filter((part): part is string => part !== null)
  return parts.join(' · ')
}

export interface OverviewKpiCardProps {
  card: OverviewCard
  icon: LucideIcon
}

export function OverviewKpiCard({ card, icon }: OverviewKpiCardProps): ReactElement {
  return (
    <KpiCard
      label={card.label}
      icon={icon}
      value={card.display}
      detail={overviewCardDetail(card)}
      tone={card.tone}
      trend={card.trend}
      isValueBad={card.isValueBad}
    />
  )
}

export interface OverviewDisciplineRowProps {
  name: string
  icon: LucideIcon
  /** What the sparkline plots, such as `Finals + SORs`; the row's label states its trend. */
  metric: string
  cardIcons: OverviewCardIcons
  row: OverviewRow
  sparklineColor: string
  /** The ring around the sparkline's selected point, usually the card colour. */
  ringColor: string
}

/** One discipline on the Overview: its name, four cards and a 30-week sparkline, or why the source is missing. */
export function OverviewDisciplineRow({
  name,
  icon: Icon,
  metric,
  cardIcons,
  row,
  sparklineColor,
  ringColor,
}: OverviewDisciplineRowProps): ReactElement {
  const label = (
    <div className="qaqc-overview-row-label">
      <span className="qaqc-overview-row-icon">
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="qaqc-overview-row-name">{name}</span>
    </div>
  )

  if (!row.connected) {
    return (
      <div className="qaqc-overview-row is-disconnected" role="group" aria-label={name}>
        {label}
        <p className="qaqc-overview-row-message">{row.message}</p>
      </div>
    )
  }

  return (
    <div className="qaqc-overview-row" role="group" aria-label={`${name}: ${metric} ${row.trendText}`}>
      {label}
      <div className="qaqc-overview-row-cards">
        {row.cards.map((card, at) => (
          <OverviewKpiCard key={card.label} card={card} icon={cardIcons[at]} />
        ))}
      </div>
      <div className="qaqc-overview-row-trend" aria-hidden="true">
        <span className="qaqc-overview-row-metric">{metric}</span>
        <Sparkline
          values={row.sparkline}
          markIndex={row.sparklineSelected}
          width={SPARKLINE_WIDTH}
          height={SPARKLINE_HEIGHT}
          color={sparklineColor}
          ringColor={ringColor}
        />
      </div>
    </div>
  )
}
