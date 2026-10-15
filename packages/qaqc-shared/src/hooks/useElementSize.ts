import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/**
 * Measures an element; ResizeObserver callbacks are coalesced to one update per animation frame.
 * The measured element must be rendered on the first render, because the observer attaches once.
 */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = (): void => {
      const rect = element.getBoundingClientRect()
      const next = { width: Math.floor(rect.width), height: Math.floor(rect.height) }
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  return [ref, size]
}
