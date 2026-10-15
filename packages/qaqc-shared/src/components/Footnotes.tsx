import { Info } from 'lucide-react'
import type { ReactElement } from 'react'

export function Footnotes({ notes }: { notes: string[] }): ReactElement | null {
  if (notes.length === 0) return null
  return (
    <ul className="qaqc-footnotes">
      {notes.map((note) => (
        <li key={note}>
          <Info size={12} aria-hidden="true" />
          {note}
        </li>
      ))}
    </ul>
  )
}
