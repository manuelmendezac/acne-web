import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CaseAdminActions } from './case-admin-actions';

/**
 * What the person must read BEFORE confirming: whether the case will be erased or annulled, and
 * which evidence forces the annulment. The API decides; the screen only has to say it.
 */
let detail: Record<string, unknown>;

vi.mock('@/lib/use-api', () => ({
  useApi: (path: string | null) => ({
    data: path === '/cases/case-1' ? detail : [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAction: (fn: (...args: unknown[]) => unknown) => ({
    run: fn,
    pending: false,
    error: null,
    reset: vi.fn(),
  }),
  useDebouncedValue: (value: unknown) => value,
}));

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ mode: 'eliminar', evidence: [], caseCode: 'ACN-1' }) },
}));

describe('CaseAdminActions', () => {
  beforeEach(() => {
    detail = {
      id: 'case-1',
      caseCode: 'ACN-2026-0001',
      patientId: 'patient-1',
      patientCode: 'PAC-1',
      patientName: 'Paciente de prueba',
      assignedUserId: null,
      notes: null,
      voidedAt: null,
      removal: { mode: 'eliminar', evidence: [] },
    };
  });

  it('offers to delete a case with no evidence, and says photographs go with it', async () => {
    const user = userEvent.setup();
    render(<CaseAdminActions caseId="case-1" onRemoved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Eliminar caso/ }));

    expect(screen.getByText(/junto con sus fotografías/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eliminar el caso' })).toBeTruthy();
  });

  it('offers to annul — not delete — a case with evidence, naming it', async () => {
    detail = { ...detail, removal: { mode: 'anular', evidence: ['1 diagnóstico'] } };
    const user = userEvent.setup();
    render(<CaseAdminActions caseId="case-1" onRemoved={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Eliminar caso/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Anular caso/ }));

    expect(screen.getByText(/1 diagnóstico/)).toBeTruthy();
  });

  it('shows nothing for a case already annulled', () => {
    detail = { ...detail, voidedAt: '2026-10-25T20:00:00Z' };
    const { container } = render(<CaseAdminActions caseId="case-1" onRemoved={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });
});
