import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

export interface StatusPanelProps {
  icon: LucideIcon
  title: string
  message: string
  items: string[]
}

export function StatusPanel({ icon: Icon, title, message, items }: StatusPanelProps): ReactElement {
  return (
    <section className="qaqc-status" role="status" aria-label={title}>
      <span className="qaqc-status-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
