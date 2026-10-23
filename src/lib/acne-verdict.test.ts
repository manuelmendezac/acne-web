import { describe, expect, it } from 'vitest';

import { describeNoAcne, type NoAcneAnalysisLike } from './acne-verdict';

const SHOTS = [
  { key: 'general', label: 'Vista general', required: true },
  { key: 'perfil_derecho', label: 'Perfil derecho', required: true },
  { key: 'perfil_izquierdo', label: 'Perfil izquierdo', required: true },
];

const VIEWS = [
  { imageId: 'a', shotKey: 'general' },
  { imageId: 'b', shotKey: 'perfil_derecho' },
  { imageId: 'c', shotKey: 'perfil_izquierdo' },
];

const analysis = (overrides: Partial<NoAcneAnalysisLike>): NoAcneAnalysisLike => ({
  verdict: 'acne',
  noAcneViews: [],
  views: VIEWS,
  ...overrides,
});

describe('describeNoAcne', () => {
  it('leaves the views the second opinion stopped to its own, more specific warning', () => {
    const views = VIEWS.map((v) => ({ ...v, inference: { verdictSource: 'segunda_opinion' as const } }));
    expect(
      describeNoAcne(analysis({ verdict: 'no_acne', noAcneViews: ['a', 'b', 'c'], views }), SHOTS),
    ).toBeNull();
  });

  it('says nothing when every view shows acne', () => {
    expect(describeNoAcne(analysis({}), SHOTS)).toBeNull();
    expect(describeNoAcne(null, SHOTS)).toBeNull();
  });

  it('says nothing for healthy skin: it is a reading (sin lesiones), not an incongruence', () => {
    expect(describeNoAcne(analysis({ verdict: 'piel_sana' }), SHOTS)).toBeNull();
  });

  it('warns of an incongruence when no view shows acne', () => {
    const notice = describeNoAcne(
      analysis({ verdict: 'no_acne', noAcneViews: ['a', 'b', 'c'] }),
      SHOTS,
    );
    expect(notice?.scope).toBe('all');
    expect(notice?.title).toMatch(/Incongruencia/);
    expect(notice?.message).toMatch(/no hay grado IGA sugerido/);
  });

  it('names the views left out when only some show no acne', () => {
    const notice = describeNoAcne(analysis({ noAcneViews: ['b'] }), SHOTS);
    expect(notice?.scope).toBe('some');
    expect(notice?.message).toMatch(/«Perfil derecho» no muestra acné ni piel sana/);
  });

  it('keeps the same key for the same flagged views, whatever their order', () => {
    const first = describeNoAcne(analysis({ noAcneViews: ['b', 'c'] }), SHOTS);
    const second = describeNoAcne(analysis({ noAcneViews: ['c', 'b'] }), SHOTS);
    expect(first?.key).toBe(second?.key);
  });
});
