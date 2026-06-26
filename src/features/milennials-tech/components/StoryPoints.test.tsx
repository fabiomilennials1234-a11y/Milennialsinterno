import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoryPoints } from './StoryPoints';
import { FIBONACCI } from '../lib/issueSystem';

describe('StoryPoints', () => {
  it('renders each Fibonacci estimate value', () => {
    FIBONACCI.forEach((value) => {
      const { unmount } = render(<StoryPoints points={value} />);
      expect(screen.getByText(String(value))).toBeInTheDocument();
      unmount();
    });
  });

  it('uses singular/plural label correctly', () => {
    const { rerender } = render(<StoryPoints points={1} />);
    expect(screen.getByLabelText('1 ponto')).toBeInTheDocument();
    rerender(<StoryPoints points={5} />);
    expect(screen.getByLabelText('5 pontos')).toBeInTheDocument();
  });

  it('renders nothing for unestimated (null) by default', () => {
    const { container } = render(<StoryPoints points={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for undefined by default', () => {
    const { container } = render(<StoryPoints points={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a faint dash when unestimated and emptyAs="dash"', () => {
    render(<StoryPoints points={null} emptyAs="dash" />);
    expect(screen.getByLabelText('Sem estimativa')).toBeInTheDocument();
  });
});
