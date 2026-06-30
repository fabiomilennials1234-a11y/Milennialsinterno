import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EpicSelect, type EpicSelectOption } from './EpicSelect';

// Radix Select needs the jsdom pointer polyfills (same as EpicFormModal.test).
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const epics: EpicSelectOption[] = [
  { id: 'e1', projectId: 'p1', title: 'Checkout', key: 'AGS-1' },
  { id: 'e2', projectId: 'p1', title: 'Onboarding', key: 'AGS-2' },
  { id: 'e3', projectId: 'p2', title: 'Billing', key: 'KDEV-1' },
];

describe('EpicSelect', () => {
  it('lists only the epics of the current project', async () => {
    const user = userEvent.setup();
    render(<EpicSelect epics={epics} projectId="p1" value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox', { name: 'Epic' }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Checkout')).toBeInTheDocument();
    expect(within(listbox).getByText('Onboarding')).toBeInTheDocument();
    expect(within(listbox).queryByText('Billing')).not.toBeInTheDocument();
  });

  it('emits the epic id when an epic is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicSelect epics={epics} projectId="p1" value={null} onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Epic' }));
    await user.click(within(await screen.findByRole('listbox')).getByText('Onboarding'));
    expect(onChange).toHaveBeenCalledWith('e2');
  });

  it('emits null when "Sem epic" is picked (unlink)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicSelect epics={epics} projectId="p1" value="e2" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Epic' }));
    await user.click(within(await screen.findByRole('listbox')).getByText('Sem epic'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reflects the currently linked epic in the trigger', () => {
    render(<EpicSelect epics={epics} projectId="p1" value="e1" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Epic' })).toHaveTextContent('Checkout');
  });

  it('is disabled until a project is chosen', () => {
    render(<EpicSelect epics={epics} projectId={null} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Epic' })).toBeDisabled();
  });
});
