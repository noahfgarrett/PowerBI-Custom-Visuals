import { describe, expect, it } from 'vitest'

import { render } from './render'

describe('test harness', () => {
  it('renders React components into jsdom', () => {
    const view = render(<p className="probe">ready</p>)
    expect(view.container.querySelector('.probe')?.textContent).toBe('ready')
    view.unmount()
  })
})
