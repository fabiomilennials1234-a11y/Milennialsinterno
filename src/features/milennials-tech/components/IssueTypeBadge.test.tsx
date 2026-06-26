import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueTypeBadge } from './IssueTypeBadge';
import type { IssueType } from '../lib/issueSystem';

// Invariant (b): glyph per type is fixed (lucide). Lucide renders the icon as
// an <svg class="lucide lucide-<kebab>">, so we assert the glyph by its class.
const GLYPH_CLASS: Record<IssueType, string> = {
  STORY: 'lucide-bookmark',
  BUG: 'lucide-circle-dot',
  TASK: 'lucide-square-check',
};

const LABEL: Record<IssueType, string> = {
  STORY: 'Story',
  BUG: 'Bug',
  TASK: 'Task',
};

describe('IssueTypeBadge', () => {
  (['STORY', 'BUG', 'TASK'] as IssueType[]).forEach((type) => {
    it(`${type}: renders the canonical glyph`, () => {
      const { container } = render(<IssueTypeBadge type={type} />);
      expect(container.querySelector(`.${GLYPH_CLASS[type]}`)).toBeInTheDocument();
    });

    it(`${type}: full variant spells out the label`, () => {
      render(<IssueTypeBadge type={type} variant="full" />);
      expect(screen.getByText(LABEL[type])).toBeInTheDocument();
    });
  });

  it('renders the mono issue key when provided', () => {
    render(<IssueTypeBadge type="STORY" issueKey="AGS-12" />);
    expect(screen.getByText('AGS-12')).toBeInTheDocument();
  });

  it('exposes an accessible label for the glyph-only variant', () => {
    render(<IssueTypeBadge type="BUG" />);
    expect(screen.getByLabelText('Bug')).toBeInTheDocument();
  });
});
