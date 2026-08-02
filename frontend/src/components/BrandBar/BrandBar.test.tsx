import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandBar } from './BrandBar'

describe('BrandBar', () => {
  it('renders the time2map mark and the "Barcelona livability map" h1', () => {
    render(<BrandBar />)
    expect(screen.getByAltText('time2map')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Barcelona livability map' }),
    ).toBeInTheDocument()
  })

  it('links the mark to time2map.com', () => {
    render(<BrandBar />)
    const link = screen.getByRole('link', { name: /time2map/i })
    expect(link).toHaveAttribute('href', 'https://time2map.com')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
