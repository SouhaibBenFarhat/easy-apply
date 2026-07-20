import { render, screen, userEvent } from '@test-utils'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './Select'

// happy-dom lacks pointer-capture and scrollIntoView APIs that Radix Select relies on.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

function renderSelect(): ReturnType<typeof render> {
  return render(
    <Select>
      <SelectTrigger aria-label="Job type">
        <SelectValue placeholder="Pick a type" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Types</SelectLabel>
          <SelectItem value="remote">Remote</SelectItem>
          <SelectItem value="hybrid">Hybrid</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>,
  )
}

describe('Select', () => {
  it('renders the trigger with the placeholder', () => {
    renderSelect()
    const trigger = screen.getByRole('combobox', { name: 'Job type' })
    expect(trigger).toHaveAttribute('type', 'button')
    expect(trigger).toHaveTextContent('Pick a type')
  })

  it('applies input-like styling classes to the trigger', () => {
    renderSelect()
    expect(screen.getByRole('combobox', { name: 'Job type' })).toHaveClass(
      'border-border',
      'bg-input',
    )
  })

  it('opens the listbox with items and label on click', async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Job type' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Remote' })).toBeInTheDocument()
    expect(screen.getByText('Types')).toHaveClass('label-caps')
  })

  it('selects an item and reflects it in the trigger', async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Job type' }))
    await user.click(await screen.findByRole('option', { name: 'Hybrid' }))
    expect(screen.getByRole('combobox', { name: 'Job type' })).toHaveTextContent('Hybrid')
  })
})
