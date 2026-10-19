import { describe, expect, it } from 'vitest';

import {
  PORTALS,
  PORTAL_LIST,
  hasSection,
  mayOpen,
  pageTitleFor,
  portalForRole,
  portalFromPathname,
  portalHref,
} from './portals';

/**
 * The portal split IS the role boundary now, so these are not cosmetic tests.
 *
 * The API refuses every route by role regardless, but a menu or a guard that disagrees with it
 * turns a boundary into what looks like a broken product — which is exactly the failure the split
 * was meant to remove.
 */
describe('portales', () => {
  it('da a cada rol exactamente un portal', () => {
    expect(portalForRole('admin')?.slug).toBe('admin');
    expect(portalForRole('dermatologo')?.slug).toBe('dermatologo');
    expect(portalForRole('tecnico')?.slug).toBe('tecnico');

    // Los roles retirados en la reestructuración ya no llevan a ningún sitio.
    expect(portalForRole('residente')).toBeNull();
    expect(portalForRole('evaluador_estadistico')).toBeNull();
    expect(portalForRole(null)).toBeNull();
  });

  it('no reparte un mismo rol entre dos portales', () => {
    const roles = PORTAL_LIST.map((portal) => portal.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('deriva el portal desde la ruta y vuelve a null fuera de ellos', () => {
    expect(portalFromPathname('/admin/usuarios')?.slug).toBe('admin');
    expect(portalFromPathname('/tecnico')?.slug).toBe('tecnico');
    expect(portalFromPathname('/login')).toBeNull();
    expect(portalFromPathname('/captura/abc123')).toBeNull();
    expect(portalFromPathname('/')).toBeNull();
  });

  it('construye enlaces sin duplicar la barra de la raíz', () => {
    expect(portalHref('admin')).toBe('/admin');
    expect(portalHref('admin', '/')).toBe('/admin');
    expect(portalHref('dermatologo', '/casos')).toBe('/dermatologo/casos');
  });
});

describe('mayOpen', () => {
  it('deja entrar a las secciones que el portal declara', () => {
    expect(mayOpen(PORTALS.admin, '/admin')).toBe(true);
    expect(mayOpen(PORTALS.admin, '/admin/usuarios')).toBe(true);
    expect(mayOpen(PORTALS.tecnico, '/tecnico/casos')).toBe(true);
  });

  it('cierra las secciones que el portal no tiene', () => {
    // El técnico no participa de la evidencia del estudio: ni indicadores ni contrastes.
    expect(mayOpen(PORTALS.tecnico, '/tecnico/indicadores')).toBe(false);
    expect(mayOpen(PORTALS.tecnico, '/tecnico/jornada')).toBe(true);
    expect(mayOpen(PORTALS.tecnico, '/tecnico/estadistica')).toBe(false);
    expect(mayOpen(PORTALS.tecnico, '/tecnico/usuarios')).toBe(false);
    // El dermatólogo es el SUJETO de la medición, no su lector: desde que el pretest es la
    // evaluación manual de la clínica, indicadores, contrastes y anexos son del administrador.
    expect(mayOpen(PORTALS.dermatologo, '/dermatologo/indicadores')).toBe(false);
    expect(mayOpen(PORTALS.dermatologo, '/dermatologo/estadistica')).toBe(false);
    expect(mayOpen(PORTALS.dermatologo, '/dermatologo/anexos')).toBe(false);
    expect(mayOpen(PORTALS.dermatologo, '/dermatologo/usuarios')).toBe(false);
    // El administrador no rellena instrumentos que miden al profesional bajo estudio.
    expect(mayOpen(PORTALS.admin, '/admin/jornada')).toBe(false);
    expect(mayOpen(PORTALS.admin, '/admin/encuesta')).toBe(false);
  });

  it('no confunde un portal con otro', () => {
    expect(mayOpen(PORTALS.admin, '/tecnico/casos')).toBe(false);
    expect(mayOpen(PORTALS.tecnico, '/admin')).toBe(false);
  });

  it('no deja que la entrada raíz abra cualquier subruta', () => {
    // La entrada `/` del menú coincide por prefijo con TODO el portal. Escrita de la forma
    // ingenua dejaría entrar al técnico a `/tecnico/estadistica` por la puerta del resumen.
    expect(mayOpen(PORTALS.tecnico, '/tecnico/cualquier-cosa')).toBe(false);
  });

  it('permite las subrutas declaradas como título extra', () => {
    expect(mayOpen(PORTALS.admin, '/admin/usuarios/nuevo')).toBe(true);
    expect(mayOpen(PORTALS.tecnico, '/tecnico/perfil')).toBe(true);
    expect(mayOpen(PORTALS.tecnico, '/tecnico/casos/nuevo')).toBe(true);
  });

  it('acepta el detalle de un recurso por el prefijo de su sección', () => {
    const detail = '/admin/usuarios/8a7b6c5d-0000-4000-8000-000000000001';
    expect(mayOpen(PORTALS.admin, detail)).toBe(true);
  });
});

describe('pageTitleFor', () => {
  it('titula por la sección más específica y no por el resumen', () => {
    expect(pageTitleFor(PORTALS.admin, '/admin')).toBe('Resumen');
    expect(pageTitleFor(PORTALS.admin, '/admin/usuarios')).toBe('Usuarios');
    expect(pageTitleFor(PORTALS.dermatologo, '/dermatologo/casos')).toBe('Casos');
  });

  it('prefiere el título declarado al de la sección que la contiene', () => {
    expect(pageTitleFor(PORTALS.admin, '/admin/usuarios/nuevo')).toBe('Nuevo usuario');
    expect(pageTitleFor(PORTALS.tecnico, '/tecnico/casos/nuevo')).toBe('Nuevo caso');
  });

  it('titula el detalle por su sección y no por el identificador', () => {
    expect(pageTitleFor(PORTALS.admin, '/admin/usuarios/8a7b6c5d-0000-4000-8000-000000000001')).toBe(
      'Usuarios',
    );
  });
});

describe('hasSection', () => {
  /**
   * El resumen es una sola pantalla para los tres portales y decide qué bloques pinta con esto.
   * Antes de la separación mostraba todo a todos: al mostrador se le ofrecían la cobertura de
   * objetivos, los cuatro reportes de la tesis y un enlace a un panel de auditoría que su portal no
   * tiene. Cada una de esas llamadas responde 403 para un técnico.
   */
  it('reconoce las secciones que el portal declara', () => {
    expect(hasSection(PORTALS.admin, '/indicadores')).toBe(true);
    expect(hasSection(PORTALS.admin, '/auditoria')).toBe(true);
    expect(hasSection(PORTALS.dermatologo, '/encuesta')).toBe(true);
    expect(hasSection(PORTALS.tecnico, '/casos')).toBe(true);
  });

  it('el portal de admisión no LEE evidencia del estudio', () => {
    for (const path of ['/indicadores', '/estadistica', '/anexos', '/auditoria']) {
      expect(hasSection(PORTALS.tecnico, path)).toBe(false);
    }
  });

  it('pero sí PRODUCE la suya: jornada y encuesta', () => {
    // Opera el sistema tanto como el especialista, así que su satisfacción cuenta para OE3 y su
    // jornada registra su propio trabajo. Su NCR cuenta pacientes admitidos, no diagnósticos, y
    // por eso `pairedTcad` filtra por rol antes de contrastar OE4.
    expect(hasSection(PORTALS.tecnico, '/encuesta')).toBe(true);
    expect(hasSection(PORTALS.tecnico, '/jornada')).toBe(true);
  });

  it('el administrador no rellena instrumentos que miden al profesional', () => {
    expect(hasSection(PORTALS.admin, '/jornada')).toBe(false);
    expect(hasSection(PORTALS.admin, '/encuesta')).toBe(false);
  });

  it('el dermatólogo produce evidencia pero no la lee', () => {
    // Darle sus propias cifras mientras las produce invita a que el número influya en el trabajo
    // que ese mismo número está midiendo.
    expect(hasSection(PORTALS.dermatologo, '/encuesta')).toBe(true);
    expect(hasSection(PORTALS.dermatologo, '/jornada')).toBe(true);
    expect(hasSection(PORTALS.dermatologo, '/indicadores')).toBe(false);
    expect(hasSection(PORTALS.dermatologo, '/estadistica')).toBe(false);
    expect(hasSection(PORTALS.dermatologo, '/anexos')).toBe(false);
    expect(hasSection(PORTALS.dermatologo, '/auditoria')).toBe(false);
  });

  it('solo el administrador lee indicadores, contrastes y anexos', () => {
    for (const path of ['/indicadores', '/estadistica', '/anexos', '/auditoria']) {
      expect(hasSection(PORTALS.admin, path)).toBe(true);
    }
  });

  it('no confunde una subruta con la sección que la contiene', () => {
    // `hasSection` compara la ruta EXACTA declarada en el menú; `/usuarios/nuevo` es un título
    // extra, no una sección, y tratarlo como tal haría aparecer tarjetas donde no van.
    expect(hasSection(PORTALS.admin, '/usuarios/nuevo')).toBe(false);
    expect(hasSection(PORTALS.admin, '/usuarios')).toBe(true);
  });
});
