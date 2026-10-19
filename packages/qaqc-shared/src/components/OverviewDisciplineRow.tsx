import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { KpiCard, TREND_ICONS } from './KpiCard'
import { Sparkline } from './Sparkline'
import type { OverviewCard, OverviewRow } from '../overview'

const SPARKLINE_WIDTH = 100
const SPARKLINE_HEIGHT = 28
/** Dense rows are about 34 px tall, so their sparkline is shorter. */
const DENSE_SPARKLINE_HEIGHT = 22

/** One icon per card, in the row's card order. */
export type OverviewCardIcons = readonly [LucideIcon, LucideIcon, LucideIcon, LucideIcon]

/** A card's counts and its change on one line, joined the way the Inspection dashboard joins them. */
export function overviewCardDetail(card: OverviewCard): string {
  const parts = [card.subLine, card.deltaDisplay].filter((part): part is string => part !== null)
  return parts.join(' · ')
}

/** What a card says to screen readers and in its tooltip, as `KpiCard` words it. */
function overviewCardSummary(card: OverviewCard): string {
  const summary = `${card.label}: ${card.display}. ${overviewCardDetail(card)}`
  return card.isValueBad ? `${summary}. Below target` : summary
}

export interface OverviewKpiCardProps {
  card: OverviewCard
  icon: LucideIcon
  /** Puts the counts and the change on two lines instead of joining them. */
  isTwoLine?: boolean
}

export function OverviewKpiCard({ card, icon, isTwoLine = false }: OverviewKpiCardProps): ReactElement {
  const { subLine, deltaDisplay } = card
  const hasTwoLines = isTwoLine && subLine !== null && deltaDisplay !== null
  return (
    <KpiCard
      label={card.label}
      icon={icon}
      value={card.display}
      context={hasTwoLines ? subLine : undefined}
      detail={hasTwoLines ? deltaDisplay : overviewCardDetail(card)}
      tone={card.tone}
      trend={card.trend}
      isValueBad={card.isValueBad}
      valueTitle={card.valueTitle}
    />
  )
}

export interface OverviewDenseValueProps {
  card: OverviewCard
}

/** A card on a short tile: its label over its value and a tone-coloured trend arrow; the detail is in the label and tooltip. */
export function OverviewDenseValue({ card }: OverviewDenseValueProps): ReactElement {
  const TrendIcon = card.trend === 'none' ? null : TREND_ICONS[card.trend]
  const summary = overviewCardSummary(card)
  return (
    <article className="qaqc-overview-value" aria-label={summary} title={summary}>
      <span className="qaqc-overview-value-label">{card.label}</span>
      <span className="qaqc-overview-value-line">
        <strong className={card.isValueBad ? 'qaqc-overview-value-number is-bad' : 'qaqc-overview-value-number'}>{card.display}</strong>
        {TrendIcon && (
          <span className={`qaqc-overview-value-trend is-${card.tone}`}>
            <TrendIcon size={12} aria-hidden="true" />
          </span>
        )}
      </span>
    </article>
  )
}

export interface OverviewRowLabelProps {
  name: string
  icon: LucideIcon
}

/** A row's icon and name, shared by the discipline rows and the dense quality strip. */
export function OverviewRowLabel({ name, icon: Icon }: OverviewRowLabelProps): ReactElement {
  return (
    <div className="qaqc-overview-row-label">
      <span className="qaqc-overview-row-icon">
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="qaqc-overview-row-name">{name}</span>
    </div>
  )
}

export interface OverviewDisciplineRowProps {
  name: string
  icon: LucideIcon
  /** What the sparkline plots, such as `Finals + SORs`; the row's label states its trend. */
  metric: string
  cardIcons: OverviewCardIcons
  row: OverviewRow
  /** Short tiles: dense values instead of cards, and no metric caption over the sparkline. */
  isDense: boolean
  sparklineColor: string
  /** The ring around the sparkline's selected point, usually the card colour. */
  ringColor: string
}

/** One discipline on the Overview: its name, four cards and a 30-week sparkline, or why the source is missing. */
export function OverviewDisciplineRow({
  name,
  icon,
  metric,
  cardIcons,
  row,
  isDense,
  sparklineColor,
  ringColor,
}: OverviewDisciplineRowProps): ReactElement {
  const rowClass = isDense ? 'qaqc-overview-row is-dense' : 'qaqc-overview-row'
  const label = <OverviewRowLabel name={name} icon={icon} />

  if (!row.connected) {
    return (
      <div className={`${rowClass} is-disconnected`} role="group" aria-label={name}>
        {label}
        <p className="qaqc-overview-row-message">{row.message}</p>
      </div>
    )
  }

  return (
    <div className={rowClass} role="group" aria-label={`${name}: ${metric} ${row.trendText}`}>
      {label}
      <div className="qaqc-overview-row-cards">
        {row.cards.map((card, at) =>
          isDense ? <OverviewDenseValue key={card.label} card={card} /> : <OverviewKpiCard key={card.label} card={card} icon={cardIcons[at]} />,
        )}
      </div>
      <div className="qaqc-overview-row-trend" aria-hidden="true">
        {!isDense && <span className="qaqc-overview-row-metric">{metric}</span>}
        <Sparkline
          values={row.sparkline}
          markIndex={row.sparklineSelected}
          width={SPARKLINE_WIDTH}
          height={isDense ? DENSE_SPARKLINE_HEIGHT : SPARKLINE_HEIGHT}
          color={sparklineColor}
          ringColor={ringColor}
        />
      </div>
    </div>
  )
}
