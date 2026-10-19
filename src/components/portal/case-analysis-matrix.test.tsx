import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Catalogs } from '@/lib/use-catalogs';
import type { components } from '@/types/api-schema';

import { CaseAnalysisMatrix } from './case-analysis-matrix';

type CaseAnalysis = components['schemas']['CaseAnalysisDto'];

const catalogs = {
  iga: { labels: { leve: 'Leve', moderado: 'Moderado', severo: 'Severo' } },
  shots: {
    keys: [],
    definitions: [
      { key: 'general', label: 'Vista general', instruction: '', required: true },
      { key: 'perfil_derecho', label: 'Perfil derecho', instruction: '', required: true },
    ],
  },
} as unknown as Catalogs;

const member = (tag: string, igaClass: string, confidence: number, heat: string | null) => ({
  tag,
  modelName: tag,
  modelVersion: 'v',
  weightsChecksum: 'x',
  weight: 0.6,
  igaClass,
  confidence,
  classProbs: {},
  heatmapImageId: heat,
  latencyMs: 10,
});

const inference = (id: string, igaClass: string, confidence: number, members: unknown[]) => ({
  id,
  caseId: 'c',
  imageId: id,
  status: 'exitoso',
  igaClass,
  confidence,
  classProbs: { [igaClass]: confidence },
  gagsGrade: null,
  gagsScore: null,
  heatmapImageId: `heat-${id}`,
  latencyMs: 100,
  modelVersion: 'ensemble',
  modelBackend: 'torch',
  weightsChecksum: null,
  seed: 42,
  assessment: null,
  agreement: 'mayoria',
  members,
  errorMessage: null,
  createdAt: '2026-09-17T00:00:00Z',
});

const analysis = {
  igaClass: 'moderado',
  confidence: 0.44,
  classProbs: { moderado: 0.44, severo: 0.3, leve: 0.2 },
  agreement: 'mayoria',
  rule: 'mayoria',
  ruleDescription: '2 de las tomas coinciden en moderado (Vista general, Perfil derecho).',
  decidedBy: ['img-general'],
  range: { min: 'leve', max: 'severo' },
  completed: 2,
  pending: 0,
  failed: 0,
  views: [
    {
      imageId: 'img-general',
      shotKey: 'general',
      // Ensemble of the view = the surest member (yolov8s-cls, 0.49) taken whole.
      inference: inference('img-general', 'leve', 0.49, [
        member('yolov8s-cls', 'leve', 0.49, 'heat-y-general'),
        member('efficientnet_b2', 'severo', 0.41, null),
      ]),
    },
    {
      imageId: 'img-perfil',
      shotKey: 'perfil_derecho',
      inference: inference('img-perfil', 'moderado', 0.51, [
        member('yolov8s-cls', 'severo', 0.49, 'heat-y-perfil'),
        member('efficientnet_b2', 'moderado', 0.51, 'heat-e-perfil'),
      ]),
    },
  ],
} as unknown as CaseAnalysis;

describe('CaseAnalysisMatrix', () => {
  it('lays out views × models with the combined case row', () => {
    render(<CaseAnalysisMatrix analysis={analysis} catalogs={catalogs} />);
    expect(screen.getByText('Vista general')).toBeInTheDocument();
    expect(screen.getByText('Perfil derecho')).toBeInTheDocument();
    expect(screen.getByText('yolov8s-cls')).toBeInTheDocument();
    expect(screen.getByText('Caso')).toBeInTheDocument();
    expect(screen.getByText(/2 de las tomas coinciden/)).toBeInTheDocument();
    expect(screen.getByText(/Rango entre tomas: Leve – Severo/)).toBeInTheDocument();
    expect(screen.getByText('decide')).toBeInTheDocument();
    expect(screen.getByText('Acuerdo entre tomas: Mayoría')).toBeInTheDocument();
    // The case row names the combined class; cells disagreeing with it are amber.
    expect(screen.getAllByText('Moderado').at(-1)).toHaveClass('text-purple-900');
    expect(screen.getAllByText('Leve')[0]).toHaveClass('text-amber-700');
  });

  it('opens a model Grad-CAM for a view when asked', () => {
    const onSelect = vi.fn();
    render(
      <CaseAnalysisMatrix
        analysis={analysis}
        catalogs={catalogs}
        selectedHeatmap="heat-y-perfil"
        onSelectHeatmap={onSelect}
      />,
    );
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => !/cálculo/.test(b.textContent ?? ''));
    // Cells without a heatmap render no button (the EfficientNet cell of the general view).
    expect(buttons).toHaveLength(5);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ imageId: 'img-general' }),
      'heat-y-general',
    );
  });
});

describe('CaseAnalysisMatrix › ver cálculo', () => {
  it('unfolds every model vector and names the surest one as the pick', () => {
    render(<CaseAnalysisMatrix analysis={analysis} catalogs={catalogs} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'ver cálculo' })[0] as HTMLElement);
    expect(screen.getByText('F1 (desempate)')).toBeInTheDocument();
    expect(screen.getByText('gana')).toBeInTheDocument();
    expect(screen.queryByText(/promedia columna a columna/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          (node?.textContent ?? '').includes(
            'Gana yolov8s-cls con 49.0 % en Leve; efficientnet_b2 estaba al 41.0 % en Severo.',
          ),
        { selector: 'p' },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ocultar cálculo' })).toBeInTheDocument();
  });
});

describe('CaseAnalysisMatrix › usar esta lectura', () => {
  it('offers «usar» on every cell and reports the chosen view and model', () => {
    const onChoose = vi.fn();
    render(<CaseAnalysisMatrix analysis={analysis} catalogs={catalogs} onChoose={onChoose} />);
    const buttons = screen.getAllByRole('button', { name: 'usar' });
    // 2 views × (2 members + ensemble) = 6 cells.
    expect(buttons).toHaveLength(6);
    fireEvent.click(buttons[1] as HTMLElement); // general · efficientnet_b2
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ imageId: 'img-general' }),
      'efficientnet_b2',
    );
    fireEvent.click(buttons[2] as HTMLElement); // general · ensemble
    expect(onChoose).toHaveBeenLastCalledWith(expect.objectContaining({ imageId: 'img-general' }), null);
  });

  it('marks the chosen cell and lets the clinician go back to the rule', () => {
    const onClear = vi.fn();
    const chosen = {
      ...analysis,
      rule: 'seleccion_manual',
      ruleDescription: 'Lectura elegida por Téc. Rosa: Perfil derecho (efficientnet_b2) → moderado.',
      selection: {
        inferenceId: 'img-perfil',
        imageId: 'img-perfil',
        shotKey: 'perfil_derecho',
        memberTag: 'efficientnet_b2',
        igaClass: 'moderado',
        confidence: 0.51,
        reason: null,
        chosenByName: 'Téc. Rosa',
        chosenAt: '2026-09-18T00:00:00Z',
        active: true,
      },
    } as unknown as CaseAnalysis;
    render(
      <CaseAnalysisMatrix analysis={chosen} catalogs={catalogs} onChoose={vi.fn()} onClearChoice={onClear} />,
    );
    expect(screen.getByText('elegida')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'usar' })).toHaveLength(5);
    expect(screen.getByText(/Lectura elegida por Téc. Rosa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la regla automática' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('warns when the stored choice no longer applies', () => {
    const stale = {
      ...analysis,
      selection: {
        inferenceId: 'old', imageId: '', shotKey: null, memberTag: null, igaClass: null,
        confidence: null, reason: null, chosenByName: null, chosenAt: '2026-09-18T00:00:00Z', active: false,
      },
    } as unknown as CaseAnalysis;
    render(<CaseAnalysisMatrix analysis={stale} catalogs={catalogs} onChoose={vi.fn()} />);
    expect(screen.getByText(/ya no está vigente/)).toBeInTheDocument();
  });
});
