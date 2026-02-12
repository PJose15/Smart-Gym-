import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Page from '../page'

describe('Dashboard Page', () => {
    it('renders dashboard heading', () => {
        render(<Page />)
        const heading = screen.getByRole('heading', { level: 1, name: /dashboard/i })
        expect(heading).toBeInTheDocument()
    })

    it('renders statistic cards', () => {
        render(<Page />)
        expect(screen.getByText(/total machines/i)).toBeInTheDocument()
        expect(screen.getByText(/active programs/i)).toBeInTheDocument()
        expect(screen.getByText(/members/i)).toBeInTheDocument()
        expect(screen.getByText(/sessions today/i)).toBeInTheDocument()
    })
})
