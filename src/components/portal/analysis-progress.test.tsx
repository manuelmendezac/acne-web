import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalysisProgress } from './analysis-progress';

describe('AnalysisProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the queue stage and counts the seconds', () => {
    render(<AnalysisProgress status="pendiente" />);
    expect(screen.getByText(/En cola/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5200);
    });
    expect(screen.getByText('5 s')).toBeInTheDocument();
  });

  it('advances the bar with time but never fills it', () => {
    const { container } = render(<AnalysisProgress status="ejecutando" expectedSeconds={10} />);
    const bar = () => container.querySelector('div[style]') as HTMLDivElement;
    expect(parseFloat(bar().style.width)).toBeLessThanOrEqual(4);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const width = parseFloat(bar().style.width);
    expect(width).toBeGreaterThan(80);
    expect(width).toBeLessThan(100);
    expect(screen.getByText(/Analizando las tomas/)).toBeInTheDocument();
  });
});
