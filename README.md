# acne-web

**Dermatrix** — portal del personal (administración, consulta y admisión) del prototipo de
diagnóstico asistido de acné — **Tesis UNT 2026**.

Next.js 14 (App Router) · TypeScript estricto · Tailwind CSS v4 · Recharts

---

## Contexto

Soporta la tesis **«Agilización del proceso de diagnóstico de acné mediante inteligencia
artificial en un centro especializado en dermatología»** (Universidad Nacional de Trujillo, 2026).

**El paciente nunca opera el sistema**: todo lo hace el personal del centro. La raíz del sitio es
el inicio de sesión y cada cuenta entra a su portal según el rol:

| Ruta | Experiencia |
|---|---|
| `/` | Redirige a `/login` |
| `/admin/**` | Portal del administrador: pacientes, casos, indicadores, estadística, anexos, usuarios y auditoría |
| `/dermatologo/**` | Portal de consulta: pacientes e historia clínica, casos, anamnesis, diagnóstico cronometrado, jornada, encuesta |
| `/tecnico/**` | Portal de admisión: pacientes, alta de caso, anamnesis y código QR de captura. Nada del análisis del estudio |
| `/captura/<token>` | Captura de fotografías desde el teléfono del personal, abierta con el código QR de la ficha del caso. Sin sesión |

Hasta el 19/10/2026 existió además una presentación en `/` y una PWA del paciente en `/app/**`;
ambas se retiraron porque el paciente no usa el sistema por su cuenta. Un enlace al portal ajeno redirige al propio en silencio: quien lo abrió no hizo nada
mal, y una pantalla de error solo le enseñaría que el sistema es poco fiable.

> **Aviso:** Herramienta de apoyo diagnóstico con fines de investigación académica. No sustituye el
> juicio clínico del profesional médico. Prototipo académico UNT — no certificado como dispositivo
> médico.

---

## Levantamiento en menos de 10 minutos

Requiere **Node 20+**, **pnpm** y `acne-api` levantado en el puerto 3001.

```bash
pnpm install
cp .env.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:3001/api

pnpm generate:api-types             # genera el cliente tipado desde el OpenAPI de acne-api
pnpm dev                            # http://localhost:3000
```

Entre en <http://localhost:3000/login> con una de las cuentas que imprimió
`pnpm seed:admin` en `acne-api`.

---

## Dos reglas que gobiernan este proyecto

### 1. Tailwind-only, verificado por CI

Regla dura, **más estricta que la Sección 12.3** del documento maestro: aquel admite las tres
directivas `@tailwind` más las variables del tema en `:root`/`.dark`; en este proyecto
`globals.css` no lleva nada de eso.

```css
/* src/app/globals.css — el archivo completo */
@import "tailwindcss";
```

Una línea. Hasta el 05/09/2026 había una segunda, `@custom-variant dark`, que ataba la variante
`dark:` a una clase para que un conmutador manual pudiera imponerse sobre la media query del
sistema operativo. La interfaz es **solo clara** desde entonces, así que la variante y el
conmutador desaparecieron junto con 653 clases `dark:` repartidas por 55 ficheros.

- **No hay tema propio ni variables CSS.** Los componentes usan la paleta que trae Tailwind
  (`bg-white`, `text-neutral-900`, `bg-purple-900`…). No existe `tailwind.config.ts`: Tailwind v4
  detecta el contenido por su cuenta.
- **No hay ningún otro archivo de estilos.** Prohibidos `.css`/`.scss`/`.module.css` adicionales,
  `@apply`, `@layer components`, `@theme`, `@font-face` y cualquier selector.
- Los patrones repetidos se abstraen como componentes React (`<Button variant="primary">`,
  `<Card>`), nunca como clases CSS, usando `class-variance-authority`.
- Composición con `cn()` = `clsx` + `tailwind-merge`. Iconos de `lucide-react`. Fuentes Inter y
  Poppins vía `next/font`, aplicadas como valor arbitrario —
  `font-[family-name:var(--font-poppins)]` — para no necesitar configuración.
- **Color de la condición experimental:** `neutral` para pretest (sin IA) y `violet` para postest
  (con IA), de forma consistente en todo el portal. El profesional nunca debe dudar de bajo qué
  condición está registrando. El gris del pretest no es un descuido: pretest es la condición **sin**
  la herramienta, y darle un color de marca sugeriría que es una variante de lo mismo y no su
  ausencia.

```bash
pnpm lint:css
```

`scripts/check-no-custom-css.mjs` exige que `globals.css` contenga **exactamente** esa línea y
nada más, y que no exista ningún otro CSS. Falla con un mensaje concreto y está conectado al CI.

### Paleta

Un solo modo, **claro**, y un solo acento:

| Rol | Color | Dónde |
|---|---|---|
| Marca | `purple` | Botones primarios, enlaces, elemento activo del menú, anillos de foco, insignia de postest, clase sugerida |
| Acuerdo / meta cumplida | `emerald` | Diagonal de la matriz de confusión, insignias de meta |
| Error / aviso | `red` · `amber` | Fuera de la diagonal, alertas |
| Todo lo demás | `neutral` | Superficies, texto, bordes, la barra lateral oscura (`neutral-950`) y la serie **pretest** |

La evaluación asistida **no tiene un color propio**: hasta el 19/10/2026 todo lo que tocaba el
modelo iba en `violet`, lo que la hacía destacar como «la parte de IA» de una pantalla clínica.
Ahora usa el morado de la marca como cualquier otra acción del sistema; `violet` solo sobrevive como
hexadecimal en la serie postest de los gráficos.

Verde, rojo y ámbar son **semánticos y no siguen a la marca**: verde significa acertado y rojo
equivocado, y repintarlos costaría la única lectura para la que existe una matriz de confusión.

**Tipografía:** Inter en todos los pesos. Título de página `text-xl font-semibold tracking-tight`
(`PageHeader`), títulos de tarjeta `text-sm font-semibold`, etiquetas `text-xs text-neutral-500`;
no hay tamaños arbitrarios (`text-[10px]`, `text-[11px]`). Tarjetas `rounded-xl` con `shadow-xs`;
sin degradados.

Los gráficos de Recharts se estilan por props y atributos SVG, no por clases, así que su paleta se
repite como literales hexadecimales con la clase que representan anotada al lado. Esa anotación es
lo único que impide que el gráfico y el portal que lo rodea se separen.

### 2. Cero tipos escritos a mano

```bash
pnpm generate:api-types
```

`openapi-typescript` genera `src/types/api-schema.d.ts` desde el documento OpenAPI de `acne-api`.
Las páginas derivan sus tipos de ahí:

```ts
type Dashboard = GetResult<'/indicators/dashboard'>;
type CaseSummary = GetResult<'/cases'>[number];
```

Si el backend cambia un campo, `pnpm typecheck` falla aquí. El archivo generado **se versiona**,
de modo que el CI compila sin necesidad de levantar la API.

Lo que OpenAPI no puede generar son los **valores**: las etiquetas en español, los 8 ítems Likert
verbatim, las fórmulas y metas de los indicadores. Eso llega por `GET /meta/catalogs`
(`useCatalogs`), así que el cuestionario validado existe una sola vez en todo el sistema.

---

## Estructura de navegación

Barra lateral fija y colapsable, con las secciones agrupadas por cómo se trabaja realmente el
estudio:

| Grupo | Secciones | Objetivo |
|---|---|---|
| — | Resumen | Estado general |
| **Clínico** | Casos · Jornada | OE1 · OE2 · OE4 |
| **Análisis** | Indicadores · Estadística | OE1–OE4 · OG |
| **Instrumentos** | Anexos · Encuesta | OE1 · OE2 · OE3 · OE4 |
| **Sistema** | Auditoría | RNF-04 · RF-TR-04 |

- Colapsa a un carril de iconos; la preferencia se recuerda. Los iconos conservan su `title`,
  porque un carril sin forma de recuperar el significado es una trampa para un usuario ocasional
  — que es exactamente lo que es un jurado de tesis.
- En móvil se abre como cajón, siempre expandido.
- La barra superior queda con lo que debe verse en toda pantalla: dónde estás, **bajo qué
  condición experimental estás registrando** y quién eres.

`src/lib/portals.ts` es la definición única de los tres portales: qué secciones tiene cada uno, en
qué orden y con qué título. El sider la renderiza, la barra superior deriva de ella el título y el
armazón (`components/portal/portal-shell`) decide con ella si una ruta es alcanzable, así que una
sección no puede quedar etiquetada de una forma en el menú y de otra en la cabecera, ni ser
accesible por un marcador guardado desde el portal que no la tiene.

Hasta la reestructuración del 05/09/2026 había **un** portal en `/portal` cuyo menú se filtraba por
rol. Funcionaba, y escondía un problema real: cada pantalla había que leerla dos veces —como la ve
el dermatólogo y como la ve el técnico— y nadie podía señalar el sistema y decir en qué consiste el
trabajo de un técnico. Tres rutas convierten la frontera en un hecho de la URL en vez de en una
condición de tiempo de ejecución, que es además lo que la tesis tiene que describir.

## Decisiones de interfaz que protegen el experimento

- **El cronómetro es invisible.** Abrir un caso hace `POST /cases/:id/open`, que sella `t₀` en el
  servidor; enviar el diagnóstico sella `t₁`. No hay contador en pantalla: verlo correr cambiaría
  el ritmo del profesional y sesgaría justamente la medición que OE1 intenta capturar.
- **En pretest no hay rastro de la evaluación asistida.** Ni panel, ni marcador de posición, ni
  sección «oculta»: se muestra `<StudyModeBlocked />`, que explica que la restricción es parte del
  estudio y que se aplica en el servidor. Si el usuario fuerza la ruta, la API responde 403
  (RF-TR-01).
- **El personal no ve la palabra «IA».** En los portales de consulta y admisión la sugerencia del
  modelo se llama «evaluación asistida» o «sugerencia del sistema», los modelos son
  «clasificadores», el Grad-CAM es el «mapa de atención» y las fases son «pretest» y «postest» a
  secas. El vocabulario técnico (IA, modelo, CNN, IIA) queda en Administración —indicadores,
  estadística, anexos y auditoría—, que es donde la tesis lo necesita. Lo que se mide es el apoyo
  al diagnóstico, no la impresión de estar usando inteligencia artificial.
- **El formulario no preselecciona la sugerencia del sistema.** Rellenar la respuesta del médico
  con la del modelo convertiría el «diagnóstico asistido» en una confirmación, y la tasa de
  concordancia que mide OE2 dejaría de significar algo.
- **El nombre del paciente se ve, el dato se mantiene anonimizado.** RF-TR-03 cifra la identidad y
  la reserva al profesional tratante; no le pide trabajar a ciegas. La bandeja y el selector de
  paciente muestran el nombre a los roles del grupo `identity` —`dermatologo` y `tecnico`; elegir de
  una lista de códigos es como se abre el caso equivocado—, mientras que para `admin` llega en
  `null`, y **anexos, exportaciones CSV y reportes PDF usan siempre el código**. Cada listado con
  identidad deja una entrada en la traza de auditoría.
- **Los datos sintéticos se marcan siempre.** Cuando el tablero incluye los 30 casos de
  demostración lo dice en un aviso; nunca se presentan como evidencia de la tesis.
- **Las flechas de variación se juzgan por la dirección del indicador.** En TRM una bajada es
  buena; en TPD, TSP y TCAD lo bueno es subir. Colorear por el signo del cambio pintaría de rojo
  el resultado principal de OE1.
- **Las imágenes no pasan por `next/image`.** El optimizador cachearía fotogramas descifrados
  fuera de la ruta auditada, que es justo lo que prohíbe el cifrado en reposo de RNF-02.

---

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx            Fuentes, metadatos y SessionProvider
│  ├─ page.tsx              Portada con las dos experiencias
│  ├─ login/                Autenticación
│  ├─ captura/[token]/      Panel móvil de fotografías, abierto por QR (sin sesión)
│  ├─ portal/               Portal del dermatólogo
│  │  ├─ casos/nuevo/       Asistente de ingreso: paciente → anamnesis → fotos → resumen
│  │  ├─ pacientes/[id]/    Historia clínica longitudinal y curva de evolución IGA
│  │  ├─ casos/[id]/        Ficha de caso: pretest y postest
│  │  ├─ indicadores/       TRM · TPD · TSP · TCAD + boxplots + matriz de confusión
│  │  ├─ estadistica/       HE₁–HE₄ y H₁ en un clic
│  │  ├─ anexos/            Anexos 4, 5 y 7 digitalizados
│  │  ├─ encuesta/          Anexo 6 (Likert)
│  │  ├─ jornada/           Apertura y cierre de jornada (TCAD)
│  │  └─ auditoria/         Cobertura de objetivos e IIA
│  └─ app/                  PWA del paciente
├─ components/
│  ├─ ui/                   Button, Card, Badge, Field, Table, feedback
│  ├─ charts/               Boxplot SVG propio, matriz de confusión, barras, evolución IGA
│  └─ portal/               Componentes específicos del portal
├─ lib/                     Cliente tipado, hooks, formato, catálogos
└─ types/api-schema.d.ts    GENERADO — no editar a mano
```

El **boxplot está escrito a mano en SVG** porque Recharts no trae uno nativo y porque es el único
gráfico del estudio que debe leerse con precisión: bigotes de Tukey (1,5 × RIC), mediana marcada y
valores atípicos como puntos individuales (RF-OE4-04).

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en el puerto 3000 |
| `pnpm build` / `pnpm start` | Compilar y servir |
| `pnpm lint` / `pnpm lint:css` | ESLint y política Tailwind-only |
| `pnpm typecheck` | TypeScript estricto con `noUncheckedIndexedAccess` |
| `pnpm test` | Vitest + Testing Library |
| `pnpm generate:api-types` | Regenera el cliente desde el OpenAPI de la API |

---

## Arquitectura

| Proyecto | Rol | Puerto |
|---|---|---|
| **`acne-web`** (este) | Portal y PWA | 3000 |
| [`acne-api`](../acne-api) | Orquestación clínica, indicadores y estadística | 3001 |
| [`acne-ai-engine`](../acne-ai-engine) | Inferencia CNN, Grad-CAM y SciPy | 8000 |

## Trazabilidad

Toda tanda de cambios actualiza [`../acne-infra/TRACEABILITY.md`](../acne-infra/TRACEABILITY.md) y
este `CHANGELOG.md`.

## Captura de fotografías desde el móvil

El alta de caso (`/<portal>/casos/nuevo`, paso 3) genera un **código QR**. Escaneado con el teléfono,
abre `/captura/<token>`: una página sin sesión que muestra el **código** del caso —nunca el nombre
del paciente— y una tarjeta por cada toma del protocolo. Cada fotografía sube en cuanto se toma y
aparece en el escritorio en unos segundos, sin recargar.

### Cómo hacerlo funcionar en la clínica

El teléfono y el equipo tienen que verse en la misma red, y el teléfono **no puede resolver
`localhost`**:

1. Averigüe la IP de red del equipo: `ipconfig` (busque «Dirección IPv4»).
2. Abra los puertos 3000 y 3001 entrantes en el firewall de Windows. Sin esa regla el teléfono no
   llega y el síntoma es un tiempo de espera mudo, sin mensaje de error.
3. Entre al portal **por esa IP**, no por `localhost`: `http://192.168.1.50:3000`. El QR se
   construye con el origen desde el que usted llegó, así que si entra por `localhost` el código
   apuntará al propio teléfono. La pantalla lo advierte cuando detecta esa situación.
4. La URL de la API se deduce del mismo host, de modo que no hace falta configurar nada más. Si
   define `NEXT_PUBLIC_API_URL` a mano, apúntela también a la IP de red.

### Por qué la página móvil no usa la cámara en pantalla

Los navegadores solo exponen `getUserMedia` en **contexto seguro** —HTTPS o `localhost`—, y en la
clínica esta página se abre por HTTP en la red local. Una vista previa en pantalla habría fallado
justo en el dispositivo para el que existe la funcionalidad. Se usa
`<input type="file" accept="image/*" capture="environment">`, que delega en la app de cámara del
sistema, no necesita contexto seguro y entrega la resolución completa del sensor con enfoque y flash
nativos — para un primer plano clínico, mejor que un fotograma de `<video>` recortado. La guía de
encuadre pasa del óvalo en pantalla a una instrucción escrita por toma.

Si algún día se sirve el portal por HTTPS (un certificado con `mkcert`, o un túnel), la página
ofrece además la captura en línea.

## Tema y tipografía

**Un solo modo, claro.** Hubo un conmutador de tres estados —Claro · Oscuro · Sistema— con su
proveedor, su script de pre-pintado y 653 clases `dark:` repartidas por 55 ficheros. Se retiró el
05/09/2026: era una segunda apariencia que revisar en cada cambio y en cada captura de la tesis, a
cambio de una preferencia que en una pantalla clínica compartida nadie ajustaba. Con él se fueron
`ThemeProvider`, `ThemeToggle`, la variante `@custom-variant dark` y las paletas dobles de los
gráficos.

La paleta de grises es **`neutral`**, no `slate`. `slate` lleva croma dentro (~0,04) y sobre una
superficie grande se lee como azul marino; `neutral` tiene croma 0 y sus luminancias caen dentro del
1 % de las de `slate` en todos los escalones, de modo que el cambio no altera ningún contraste.

El **acento es `purple`**, y solo uno: el gris identifica la condición pretest y el morado la
postest en toda la interfaz, de modo que el especialista distingue por color bajo qué condición se
registró cada caso. La marca es la misma en el isotipo (`BrandMark`), en los iconos del manifiesto
(`public/icons/`) y en el favicon (`src/app/icon.svg`); los SVG estáticos repiten el hex del token
(`#581c87` = `purple-900`, `#d8b4fe` = `purple-300`).

Verde, rojo y ámbar **no siguen a la marca**: son semánticos —acertado, equivocado, atención— y
repintarlos costaría la lectura para la que existen.

**Una sola familia**: Inter, en todos los pesos. Los títulos usaron Poppins hasta 09/2026; sus
formas geométricas se leían como publicidad junto a una tabla de treinta tiempos de revisión, y las
clases de peso ya hacían la jerarquía.

**Cromo del portal.** La barra lateral es oscura (`neutral-950`) con el `Wordmark` arriba y solo
las etiquetas de sección: los códigos de objetivos y requisitos siguen declarados en `portals.ts`
pero no se muestran en el menú. La barra superior lleva la miga (`Consulta / Casos`) y la cuenta;
el título de cada página lo pone `PageHeader`, de modo que ninguna pantalla dice dos veces dónde
está.

Todo el color va como clase de utilidad en el JSX; `src/app/globals.css` tiene una sola línea y
`pnpm lint:css` lo verifica en CI. Las excepciones inevitables son las paletas de Recharts, la rampa
de la matriz de confusión y los SVG de marca, que necesitan cadenas de color y no clases: viven
junto a su componente, con el token de Tailwind anotado al lado de cada hex.

## Marca y login

El producto se llama **Dermatrix** (`PRODUCT_NAME` en `src/lib/constants.ts`). El isotipo es una
losa morada con una retícula de 3 × 3 puntos cuya diagonal está encendida: la retícula es la matriz
de tomas y lecturas con la que trabaja el sistema, los puntos la textura de la piel, la diagonal lo
ya examinado. `src/components/brand/brand-mark.tsx` lo dibuja como componente y
`src/components/brand/wordmark.tsx` lo acompaña del nombre, con `tone="dark"` para la barra lateral
y el panel del login.

El login (`src/app/login/page.tsx`) es la portada del sitio: un panel oscuro con el `Wordmark`, la
descripción del producto y un campo de puntos SVG que extiende la retícula del isotipo, y el
formulario a la derecha. La universidad aparece como crédito al pie; el título de la tesis no, porque
quien entra es personal de un centro y no un jurado. No hay fotografías: ninguna fotografía clínica
tiene licencia para el repositorio, y una cara de banco de imágenes daría a entender que el prototipo
ha visto un paciente real.

## Aviso regulatorio

El aviso de RNF-06 vive en los **reportes PDF** —completo tras las referencias y abreviado al pie de
cada página—, que es donde el requisito lo pide: «todo *reporte* incluye disclaimer». Se retiró del
cromo de la interfaz, donde estaba repetido en cinco pantallas. La página móvil de captura conserva
una nota de protección de datos (cifrado y auditoría del envío), dirigida al personal que la opera.
