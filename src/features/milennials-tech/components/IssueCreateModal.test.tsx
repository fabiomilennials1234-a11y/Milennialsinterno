import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueCreateModal, type IssueCreatePayload } from './IssueCreateModal';
import type { EpicSelectOption } from './EpicSelect';
import type { ProjectOption, AssigneeOption } from './backlogTypes';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const projects: ProjectOption[] = [
  { id: 'p1', name: 'Agros', prefix: 'AGS' },
  { id: 'p2', name: 'KDev', prefix: 'KDEV' },
];
const assignees: AssigneeOption[] = [{ id: 'u1', name: 'Ana' }];
const epics: EpicSelectOption[] = [
  { id: 'e1', projectId: 'p1', title: 'Checkout', key: 'AGS-1' },
  { id: 'e3', projectId: 'p2', title: 'Billing', key: 'KDEV-1' },
];

function setup(props: Partial<React.ComponentProps<typeof IssueCreateModal>> = {}) {
  const onSubmit = vi.fn<(p: IssueCreatePayload) => void>();
  render(
    <IssueCreateModal
      open
      onOpenChange={vi.fn()}
      projects={projects}
      assignees={assignees}
      epics={epics}
      onSubmit={onSubmit}
      defaultProjectId="p1"
      {...props}
    />,
  );
  return { onSubmit };
}

describe('IssueCreateModal — epic link', () => {
  it('submits epicId null when no epic is chosen', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText('Título'), 'Issue solta');
    await user.click(screen.getByRole('button', { name: 'Criar issue' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ epicId: null }));
  });

  it('threads the chosen epic id into the submit payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText('Título'), 'Issue com epic');
    await user.click(screen.getByRole('combobox', { name: 'Epic' }));
    await user.click(within(await screen.findByRole('listbox')).getByText('Checkout'));
    await user.click(screen.getByRole('button', { name: 'Criar issue' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ epicId: 'e1' }));
  });

  it('clears a stale epic when the project changes (epics are project-scoped)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText('Título'), 'Troca de projeto');
    // Link an epic from p1...
    await user.click(screen.getByRole('combobox', { name: 'Epic' }));
    await user.click(within(await screen.findByRole('listbox')).getByText('Checkout'));
    // ...then switch the project to p2, which doesn't own that epic.
    await user.click(screen.getByRole('combobox', { name: 'Projeto' }));
    await user.click(within(await screen.findByRole('listbox')).getByText('KDev'));
    await user.click(screen.getByRole('button', { name: 'Criar issue' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p2', epicId: null }),
    );
  });
});
