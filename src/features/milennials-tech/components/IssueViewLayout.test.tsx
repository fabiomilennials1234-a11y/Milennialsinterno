import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  IssueViewLayout,
  IssueViewSidebarSection,
  IssueViewSidebarField,
} from './IssueViewLayout';

describe('IssueViewLayout', () => {
  it('renders with minimal props (main + sidebar)', () => {
    render(<IssueViewLayout main={<p>narrativa</p>} sidebar={<p>meta</p>} />);
    expect(screen.getByText('narrativa')).toBeInTheDocument();
    expect(screen.getByText('meta')).toBeInTheDocument();
  });

  it('renders the optional header slot', () => {
    render(
      <IssueViewLayout
        header={<h1>AGS-12 · Board view</h1>}
        main={<p>main</p>}
        sidebar={<p>side</p>}
      />,
    );
    expect(screen.getByText('AGS-12 · Board view')).toBeInTheDocument();
  });

  it('composes sidebar sections and fields', () => {
    render(
      <IssueViewLayout
        main={<p>main</p>}
        sidebar={
          <IssueViewSidebarSection title="Detalhes">
            <IssueViewSidebarField label="Status">
              <span>Em progresso</span>
            </IssueViewSidebarField>
          </IssueViewSidebarSection>
        }
      />,
    );
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Em progresso')).toBeInTheDocument();
  });
});
