import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandBar } from './BrandBar'

describe('BrandBar', () => {
  it('renders the brand mark and the "time2map livability" wordmark', () => {
    render(<BrandBar />)
    expect(screen.getByAltText('time2map')).toBeInTheDocument()
    expect(screen.getByText('time2map')).toBeInTheDocument()
    expect(screen.getByText('livability')).toBeInTheDocument()
  })

  it('makes the time2map part a link to time2map.com', () => {
    render(<BrandBar />)
    const link = screen.getByRole('link', { name: /time2map/i })
    expect(link).toHaveAttribute('href', 'https://time2map.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toContainElement(screen.getByText('time2map'))
  })
})
