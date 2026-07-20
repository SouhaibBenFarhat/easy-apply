import { render, screen, userEvent } from '@test-utils'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog'

function renderDialog(): void {
  render(
    <Dialog>
      <DialogTrigger>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button">Cancel</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  )
}

describe('Dialog', () => {
  it('is closed until the trigger is clicked', async () => {
    renderDialog()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders title, description and close button when open', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }))

    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('closes when the close button is clicked', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
