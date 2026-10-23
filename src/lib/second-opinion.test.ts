import { describe, expect, it } from 'vitest';

import { describeSecondOpinion, type SecondOpinionViewLike } from './second-opinion';

const SHOTS = [
  { key: 'general', label: 'Vista general', required: true },
  { key: 'perfil_derecho', label: 'Perfil derecho', required: true },
  { key: 'perfil_izquierdo', label: 'Perfil izquierdo', required: true },
];

const view = (
  imageId: string,
  shotKey: string,
  secondOpinion: SecondOpinionViewLike['inference']['secondOpinion'],
): SecondOpinionViewLike => ({ imageId, shotKey, inference: { secondOpinion } });

const acne = { label: 'acne' as const, conditions: [], explanation: 'Pápulas en mejilla.' };

describe('describeSecondOpinion', () => {
  it('says nothing when it was not consulted or agrees with acne', () => {
    expect(describeSecondOpinion(null, SHOTS)).toBeNull();
    expect(
      describeSecondOpinion(
        [view('a', 'general', null), view('b', 'perfil_derecho', acne)],
        SHOTS,
      ),
    ).toBeNull();
  });

  it('warns that a view may show vitiligo, without stopping the analysis', () => {
    // The real case: the local filter let a vitiligo close-up through and the models graded it.
    const notice = describeSecondOpinion(
      [
        view('a', 'general', acne),
        view('c', 'perfil_izquierdo', {
          label: 'otra_condicion',
          conditions: ['vitíligo'],
          explanation: 'Máculas acrómicas de bordes netos.',
        }),
      ],
      SHOTS,
    );
    expect(notice?.title).toBe('Verificación previa: posible vitíligo, no acné');
    expect(notice?.message).toMatch(/Una toma podría no mostrar acné y se graduó igualmente/);
    expect(notice?.findings).toEqual([
      {
        imageId: 'c',
        shot: 'Perfil izquierdo',
        headline: 'Vitíligo',
        explanation: 'Máculas acrómicas de bordes netos.',
        kind: 'otra',
        graded: true,
      },
    ]);
  });

  it('says the views were not graded when the second opinion stopped them', () => {
    // Every view stopped: the case has no suggestion, and the warning says why.
    const stopped = (imageId: string, shotKey: string): SecondOpinionViewLike => ({
      imageId,
      shotKey,
      inference: {
        verdict: 'no_acne',
        verdictSource: 'segunda_opinion',
        secondOpinion: { label: 'otra_condicion', conditions: ['vitíligo'], explanation: '' },
      },
    });
    const notice = describeSecondOpinion(
      [stopped('a', 'general'), stopped('b', 'perfil_derecho'), stopped('c', 'perfil_izquierdo')],
      SHOTS,
    );
    expect(notice?.title).toBe('Verificación previa: posible vitíligo, no acné');
    expect(notice?.message).toBe(
      '3 tomas no se graduaron: la escala IGA mide acné y no aplica a otra condición. ' +
        'El caso queda sin clase sugerida; el diagnóstico es del especialista.',
    );
    expect(notice?.findings.every((f) => !f.graded)).toBe(true);
  });

  it('says healthy skin plainly, and acne next to another condition as such', () => {
    const healthy = describeSecondOpinion(
      [view('a', 'general', { label: 'piel_sana', conditions: [], explanation: '' })],
      SHOTS,
    );
    expect(healthy?.title).toBe('Verificación previa: la piel parece sana, no acné');

    const both = describeSecondOpinion(
      [view('a', 'general', { label: 'acne', conditions: ['melasma'], explanation: '' })],
      SHOTS,
    );
    expect(both?.title).toBe('Verificación previa: además del acné se observa melasma');
    expect(both?.findings[0]?.headline).toBe('Acné con melasma');
  });

  it('keeps the same key for the same findings, whatever their order', () => {
    const a = view('a', 'general', { label: 'piel_sana', conditions: [], explanation: '' });
    const b = view('b', 'perfil_derecho', {
      label: 'otra_condicion',
      conditions: ['rosácea'],
      explanation: '',
    });
    expect(describeSecondOpinion([a, b], SHOTS)?.key).toBe(
      describeSecondOpinion([b, a], SHOTS)?.key,
    );
  });
});
