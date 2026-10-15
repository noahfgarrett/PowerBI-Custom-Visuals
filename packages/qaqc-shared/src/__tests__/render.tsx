import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

export interface Rendered {
  container: HTMLDivElement
  rerender: (node: ReactNode) => void
  unmount: () => void
}

export function render(node: ReactNode): Rendered {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return {
    container,
    rerender(next: ReactNode): void {
      act(() => {
        root.render(next)
      })
    },
    unmount(): void {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}
