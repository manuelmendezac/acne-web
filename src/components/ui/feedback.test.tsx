import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StudyModeBlocked } from './feedback';

/**
 * The pretest block is a critical component: it is what the physician sees instead of the
 * system's suggestion during observation O₁. It must read as intended behaviour of the study, not
 * as a malfunction, or the reviewer will "fix" it by working around the block.
 */
describe('StudyModeBlocked', () => {
  it('explains that the restriction belongs to the study phase', () => {
    render(<StudyModeBlocked />);

    expect(screen.getByText(/no disponible en esta fase/i)).toBeInTheDocument();
    expect(screen.getByText(/sin la evaluación asistida/i)).toBeInTheDocument();
    expect(screen.getByText(/RF-TR-01/)).toBeInTheDocument();
  });

  it('states that the block is enforced on the server, not only on screen', () => {
    render(<StudyModeBlocked />);
    expect(screen.getByText(/se aplica en el servidor/i)).toBeInTheDocument();
  });

  it('never names the technology to the clinician (RF-TR-01)', () => {
    const { container } = render(<StudyModeBlocked />);
    expect(container.textContent).not.toMatch(/\bIA\b|inteligencia artificial|modelo/i);
  });
});
