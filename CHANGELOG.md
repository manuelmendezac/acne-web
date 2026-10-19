# Changelog — acne-web

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versionado con [SemVer](https://semver.org/lang/es/).

## [No publicado]

### Changed — Dermatrix: sin vía del paciente y rediseño del portal (19/10/2026)

- **El paciente ya no opera el sistema.** Se retiran la presentación de `/` (dos puertas: personal
  y paciente) y la PWA del paciente (`/app/**`, con su service worker y su manifiesto). La raíz
  redirige a `/login`. La captura por QR (`/captura/<token>`) se conserva, operada por el técnico o
  el dermatólogo desde su teléfono; sus textos ya no se dirigen al paciente.
- **Nombre y marca.** El producto se llama **Dermatrix**: isotipo nuevo (losa morada con retícula
  3 × 3 y diagonal encendida), `Wordmark`, iconos del manifiesto y favicon (`src/app/icon.svg`),
  título de la pestaña y descripción sin «inteligencia artificial». «Acné UNT» desaparece de la
  interfaz; la universidad queda como crédito al pie del login.
- **Vocabulario clínico, sin «IA», en consulta y admisión.** «Análisis con IA» → «Análisis
  asistido»; «Diagnóstico preliminar de la IA» → «Evaluación asistida»; «sugerida por IA» →
  «sugerencia del sistema»; «modelo» → «clasificador», «Ensemble» → «Combinado»; «Ver Grad-CAM» →
  «Ver mapa de atención»; «Pretest · sin IA / Postest · con IA» → «Fase pretest / Fase postest»;
  el bloqueo de pretest se titula «Evaluación asistida no disponible en esta fase». Sin iconos de
  cerebro ni destellos. Administración (indicadores, estadística, anexos, auditoría) conserva el
  vocabulario de la tesis.
- **Cromo rediseñado.** Barra lateral oscura con el `Wordmark` y solo las etiquetas de sección (sin
  «TRM · TPD · TSP · TCAD» ni códigos de requisitos en el menú); barra superior con miga y cuenta;
  `PageHeader` como único título de página (antes cada pantalla y la barra lo repetían). Login
  nuevo: panel de marca con campo de puntos y formulario centrado.
- **Paleta y escala.** `violet` deja de ser «el color de la IA»: todo pasa a `purple`. Se eliminan
  los tamaños arbitrarios `text-[10px]` y `text-[11px]` (34 usos → `text-xs`). Tarjetas
  `rounded-xl shadow-xs`; insignias y fichas del caso sin arcoíris de iconos.

### Fixed — clases de utilidad que nunca se aplicaban (19/10/2026)

- `button-variants.ts` y `field.tsx` concatenaban cadenas de clases sin espacio
  (`…ring-purple-900focus-visible:…`, `…text-neutral-900placeholder:…`), de modo que el anillo de
  foco con desplazamiento, el estado `disabled` del botón, el color del placeholder y el anillo de
  foco de los campos y las casillas no existían. Corregido.

### Fixed — captura por QR desde la imagen Docker (23/09/2026)

- `NEXT_PUBLIC_API_URL` queda vacío por defecto en el `Dockerfile`. Con `localhost` compilado en el
  bundle, el celular que escaneaba el QR se llamaba a sí mismo.
- El contenedor arranca `next start` directamente, en lugar de `pnpm start`, que obligaba a corepack
  a descargar pnpm en tiempo de ejecución.

### Fixed — anamnesis sin cuestionario (17/09/2026)

- **La tarjeta de anamnesis del ingreso mostraba «0 de 0 preguntas» y «Precargar respuestas
  anteriores» no pintaba nada** cuando `GET /meta/catalogs` había fallado al abrir la pantalla (API
  caída en ese instante): la pantalla solo leía `data` del catálogo y se quedaba en `null` sin aviso
  ni reintento, mientras la precarga —una llamada posterior— sí llegaba (de ahí «15 de 0»). Ahora la
  tarjeta muestra «Cargando el cuestionario…» o un error con **Reintentar**, y `AnamnesisForm` avisa
  si el catálogo llega vacío, conservando las respuestas precargadas.

### Added — PDF de la receta y estado real de las entregas (21/09/2026)

- Botón **«Descargar PDF»** en cada receta (`GET /prescriptions/:id/pdf`): el mismo documento que
  recibe el paciente por WhatsApp. Cada entrega muestra ahora «aceptado» / «rechazado» (además de
  «simulado») y el detalle devuelto por la pasarela (ruta usada o motivo del rechazo).

### Added — «usar» esta lectura (18/09/2026)

- Cada celda de `CaseAnalysisMatrix` ofrece **«usar»** (en el panel de análisis del ingreso y en
  la ficha): fija esa toma y ese modelo como sugerencia del caso (`PUT
  /inference/case/:id/selection`). La celda elegida queda enmarcada con «elegida», la fila «Caso»
  muestra quién la eligió y **«Volver a la regla automática»** (`POST …/selection/withdraw`); si
  el caso se reanalizó, avisa de que la elección anterior ya no rige. La ficha y la alerta de
  incongruencia se recargan con la clase elegida.

### Changed — columna Ensemble sin promedios (18/09/2026)

- La columna Ensemble de `CaseAnalysisMatrix` muestra la lectura del modelo más seguro en cada toma
  tal como la devuelve el motor (`ENSEMBLE_RULE=mas_confiable`); «ver cálculo» ya no enseña una
  fórmula de promedio: lista los porcentajes de cada modelo, marca «gana» al elegido y explica en
  una frase por qué (confianza; a igual confianza, F1). `EnsembleVotes` y la leyenda de la matriz
  dicen lo mismo. Botón **«Volver a analizar»** en el panel de análisis (`POST
  /inference/case/:id?force=true`), con la versión del modelo que produjo la lectura al lado.

### Changed — fila «Caso» de la matriz (18/09/2026)

- La fila «Caso» ya no promedia: muestra la regla que produjo la sugerencia (`ruleDescription`),
  el rango entre tomas, y las tomas que decidieron llevan la marca «decide» con fondo violeta. La
  cabecera dice «Confianza» a secas.

### Added — lectura del caso (17/09/2026)

- Bajo la matriz tomas × modelos, en el ingreso y en la ficha, se muestra `caseAnalysis.reading`
  con el componente `AiAssessment` (título «Lectura del caso»): resumen con la definición clínica
  del grado, fundamento (alternativas contiguas, votos discordantes, asimetría), zonas según la
  toma, banderas de la anamnesis, diferenciales y aspectos a valorar.

### Added — análisis del caso completo, multi-vista (17/09/2026)

- «Analizar el caso» lanza `POST /inference/case/:id` (las tres tomas) y sondea
  `GET /inference/case/:id/analysis`. **`CaseAnalysisMatrix`**: tabla tomas × modelos (clase y
  confianza por celda, columna Ensemble por toma, fila «Caso (promedio)» con la sugerencia
  combinada y el acuerdo entre tomas; celdas en ámbar si difieren de la sugerida). En la ficha,
  pulsar una celda muestra el Grad-CAM de ese modelo sobre esa toma; «Solicitar inferencia» analiza
  las tres tomas.

### Changed — reconocimiento de la incongruencia en el diagnóstico (17/09/2026)

- `DiagnosisForm` recibe `mismatch` de la ficha: con incongruencia muestra los mensajes, la salida
  («Solicitar fotos» o corregir la anamnesis) y una casilla «Revisé la fotografía: corresponde al
  paciente y a la zona afectada» con motivo obligatorio; el botón de emitir queda deshabilitado
  hasta completarla y envía `mismatchAcknowledged` / `mismatchReason`.

### Added — progreso del análisis (17/09/2026)

- **`AnalysisProgress`**: mientras la inferencia está en cola o ejecutándose, el panel de análisis
  del ingreso y la tarjeta de IA de la ficha muestran una barra de progreso estimado (avanza con el
  tiempo y no se completa sola), la etapa («En cola», «Los modelos están leyendo el caso…») y los
  segundos transcurridos. Antes la tarjeta quedaba vacía con la insignia «En curso». La ficha
  distingue además una inferencia fallida (con su mensaje) de una pendiente.

### Changed — subida desde el equipo, por toma (17/09/2026)

- **Un botón «Subir» en cada fila del protocolo** sustituye al desplegable único + «Elegir
  archivo»: la fotografía queda rotulada con la fila desde la que se sube, así que ya no pueden
  acabar tres fotografías como «Vista general» por no cambiar el desplegable. Bajo cada miniatura
  hay un selector para **corregir la toma** de una foto ya subida (`POST /images/:id/shot`), en
  ámbar si no tiene toma asignada.

### Added — ensemble de modelos (17/09/2026)

- **`EnsembleVotes`** en la ficha y en el panel de análisis del ingreso: tabla con la clase,
  confianza, peso (F1) y latencia de cada modelo, insignia de acuerdo (unanimidad / mayoría /
  discrepancia) y, en la ficha, un botón **Ver** por modelo que muestra su Grad-CAM sobre la
  fotografía (pie con el modelo, su clase y su confianza). Las lecturas que difieren de la sugerida
  van en ámbar. Tipos regenerados (`members`, `agreement`).

### Added — validaciones del caso antes de evaluarlo (17/09/2026)

- **Checklist del protocolo fotográfico con bloqueo.** `lib/shots.ts` (`missingRequiredShots`,
  `pickImageForInference`, etiquetas) aplica en el portal la misma regla que el servidor: el panel
  de captura avisa qué tomas obligatorias faltan y apunta el selector de escritorio a la siguiente;
  «Analizar el caso» (ingreso), «Solicitar inferencia» y el envío del diagnóstico (ficha) quedan
  deshabilitados con el motivo a la vista; la ficha muestra un banner y etiqueta cada miniatura con
  su toma; la página móvil `/captura/[token]` resume cuántas obligatorias faltan.
- **La inferencia se pide sobre la vista general**, no sobre la primera o la última imagen.
- **`AnamnesisMismatchAlert`**: alerta roja dentro de la tarjeta de IA (ficha) y del panel de
  análisis (ingreso) con los mensajes de `CaseDetailDto.anamnesisMismatch`. El portal no
  reimplementa la regla: la muestra.
- `CaptureQrPanel.onImagesChanged` entrega las imágenes, no solo el conteo.
- `DiagnosisForm` acepta `blockedReason`.
- Tipos regenerados desde el OpenAPI (`missingShots`, `anamnesisMismatch`, `shotKey` en la subida).

### Added — apartados de alta de personal

- **«Técnicos» en el portal del especialista**, y **«Dermatólogos» y «Técnicos» en el del
  administrador**. Van aparte de «Usuarios» y no lo duplican: «Usuarios» es la lista completa a la
  que se entra a BUSCAR a alguien; estas son las pantallas a las que se entra a DAR DE ALTA, con el
  formulario arriba y la lista debajo. El rol viene fijado por la sección — un desplegable con una
  única opción es una pregunta cuya respuesta ya está decidida, y es la que más se equivoca.
- **Teléfono en el alta y en la edición**, guardado cifrado. Aparece también en la tabla de
  personal.
- Cada sección permite **restablecer la contraseña** de las cuentas que administra: una cuenta que
  se crea y luego se queda sin contraseña es una cuenta perdida, y el trámite que esto venía a
  evitar reaparecería el primer lunes que alguien olvide su clave.

### Fixed — la tabla de personal tenía las columnas corridas

- **«Condición» sobrevivió al retirar el modo de estudio** y dejó SIETE cabeceras sobre SEIS
  celdas: el consentimiento se pintaba bajo «Condición», el estado bajo «Consentimiento» y el
  enlace de editar bajo «Estado». En su hueco va ahora el teléfono.


### Added — quitar la fotografía subida y analizar el caso

- **Las miniaturas del panel de captura llevan botón de quitar.** Antes una fotografía subida por
  error se quedaba en el caso para siempre. Se pide confirmación en la propia miniatura y no con un
  diálogo: son bytes que ya viajaron al servidor y el clic de más evita el descuido sin sacar a
  nadie de la pantalla. Cuando el servidor se niega —la imagen ya sustenta una inferencia o un
  diagnóstico firmado— se muestra su mensaje tal cual, que es donde se explica por qué.
- **`AnalysisPanel`: el botón «Analizar el caso»**, entre las fotografías y el cierre del ingreso,
  que es el orden real del trabajo. El modelo lee la fotografía JUNTO CON las respuestas de la
  anamnesis y devuelve la clase IGA sugerida con su fundamento; el panel sondea mientras la cola
  procesa y deja de sondear al llegar el resultado.
- **Exige la anamnesis guardada.** El contexto clínico se lee cuando el trabajo sale de la cola, no
  cuando se encola: analizar con el cuestionario a medio llenar produce una lectura hecha solo con
  píxeles que después nadie distingue de una completa.
- **El historial del paciente muestra la lectura razonada de cada visita**, no solo la clase y la
  confianza. En una consulta de control lo que hace falta es poder releer por qué el modelo dijo lo
  que dijo la vez anterior.


### Changed — la ficha del caso, reorganizada

Siguiendo la disposición del historial de paciente de DermAsist:

- **Cabecera del paciente** con avatar, nombre, estado del caso, códigos, edad y sexo. Antes había
  que leer una línea de texto pequeño bajo el título para saber a quién se estaba diagnosticando —
  con el paciente delante, ese es el dato que tiene que estar a la vista.
- **Fila de cifras**: tiempo de revisión, severidad firmada, recetas emitidas e imágenes.
- **Línea de tiempo de las visitas** del paciente, con la actual marcada, en la columna izquierda.
  Da el contexto de evolución mientras se diagnostica: ver que la severidad bajó de severo a leve
  dice algo que la fotografía de hoy, sola, no dice. Antes había que abandonar la ficha e ir a
  Pacientes, que es lo que nadie hace con el paciente esperando.
- **Dos columnas equilibradas**: la derecha ya no desborda. La página pasó de 2920 px a 2209 px.
- La línea de tiempo pide TODAS las visitas del paciente. El filtro de sintéticos existe para que
  los datos de demostración no contaminen indicadores ni contrastes, no para recortar la historia
  de una persona: filtrarlas mostraba un paciente con cuatro visitas como si tuviera una.

### Fixed

- **La pantalla de preguntas era ilegible**: las 21 se pintaban como formularios desplegados a la
  vez, una página de **8838 px** de campos idénticos donde no se distinguía nada, el formulario de
  alta se perdía entre ellos y la pregunta recién creada quedaba enterrada al final. Ahora se
  listan plegadas —número, enunciado, clave, tipo y, si las tiene, cuántas respuestas— y solo se
  abre la que se está editando. La página bajó a **2474 px**.
- Al crear una pregunta se abre automáticamente la nueva, que es lo que la persona acaba de
  escribir y lo que va a querer revisar.
- Una fila con cambios sin guardar lo dice en la cabecera, para que plegarla no los esconda.

### Added

- **Crear y eliminar preguntas** en `/dermatologo/preguntas`, además de editarlas. El formulario de
  alta pide clave, sección, enunciado, tipo, ámbito y —solo para las de elección— las opciones.
- Cada pregunta muestra cuántas anamnesis la han respondido. Las que tienen respuestas salen con un
  candado: se les corrige la redacción, pero no la definición, y no ofrecen botón de eliminar.

### Changed

- **El almacén pasa a dos columnas**: la lista a la izquierda y la ficha del fármaco a la derecha,
  pegada al hacer scroll. Estaban una debajo de otra, de modo que abrir un medicamento obligaba a
  bajar hasta el final de 32 filas para ver su detalle y a volver a subir para elegir el siguiente.
  La lista scrollea dentro de su tarjeta, así que la página deja de crecer con el catálogo.
- El campo de la indicación es un área de texto: las que trae la clínica son la instrucción
  completa —«TOMAR 1 PASTILLA DESPUÉS DEL ALMUERZO 2 VECES/SEMANA (LUNES Y JUEVES) POR 3 MESES»— y
  en una sola línea se cortaban justo donde está el dato que importa.

### Added — tres apartados para el especialista

- **Almacén** (`/dermatologo/almacen`): busca, da de alta y edita fármacos con sus indicaciones.
  Cada indicación lleva su propia dosis sugerida, que es lo que el buscador de la receta rellena.
- **Preguntas** (`/dermatologo/preguntas`): las 21 del ingreso, agrupadas por sección, con la
  redacción editable. No hay botón de crear ni de borrar, ni campo para la clave: es la regla, no un
  olvido, y la pantalla lo explica.
- **Firma** (`/dermatologo/firma`): sube la rúbrica que se imprime en la receta, con el aviso a la
  vista de que no es una firma electrónica reconocida.

### Fixed

- «2 indicaci**ó**nes» en el almacén: el plural de «indicación» pierde la tilde.

### Added

- **Jornada en el portal del técnico.** Registra su propio trabajo con el mismo instrumento del
  Anexo 7 que el especialista.

### Fixed

- El resumen elegía qué recorrido mostrar por atajos que caducaban: primero «no tiene indicadores»
  —que dejó de distinguir a nadie cuando pasaron a ser del admin— y luego «no tiene jornada», que
  duró hasta que el mostrador registró la suya. Ahora pregunta por **quién diagnostica**, que es la
  razón por la que los dos puestos existen por separado.

### Changed — cada portal ve lo suyo

- **Fuera el conmutador de condición experimental** de la barra superior y las tarjetas que lo
  explicaban en «Mi cuenta» y en la ficha de usuario: ya no hay condición que elegir.
- **El dermatólogo pierde indicadores y anexos**, y gana un resumen con su propio recorrido —abrir
  jornada, revisar, responder la encuesta— en vez del recorrido del mostrador que se le estaba
  mostrando por error.
- **El técnico gana la encuesta.** Es la única sección del estudio que le corresponde: responde el
  instrumento que lo mide, no lee sus resultados.
- La bandeja de casos deja de filtrar «por mi condición actual».

### Added — el proceso clínico en el portal

- **La validación del dermatólogo pasa a ser completa**: además de la clase IGA y el GAGS, ahora
  registra diagnóstico redactado, código CIE-10, indicaciones para el paciente y notas internas.
  Solo la clase IGA es obligatoria: es lo único que TPD puede comparar contra el patrón de
  referencia, y exigir el resto alargaría cada medición sin mejorar la evidencia.
- **Panel de receta** (`prescription-panel.tsx`): buscador del vademécum que rellena dosis,
  frecuencia y duración con lo sugerido para ESA indicación; renglones editables; emisión firmada;
  envío por WhatsApp, correo o descarga; y anulación. Aparece solo cuando el caso ya tiene
  diagnóstico — prescribir antes de juzgar sería recetar a ciegas.
- **Las dos salidas que no son diagnosticar** (`case-branch-actions.tsx`): «Pedir más fotos»
  devuelve el caso al mostrador y «Derivar a presencial» lo saca del circuito. Ambas exigen motivo
  escrito, y la pantalla explica qué le hace cada una a la medición.
- **Aviso de devolución en la ficha**: el técnico ve el motivo que escribió el especialista y el
  botón que devuelve el caso a revisión una vez repuestas las fotografías.
- El catálogo servido incorpora `icd10`, `prescriptionStatuses` y `deliveryChannels` (con la lista
  de canales que el prototipo simula en vez de ejecutar).

### Fixed

- `useAction` se llamaba después de un retorno temprano en la ficha del caso, lo que rompe el orden
  de hooks entre renders. Lo detectó `react-hooks/rules-of-hooks` en CI.

### Changed — la pantalla muestra nombres, no códigos

- **La traza de auditoría se lee.** Antes pintaba `case.list.identity`, `hypothesis_run` y
  `{"dataset":"anamnesis","includeSynthetic":true}`; ahora dice «Listado de casos con identidad»,
  «Contraste» y «dataset: anamnesis · incluye sintéticos: sí». El código sigue disponible en el
  `title` de la celda, porque un auditor lo cita en un hallazgo, pero deja de ser lo único legible.
- **La matriz de cobertura muestra «Cubierto» y «Parcial»** en vez de `covered` y `partial`.
- El nombre de la prueba estadística se resuelve por el catálogo (`t de Student para muestras
  relacionadas`) en vez de mostrar el argumento de SciPy.
- La nota al pie de la traza citaba `audit_logs.metadata`, una tabla que ya no existe.

### Fixed — el formulario de anamnesis no renderizaba las preguntas de elección

- **Las seis preguntas de elección del cuestionario de ingreso mostraban una caja de texto libre.**
  Los tipos de pregunta llegan por `GET /meta/catalogs`, cuyo handler devuelve `Record<string,
  unknown>`: OpenAPI no puede describirlo, así que `use-catalogs.ts` declaraba la unión a mano.
  Cuando el dominio tradujo `single_choice` a `opcion_unica`, esa unión escrita a mano se quedó con
  los valores viejos y las preguntas cayeron a la rama de texto libre — un control equivocado sobre
  un cuestionario clínico, sin que nada lo señalara.
- **La rama por defecto deja de degradar en silencio**: un tipo que la pantalla no reconoce se
  muestra ahora como un aviso que nombra el tipo, en vez de una caja de texto plausible.
- Corregidas también dos comparaciones contra literales retirados en `casos/[id]`
  (`status !== 'succeeded'`, `status === 'diagnosed'`), que el compilador solo pudo ver una vez
  regenerado `api-schema.d.ts`.
- `pnpm generate:api-types` regenerado: los tipos ya no mencionan `residente` ni
  `evaluador_estadistico`.

### Added

- La tabla de usuarios marca las cuentas sintéticas con la misma insignia que lleva un caso de
  demostración en la bandeja.

### Changed — rediseño: modo claro y paleta purple (BREAKING)

- **Se elimina el modo oscuro.** Fuera `ThemeProvider`, `ThemeToggle`, el script de pre-pintado del
  `<head>`, la variante `@custom-variant dark` de `globals.css` y **653 clases `dark:` repartidas
  por 55 ficheros**. Era una segunda apariencia que revisar en cada cambio y en cada captura de la
  tesis, a cambio de una preferencia que en una pantalla clínica compartida nadie ajustaba. Los tres
  gráficos de Recharts pasan de dos paletas a una.
- **El acento pasa de `sky` a `purple`**, y el segundo acento de `cyan` a `violet`. La distinción
  que importa se conserva: gris neutro para pretest (sin IA) contra violeta para postest (con IA).
  El gris del pretest no es un descuido —es la condición SIN la herramienta, y darle un color de
  marca sugeriría que es una variante de lo mismo y no su ausencia.
- **Verde, rojo y ámbar no siguen a la marca.** Son semánticos —acertado, equivocado, atención— y
  repintarlos de violeta habría costado la única lectura para la que existe una matriz de confusión.
- **Recoloreados a mano los assets que no son clases:** la ilustración del login, los dos iconos SVG
  de la PWA y el `theme_color` del manifiesto, que seguía en `#171717` y contradecía el modo claro.
- `scripts/check-no-custom-css.mjs` exige ahora **una** línea en `globals.css` en vez de dos.

### Fixed

- **El resumen deja de mostrar la superficie del estudio a quien no participa de ella.** Las tres
  pantallas de inicio son una sola, y desde la separación en portales le ofrecía al mostrador la
  cobertura de objetivos, los cuatro reportes de la tesis y un enlace a un panel de auditoría que su
  portal no tiene: cada una de esas llamadas responde 403 para un técnico, así que la página pintaba
  un encabezado sin nada debajo y un enlace que llevaba a «sección no disponible». Los bloques se
  deciden ahora con `hasSection`, derivado de la definición de portales, y las peticiones que el
  portal no puede leer ni siquiera se emiten. El portal de admisión gana en su lugar el recorrido
  del ingreso, que es lo que sí es su trabajo.

### Changed — tres portales (BREAKING)

- **`/portal` se divide en `/admin`, `/dermatologo` y `/tecnico`.** Había un solo portal cuyo menú se
  filtraba por rol. Funcionaba, y escondía un problema real: cada pantalla había que leerla dos
  veces —como la ve el dermatólogo y como la ve el técnico— y nadie podía señalar el sistema y decir
  en qué consiste el trabajo de un técnico. Tres rutas convierten la frontera en un hecho de la URL
  en vez de en una condición de tiempo de ejecución, que es además lo que la tesis debe describir.
- **`src/lib/portals.ts` reemplaza a `components/portal/navigation.ts`** como definición única: qué
  secciones tiene cada portal, en qué orden, con qué título y cuáles son alcanzables. El sider, la
  barra superior y el guard de ruta leen la misma estructura.
- **Las pantallas se mueven a `src/screens/`** y cada `page.tsx` de los tres árboles las reexporta.
  Una pantalla no cablea su ruta: `usePortalHref()` deriva el prefijo del *pathname*, de modo que la
  misma vista de casos resuelve a `/admin/casos` o a `/tecnico/casos` sin una línea de diferencia.
- **El login lleva a cada rol a su portal**, sin pantalla intermedia. Un enlace al portal ajeno
  redirige al propio en silencio: quien lo abrió no hizo nada mal, y una pantalla de error solo le
  enseñaría que el sistema es poco fiable. Una ruta que el portal no tiene sí avisa, porque eso
  significa que un enlace interno apunta a donde no debe.
- **Cinco roles pasan a tres.** Desaparecen `residente` y `evaluador_estadistico`, y con ellos la
  pantalla `/portal/personal`, que era la misma tabla sobre las mismas filas que `/portal/usuarios`
  con otro encuadre. Las dos comprobaciones de rol que quedaban cableadas —quién cambia de condición
  experimental y quién ve el nombre del paciente— pasan a leer los grupos del catálogo servido.

### Added

- **La traza de auditoría se lee desde el portal** (`components/portal/audit-trail`), como tercera
  tarjeta de `/portal/auditoria`, con filtro por acción y por número de eventos. `GET /audit/logs`
  existía desde la primera migración y **ninguna pantalla lo llamaba**: la evidencia que pide RNF-02
  —«logs de auditoría por acceso a caso»— solo podía producirse abriendo PostgreSQL a mano, que no
  es evidencia que nadie pueda mostrar en una defensa. Es el tercer endpoint vivo e inalcanzable que
  se cierra, después del consentimiento del personal y del retiro de pacientes.
- **Alta de paciente en su propia pantalla** (`/portal/pacientes/nuevo`). La única puerta a
  `POST /patients` era el primer paso del asistente de casos, así que registrar a alguien que no se
  atiende hoy —una preinscripción, una persona que solo vino a firmar el consentimiento— obligaba a
  crear un caso que nadie iba a revisar. Registrar a la persona y abrir una visita son dos actos
  distintos y ahora tienen dos pantallas distintas.
- **Mantenedores de personal y de pacientes.** «Personal médico» y «Usuarios» son dos entradas de
  menú sobre la misma tabla `users` —un médico es un usuario con rol, no otra tabla— y son las
  **primeras secciones del portal restringidas a un solo rol**. `GET`/`POST`/`PATCH /users` existían
  desde el primer día sin que nada del portal los llamara.
  Incluye la ficha de usuario con restablecimiento de contraseña (mostrada en un aviso persistente
  con botón de copiar, nunca en un toast que se desvanece), baja y alta lógica, y la corrección de
  la ficha del paciente, con los campos de identidad visibles solo para quien puede verlos.
- **«Cambiar mi contraseña» en `/portal/perfil`**, la contraparte del restablecimiento.
- **Retirar y reincorporar** al paciente desde su historia. `POST /patients/:id/withdraw` llevaba
  desde el inicio sin pantalla, igual que le pasó al consentimiento del personal.
- `ConfirmAction`: confirmación de dos pasos en línea, no un modal. El proyecto no tiene ninguno, y
  uno correcto exige trampa de foco, `aria-modal`, bloqueo de scroll e inertización; además `jsdom`
  25 no ejecuta `showModal()`, así que un `<dialog>` sería intestable aquí. Revelar en el sitio deja
  además a la vista la fila sobre la que se actúa.
- Validación por campo (`lib/user-validation.ts`), que **estrena la prop `error` de `Field`**:
  existía desde el primer día y ninguna página la había pasado nunca.
- 25 pruebas nuevas, incluida una que fija en el árbol de componentes que **`UserForm` no renderiza
  ningún control de modo de estudio** en ninguno de sus dos modos (RF-TR-01).
- Los avisos de calidad de una fotografía admitida se muestran en el panel de captura y en la
  página del teléfono. El rechazo llega como el mensaje de error de la API, que ya dice qué
  corregir.
- **El panel de IA muestra el razonamiento, no solo la clase.** `components/portal/ai-assessment`
  presenta la lectura del modelo, el fundamento de la clase frente a la contigua, las lesiones y
  zonas observadas, los diferenciales y los aspectos de manejo. Las banderas que aporta la
  anamnesis van aparte y en tono de aviso: son lo único que el médico no puede pasar por alto
  —un embarazo posible frente a la isotretinoína, una alergia, un fármaco ya en curso.

### Fixed

- **`Field` no asociaba su etiqueta con el control que envuelve.** Aceptaba `htmlFor` y ningún
  llamador lo pasaba, así que todos los `<Select>` del portal —sexo, fototipo, clase IGA, filtros—
  quedaban sin etiqueta para un lector de pantalla y sin poder enfocarse pulsando su rótulo. Ahora
  el id viaja por contexto y arregla cada uno sin tocar su llamador; de paso llegan
  `aria-describedby` hacia el error o la ayuda, y `aria-invalid`.
- `USER_ROLE_LABELS` no contenía `tecnico` —su docstring aún hablaba de «los cuatro roles»—, de modo
  que a ese usuario el portal le mostraba el literal `tecnico` en la barra superior y en su perfil.

### Changed

- **El ingreso de un caso deja de ser un asistente por pasos: todo cabe en una sola vista.** Los
  tres bloques —paciente, anamnesis, fotografías— se ven desde el primer render, así que quien está
  en la mesa de admisión abarca de un vistazo lo que le van a pedir. Los dos últimos permanecen
  bloqueados hasta que el caso existe, y eso **no es un artificio de ritmo**: la anamnesis y las
  imágenes se guardan contra un `caseId`, de modo que no hay a qué adjuntarlas hasta que el primer
  bloque se envía. Lo que protege al TRM sigue intacto — todo esto ocurre antes de
  `POST /cases/:id/open`, que es donde arranca el cronómetro de OE1 (RF-OE1-01).
- La ficha de caso ya no llama «Grad-CAM» a lo que no lo es. Cuando el backend no es la CNN
  (`modelBackend !== 'torch'`), la superposición se rotula **«regiones señaladas por el modelo»**:
  es lo que el modelo declara haber mirado, no una atribución de gradiente. El médico lee ese
  rótulo como evidencia de cómo se formó la sugerencia, así que nombrarlo mal no es cosmética.

## [0.1.0] — 2026-08-31

### Added

- **Menú de cuenta en la barra superior.** Sustituye al nombre, el rol y un icono de cierre de sesión
  sueltos en la fila. Se despliega con el avatar y muestra nombre, correo y rol, «Mi cuenta» y
  «Cerrar sesión». Dos cosas salen de plegarlos en un menú: la fila pasa de tres controles a uno, que
  es lo que permite que la barra quepa en un teléfono, y cerrar sesión deja de estar a un clic — era
  un icono sin etiqueta junto al propio nombre del usuario, un clic erróneo esperando a ocurrir en
  mitad de una revisión con el cronómetro corriendo.
- **Ficha «Mi cuenta»** (`/portal/perfil`): correo, rol, especialidad, alta de la cuenta y la
  condición experimental con su valor de IIA explicado. Lee `GET /users/me` en vez de la sesión en
  caché, porque la sesión es lo que decía el token cuando se emitió y el modo de estudio puede
  haberse movido desde entonces.
- **Consentimiento informado del personal médico (RNF-07).** `POST /users/me/consent` existía en la
  API desde el principio pero **no tenía pantalla en ninguna parte**: la mitad del requisito —«módulo
  de consentimiento informado electrónico (paciente y personal médico)»— era inalcanzable. Ahora se
  otorga desde la ficha de cuenta, con el texto de la declaración a la vista, y queda registrado en
  `audit_logs` como `user.consent.accept`. Verificado de punta a punta.
- **`useDismissable`**: cierra un desplegable al pulsar fuera o al pulsar Escape. Escucha
  `pointerdown` y no `click`, porque un `click` llega después de que el objetivo ya haya reaccionado
  y un botón bajo el panel se dispararía antes de que el panel supiera que debía cerrarse.
- **Campo de contraseña con ojo para revelarla** (`PasswordInput`). El control es un `button` con
  `aria-pressed`, no una casilla con icono: ejecuta una acción en vez de registrar un valor, y un
  lector de pantalla tiene que oír en cuál de los dos estados está. Siempre arranca oculta y no
  recuerda la elección — quien inicia sesión en un mostrador con cola detrás no debería tener la
  contraseña en pantalla porque la reveló una vez, la semana pasada, en su propio equipo. Queda
  fuera del orden de tabulación, para que desde la contraseña se llegue al botón «Entrar».
- **Conmutador de tema de un solo icono.** Eran tres iconos anónimos del mismo tamaño: decían «algo
  sobre la apariencia» pero nunca cuál estaba activo. Ahora es un botón que muestra el modo actual y
  cicla claro → oscuro → sistema al pulsarlo. Se pierde poder saltar directo a un estado —de claro a
  sistema son dos pulsaciones— y se gana un control de 36 px en vez de una fila de 114, que es lo que
  permite que quepa en la barra superior de un teléfono junto al menú, el título, la insignia de
  condición y el cierre de sesión. El nombre accesible lleva las dos mitades del estado —en qué modo
  está y a cuál lleva pulsar—, porque sin la segunda un lector de pantalla no tiene forma de saber
  hacia dónde va el ciclo. `Sistema` dice además a qué resuelve ahora mismo, que era invisible.
- **Modo oscuro negro.** El fondo de página pasa a `black` y las tarjetas a `slate-950`; bordes,
  `hover`, cabeceras de tabla y rejillas **se quedan donde estaban**. Un primer intento bajaba también
  toda la escala de bordes y era contraproducente: medido, el borde contra la tarjeta caía de 1,72 a
  1,38 cuando WCAG 2.1 SC 1.4.11 pide 3:1 para el límite que identifica un componente, y el topbar
  pegajoso y el rail del sidebar caían a 1,04, es decir dejaban de existir como superficie. Con dos
  reglas en vez de doce **todas las métricas suben**: borde contra tarjeta 1,72 → 1,95, cabecera de
  tabla 1,22 → 1,38, texto principal 16,3 → 18,4. El rail y el topbar se quedan a propósito un
  escalón más claros: son cromo, no contenido, y deben leerse elevados sobre el negro.
- **Portada rehecha** (`/`): marca, planteamiento del estudio, las dos entradas como tarjetas y una
  franja con los cuatro indicadores —fórmula y meta— para que quien llegue sin contexto entienda qué
  mide la tesis. **No hace ninguna llamada a la API**: es la primera pantalla que se carga y tiene que
  verse con el backend caído.
- **Login a 50-50**: formulario a la izquierda, panel ilustrado a la derecha, que desaparece por
  debajo de `lg` para que en el teléfono el formulario ocupe el ancho. Se le añade el conmutador de
  tema, que en esta pantalla no estaba.
- **`BrandMark` y `ClinicIllustration`** (`components/brand/`), dibujadas a mano en SVG a partir del
  motivo del icono de la PWA. Sin fotografía: no hay ninguna con licencia para el repositorio, y una
  cara de banco de imágenes daría a entender que el prototipo ha visto un paciente real. SVG en JSX es
  marcado, no hoja de estilo, así que la política Tailwind-only se mantiene.
- **Portal del dermatólogo** (`/portal/**`): resumen con indicadores y entregables, bandeja de
  casos con filtro por condición, ficha de caso con cronómetro invisible y bloqueo de IA en
  pretest, panel de indicadores con boxplots y matriz de confusión, análisis estadístico de un
  clic, Anexos 4/5/7 digitalizados, cuestionario Likert, panel de jornada y panel de auditoría.
- **PWA del paciente** (`/app/**`): captura guiada con `getUserMedia`, guía de encuadre en SVG,
  manifest y service worker que cachea solo el *shell* — nunca imágenes clínicas ni respuestas de
  la API.
- **Cliente tipado desde OpenAPI**: `pnpm generate:api-types` genera `src/types/api-schema.d.ts`
  desde el documento de `acne-api`. Ningún tipo de respuesta se escribe a mano.
- **Política Tailwind-only verificada**: `scripts/check-no-custom-css.mjs` (`pnpm lint:css`) exige
  que `src/app/globals.css` contenga exactamente `@import "tailwindcss";` y nada más, y que no
  exista ningún otro archivo de estilos. Conectado al CI.
- **Componentes propios** al estilo shadcn/ui con `class-variance-authority`, `clsx` y
  `tailwind-merge`; iconos de `lucide-react`; fuentes Inter/Poppins vía `next/font`.
- **Boxplot en SVG** escrito a mano (Recharts no tiene uno nativo) con convención de Tukey.
- Pruebas con Vitest + Testing Library sobre los componentes críticos.
- **Alta de caso como asistente de cuatro pasos** (`/portal/casos/nuevo`): paciente → anamnesis →
  fotografías → resumen. El orden no es cosmético: todo el trabajo administrativo ocurre **antes** de
  abrir la ficha, y el cronómetro que OE1 informa como tiempo de revisión arranca en
  `POST /cases/:id/open`. Poner el cuestionario en la pantalla del caso habría sumado en silencio un
  minuto de tecleo a cada observación, en ambas condiciones.
- **Formulario de anamnesis** (`components/portal/anamnesis-form`): renderiza las 21 preguntas que
  sirve `GET /meta/catalogs`, agrupadas por sección, con la rama hormonal según sexo y edad, aviso
  permanente si se declara embarazo (los retinoides orales son teratógenos) y precarga de la
  anamnesis de la visita anterior. Ninguna pregunta es obligatoria: dejar una en blanco significa «no
  se preguntó o no lo sabe», que no es lo mismo que responder «no». Se muestra también, en solo
  lectura, en la ficha del caso, **fuera** de la rama de visibilidad de la IA.
- **Panel de código QR** (`components/portal/capture-qr-panel`): genera el código con `qrcode`,
  muestra la cuenta atrás, la lista de tomas y las miniaturas que van llegando (sondeo cada 3 s con
  `usePolledApi`, que se detiene mientras la pestaña está oculta). Si el portal se está sirviendo por
  `localhost`, avisa de que el teléfono no podrá abrir ese enlace — sin ese aviso el fallo se vive
  como «el QR no funciona».
- **Página móvil `/captura/[token]`**, fuera de `/portal` (no hay sesión) y fuera de `/app` (para no
  entrar en el caché del service worker). Muestra el **código** del caso y nunca el nombre del
  paciente. Usa `<input type="file" accept="image/*" capture="environment">` y **no** `getUserMedia`:
  los navegadores solo exponen la cámara en contexto seguro, y en la clínica esta página se abre por
  `http://192.168.x.x:3000`, que no lo es — la vista previa en pantalla habría fallado justo en el
  dispositivo para el que existe la funcionalidad. La app de cámara del sistema además entrega la
  resolución completa del sensor, mejor que un fotograma de `<video>` recortado.
- **`Checkbox`, `RadioGroup` y `CheckboxGroup`** en `components/ui/field`: la anamnesis los necesita
  en 15 de sus 21 preguntas y antes cada pantalla estilaba un `<input>` crudo por su cuenta.
- **Filtrado del menú por rol.** El técnico ve Resumen, Pacientes y Casos; la superficie del estudio
  no aparece y una URL guardada muestra un aviso en lugar de una pantalla de errores. La API es la
  autoridad —cada ruta declara su `@Roles`—, pero un menú que ofrece lo que luego responde 403 se lee
  como un sistema roto, no como un límite.
- **Registro de pacientes e historia clínica longitudinal** (`/portal/pacientes` y
  `/portal/pacientes/[id]`), bajo el grupo Clínico. El listado muestra nombre, edad, fototipo,
  número de visitas, última visita y severidad actual, con búsqueda por nombre o código; la
  historia añade tarjetas de resumen, la **curva de evolución IGA** y la cronología de visitas,
  cada una desplegable con su fotografía, sus diagnósticos firmados, los tiempos de revisión de
  ambas condiciones y la sugerencia del modelo.
  Complementa la bandeja de casos en lugar de duplicarla: la bandeja está organizada en torno al
  experimento, esta responde lo que se pregunta en un control clínico.
- **`SeverityEvolution`** (`components/charts/severity-evolution.tsx`): línea de la severidad IGA
  por visita. IGA es una escala **ordinal**, así que el eje traza el rango (0 sin lesiones … 4
  severo) con las etiquetas clínicas en los ticks; el dibujo muestra dirección y escalones, y
  nunca sugiere que la distancia entre «leve» y «moderado» equivalga a la de «moderado» y
  «severo». El eje no se invierte: la severidad sube, de modo que una línea que baja se lee como
  mejoría.
- **Barra lateral colapsable** con las secciones agrupadas (Clínico · Análisis · Instrumentos ·
  Sistema), carril de iconos en escritorio y cajón en móvil. La preferencia de colapso persiste.
- **Barra superior** reducida a lo esencial: título de la página, insignia de la condición
  experimental, conmutador de tema y usuario. La insignia vive aquí a propósito: es el único
  estado que cambia lo que el profesional puede ver, y esconderlo en un menú permitiría
  diagnosticar sin advertir a qué observación se está contribuyendo.
- **Tema claro / oscuro / sistema** con conmutador de tres estados, persistencia en
  `localStorage` y script en línea que evita el destello blanco al cargar. Disponible también en
  la PWA del paciente.
- `src/components/portal/navigation.ts` como definición única de la navegación: el sider y el
  título de la barra superior salen de la misma fuente.

### Changed

- **La paleta pasa de `slate` a `neutral`, en los dos temas.** El oscuro se veía «medio azulado» y
  la causa era la escala: `slate` tiene croma ~0,04, suficiente para leerse como azul marino sobre
  una superficie grande. `neutral` tiene croma exactamente 0. Son 849 clases en 42 archivos más 25
  literales hexadecimales en las paletas de los gráficos, que Recharts necesita como cadenas.
  Los contrastes medidos para el tema negro **se conservan**: las luminancias de `neutral` caen
  dentro del 1 % de las de `slate` en todos los escalones, así que ninguna de las relaciones que se
  comprobaron cambia. El acento sigue siendo el azul institucional y el cian del postest: ese
  emparejamiento identifica la condición experimental y no es decorativo.
- **Una sola familia tipográfica.** Se retira Poppins y los títulos pasan a Inter, que el cuerpo ya
  usaba. Poppins es geométrica y sus formas redondas se leían como publicidad al lado de una tabla
  de treinta tiempos de revisión; las clases de peso que ya acompañaban a cada encabezado hacen la
  jerarquía por sí solas. Son 46 usos retirados y una fuente menos que descargar.
- **El aviso regulatorio sale de la interfaz.** Estaba repetido en cinco pantallas (portada, login,
  PWA del paciente, captura móvil y panel del portal) y se leía como texto de relleno. **Los cuatro
  PDF lo conservan**, que es lo que RNF-06 pide literalmente —«todo *reporte* incluye disclaimer»—,
  así que el requisito sigue cubierto. La página móvil conserva además su aviso de protección de
  datos, que es RNF-07 y sí tiene destinatario: el paciente.
- **El enlace a la documentación de la API deja de estar fijo a `localhost`.** Apuntaba a
  `http://localhost:3001/docs`, que desde cualquier otro equipo señalaba al propio equipo. Ahora se
  deriva del origen desde el que se sirvió la página, igual que la URL de la API.
- **La URL de la API se resuelve en tiempo de ejecución.** Era la constante
  `NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'`, y desde el teléfono `localhost` apunta al
  propio teléfono: todo el flujo móvil habría fallado. Cuando no hay URL configurada se asume que la
  API vive en el mismo host desde el que se sirvió el portal, lo que funciona igual en el equipo de
  desarrollo y en una dirección de red local.
- **El botón «Enviar al centro» de la PWA deja de estar deshabilitado.** Llevaba desactivado desde el
  primer día con la nota «requiere vincular la cuenta del paciente», porque ese vínculo no existía.
  Ahora existe —el QR del ingreso—, así que la pantalla explica cómo usarlo en lugar de ofrecer un
  botón que nunca funcionó.
- **Migración a Tailwind CSS v4 sin tema propio.** `globals.css` se reduce a
  `@import "tailwindcss";`, se elimina `tailwind.config.ts` y se retiran `autoprefixer` y
  `tailwindcss-animate`. Los 31 archivos de interfaz pasan de tokens semánticos
  (`bg-surface`, `text-muted`, `bg-primary`, `text-pretest`…) a la paleta de fábrica de Tailwind,
  conservando el modo oscuro en cada clase (`bg-white dark:bg-slate-900`). Es una desviación
  **más estricta** que la Sección 12.3 del documento maestro, que sí admitía variables de tema en
  `:root`/`.dark`.
- Los colores de Recharts y de la matriz de confusión, que necesitan cadenas y no clases, pasan de
  `hsl(var(--token))` a literales de la escala de Tailwind declarados junto al componente.

### Notes

- `buttonVariants` vive en `components/ui/button-variants.ts`, un módulo **sin** `'use client'`.
  Los componentes de servidor lo invocan para dar aspecto de botón a un `<Link>`; exportarlo desde
  el archivo del componente cliente entregaría al servidor una referencia de cliente en lugar de
  la función y el prerenderizado fallaría con «(0 , l.d) is not a function».

### Fixed

- **El selector de modo de estudio no se cerraba al pulsar fuera.** Su panel solo se podía descartar
  con su propio botón, así que hacer clic en cualquier otro sitio lo dejaba flotando sobre la página.
  Ahora usa `useDismissable`, igual que el menú de cuenta.
- **La barra superior del portal desbordaba en horizontal en un teléfono.** A 390 px medía 433: el
  título quedaba truncado a una sola letra y la insignia de condición se partía en tres líneas. El
  título gana un ancho mínimo y deja de encogerse hasta desaparecer, la insignia deja de partirse
  (`whitespace-nowrap`: una insignia es una etiqueta, no un párrafo) y el control de tema pasa de
  114 px a 36. Venía de antes de este trabajo, verificado contra el estado anterior.
- **El tooltip de los gráficos desaparecía sobre negro.** Las paletas de Recharts usaban una sola
  clave `surface` para dos cosas incompatibles: el fondo del tooltip *y* el halo del punto de la
  línea de evolución. Un tooltip pintado del color de la tarjeta quedaba a 1,04:1 contra la página y
  se volvía invisible. Se parte en `surface` (el color sobre el que el gráfico se apoya) y `tooltip`
  (un panel que flota por encima y por tanto tiene que ser más claro).
- **La matriz de confusión perdía la codificación por color de los errores.** Usaba
  `rgb(… / 0.08 + share×0.32)` idéntico en claro y oscuro; sobre negro, un rojo translúcido al 8 %
  apenas levanta el fondo, y la celda de error más intensa quedaba en 1,44:1. En oscuro pasa a los
  tonos `-400` con rampa `0.12 + share×0.40` (error 1,11 → 2,14). El número de la diagonal pasa a
  texto plano: estaba señalada dos veces —texto verde y relleno verde— y con el relleno más intenso
  `emerald-400` bajaba a 3,74:1. De paso, el comentario decía `emerald-600` pero el valor era
  `teal-600`.
- **Los bordes de los controles de formulario incumplían AA** desde antes de este trabajo. Un
  `<input>` es un «componente de interfaz» bajo SC 1.4.11 y su borde es lo único que lo identifica,
  porque su fondo es el mismo que el de la tarjeta que lo contiene. Pasan a `slate-300` / `slate-600`.
- **`dark:text-slate-500` incumplía AA** (3,74:1). Son los títulos de grupo y las pistas del sidebar;
  pasan a `slate-400` (7,7:1).
- **La barra de estado del móvil no seguía al tema.** `viewport.themeColor` era un único azul.
  Declararlo con `prefers-color-scheme` no bastaba: esa media query informa de la preferencia del
  **sistema operativo**, mientras que el tema real lo fija el conmutador de la aplicación, así que
  quien tuviera el sistema en claro y eligiera oscuro veía una franja pálida sobre una página negra.
  Se reescribe el `<meta>` desde `ThemeProvider` y desde el script anti-FOUC.
- **La PWA instalada daba un destello blanco en cada arranque en frío.** `background_color` del
  manifest es la pantalla de arranque y era `#f4f7fa`. No hay forma estándar de variarla por esquema,
  así que se fija un valor neutro. **Se subió `CACHE_VERSION` del service worker**, que cachea el
  manifest: sin eso los clientes ya instalados conservarían el antiguo indefinidamente.
- **Separador decimal.** El formato numérico usaba el locale `es-PE`, que en CLDR emplea el punto
  decimal. La tesis y los reportes PDF usan la coma, de modo que el tablero mostraba «8.78» donde
  el reporte imprimía «8,78» — una invitación a errores de transcripción en el capítulo de
  resultados. El locale se fija ahora a la convención del documento, no a la del país.
