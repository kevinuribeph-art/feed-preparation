# Decisiones de la Mesa

Reglas vigentes de la Mesa de trabajo, decididas en chats distintos. Antes de cambiar la Mesa, léelas
(ver `CLAUDE.md` § Decisiones).

- Una entrada por decisión: ID, fecha, regla en una o dos frases y estado.
- Las sustituidas no se borran: se marcan «sustituida por D-xxx (fecha)» y la nueva enlaza a la que sustituye.
- Una decisión nueva toma el siguiente ID libre y va en su sección.
- D-001 a D-017 se registraron el 26/10/2026; varias son anteriores.
- Este repo es público: nada de nombres de clientes ni datos privados (los nombres van en `CLAUDE.local.md`).

## Grid

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-001 | 26/10/2026 | La mesa llena el grid desde arriba. | Vigente |
| D-002 | 26/10/2026 | Se pueden crear a mano huecos (casillas negras ficticias, máximo 2) solo arriba del grid, para cuadrar el feed en filas de 3, y eliminarlos cuando se quiera. No se crean en Notion. | Vigente |
| D-003 | 26/10/2026 | En la imagen del feed para el cliente, los huecos salen solo si se han creado. | Vigente |
| D-004 | 26/10/2026 | La cuadrícula no muestra puntos de estado (ya salen en el calendario). | Vigente |
| D-005 | 26/10/2026 | La imagen del feed para aprobación la genera la mesa, solo del mes a aprobar, y va al toggle «Feed Preview» de la página de Notion del cliente. | Vigente |

## Clientes y meses

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-006 | 26/10/2026 | Una pestaña por cliente, con opción de crear clientes nuevos. Las publicaciones del mes se cargan desde Notion y debajo del mes a preparar se ve el mes anterior completo. | Vigente |
| D-007 | 26/10/2026 | Al lanzar la mesa se pregunta cuántos meses preparar. | Vigente |
| D-008 | 26/10/2026 | Las collabs de los dos clientes que comparten publicaciones están enlazadas: cambiar imagen, fecha u hora en una cambia la otra. | Vigente |
| D-009 | 26/10/2026 | Cambiar fecha u hora desde la mesa se actualiza en Notion al subir. Si cambia de semana, se renombra todo lo afectado y se actualiza la tabla semanal del mes. | Vigente |

## Publicaciones

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-010 | 26/10/2026 | Las publicaciones Foto admiten varias fotos para elegir portada. Solo se publica la primera. | Vigente |
| D-011 | 26/10/2026 | Cada publicación tiene «Contexto» (sube a Notion para los captions) y «Nota» (privada, no se sube), con un símbolo visible en la casilla. | Vigente |
| D-012 | 26/10/2026 | Los captions se escriben en la mesa (3 opciones, una por tono). A Notion sube solo el elegido. | Vigente |

## Editor de carruseles

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-013 | 26/10/2026 | Los carruseles se montan en el editor de la mesa, no en Canva. | Vigente |
| D-014 | 26/10/2026 | Los huecos de foto funcionan como plantilla: portada a sangre, interiores dentro del margen. La foto sigue editable y, si se borra, el hueco vuelve. | Vigente |
| D-015 | 26/10/2026 | La foto soltada rellena el área del hueco. | Sustituida por D-018 (26/10/2026) |
| D-016 | 26/10/2026 | Los selectores de color muestran solo el kit de marca del cliente, en las subsecciones que define cada kit, más #000000 y #FFFFFF. Ningún color fuera del kit; cada grupo del kit indica en qué selectores sale (fondo, texto, relleno, borde, velo). | Vigente |
| D-018 | 26/10/2026 | Encaje de fotos en los huecos (sustituye a D-015). La foto conserva siempre su proporción: en un hueco a sangre (portada) rellena, cubre la diapositiva centrada y recorta lo que sobra; en un hueco dentro del margen (interiores) se ajusta, entera, lo más grande que quepa en la caja y centrada, y las franjas muestran el fondo. Doble clic sobre la foto alterna: si cubre la caja pasa a ajustar y si deja franjas pasa a rellenar. La ampliación manual sigue con la proporción bloqueada y lo que sale de la diapositiva se recorta en su borde. Si el fondo es el provisional #2B231F, pasa a Ink #16110E al soltar la foto. Sustituir una foto aplica la misma regla y las fotos ya colocadas no se recolocan. | Vigente |
| D-019 | 27/10/2026 | Al cambiar el formato de las diapositivas (4:5, 3:4, 1:1, Horizontal), textos, formas y logos se recolocan siempre desde su sitio en el formato de partida, nunca desde el último. Al volver a ese formato, pasen por los que pasen, o con ⌘Z, lo que no se ha movido a mano queda exactamente como estaba. Lo movido a mano se queda donde se dejó. | Vigente |
| D-023 | 27/10/2026 | Imán, guías y atajos del editor, como en Canva. El imán («⋯», ⌘ lo apaga) actúa en los 8 tiradores (en una esquina, el eje cuyo borde esté más cerca; el otro sigue la proporción) y, solo mientras se arrastra o amplía, muestra la distancia en px de 1080 al vecino más cercano de cada lado (o al borde), marca e imanta espacios iguales y el mismo ancho o alto que otro elemento, y la línea de margen del kit. Un elemento girado, sin cotas. ⌥ al ampliar: desde el centro (⌥⇧ en esquina: sin proporción). «Guías» (⌘G): reglas en px de 1080 y guías del post, iguales en todas sus diapositivas y guardadas con él al aplicar; con el imán, imantan; cerradas, ni se ven ni imantan; nunca salen en la exportación, la vista previa ni el feed. Agrupar ⌥⌘G, desagrupar ⇧⌥⌘G; ⌥⌘C / ⌥⌘V copian y pegan el estilo de un texto (fuente, peso, tamaño, color, interlineado, espaciado, alineación y mayúsculas) en uno o varios textos del mismo cliente, sin tocar contenido, posición ni ancho, y se deshace con ⌘Z. Flechas: 1 px (⇧: 10 px). Ningún atajo actúa mientras se escribe en un texto. | Vigente |
| D-024 | 28/10/2026 | La bandeja del editor marca con «H» las fotos horizontales (más anchas que altas), con la misma regla y el mismo estilo que la bandeja de la mesa. | Vigente |
| D-025 | 28/10/2026 | Imán (completa D-023): las líneas de centro de la diapositiva, vertical y horizontal, salen en verde #00a651 y discontinuas; las demás líneas del imán (bordes, margen del kit, guías y vecinos) siguen en rosa y continuas. | Vigente |
| D-026 | 28/10/2026 | Borrar una diapositiva con la × de la tira: si tiene contenido (una foto o algún elemento; el fondo, el velo o la textura solos no cuentan), pregunta «¿Borrar la diapositiva N?» con «Cancelar» / «Borrar»; vacía, se borra directa. Después sale el aviso «Diapositiva N borrada» con «Deshacer», que equivale a ⌘Z mientras no haya otro cambio después. | Vigente |
| D-027 | 28/10/2026 | Con una foto o un hueco elegido, un chip junto a la selección da su proporción: el nombre de la lista del marco («4:5», «16:9»…, con un 1 % de margen) o «Libre · 1,37:1» (ancho:alto). Si la foto no tiene la proporción de su marco (está recortada): «Foto 3:2 · marco 4:3». El mismo dato sale en «Proporción del marco» cuando ningún botón queda marcado. Nunca sale en la exportación. | Vigente |
| D-028 | 28/10/2026 | ⌘D con un elemento elegido lo duplica, como antes; sin nada elegido duplica la diapositiva abierta y la pone detrás, abierta. Funciona como «Pegar diapositiva»: no avisa de foto repetida (D-022), un carrusel no pasa de 20 y la portada de un reel no se duplica. | Vigente |
| D-029 | 28/10/2026 | «Zona del grid» (⌘P, y en «⋯»): en la portada oscurece lo que el perfil de Instagram recorta al mostrarla en 3:4, centrado (4:5: 45 px de 1440 a cada lado; 1:1: 180; reel 9:16: arriba y abajo; 3:4: nada). Como las guías, nunca sale en la exportación, la vista previa ni el feed, y se recuerda en este navegador. Con el editor abierto, ⌘P nunca imprime. Ningún atajo actúa mientras se escribe en un texto (D-023). | Vigente |
| D-030 | 28/10/2026 | El área gris alrededor de la diapositiva es parte del editor. Un clic en vacío suelta la selección (y el encuadre de una foto). Arrastrar en vacío dibuja un rectángulo y elige lo que queda entero dentro; con ⇧ lo suma a lo elegido. Nunca elige elementos ocultos ni bloqueados sueltos; un grupo entra entero, como con un clic, cuando caben dentro todos sus elementos visibles. Doble clic en vacío: «Ajustar». Las fotos soltadas allí, de la bandeja o del ordenador, van a la diapositiva abierta, igual que al soltarlas en ella (D-018, D-022). Mientras se escribe en un texto, el área gris no actúa: el primer clic (o clic derecho) solo termina de escribir, y una foto del ordenador soltada allí no entra y avisa. Una lista desplegable con el foco no cuenta como escribir. | Vigente |
| D-031 | 28/10/2026 | Zoom y vista del editor. El pellizco del trackpad y ⌘ + rueda, sobre la diapositiva o el área gris, hacen zoom del editor hacia el puntero: el punto bajo el puntero se queda en su sitio. En ninguna parte del editor hacen zoom de la página. Encuadrando una foto, sobre ella siguen ampliando la foto. Espacio + arrastrar mueve la vista cuando hay zoom, con la mano como cursor, sin elegir ni mover nada; el espacio solo hace de mano con el puntero sobre la diapositiva o el área gris. Mientras se escribe en un texto no actúan: el pellizco no hace zoom y el espacio escribe. | Vigente |
| D-032 | 28/10/2026 | Clic derecho en el área gris: menú con «Pegar» (⌘V), «Pegar estilo» (⌥⌘V), «Añadir texto» (T) y «Añadir forma» (R, un rectángulo), con su atajo al lado; lo que no se puede usar sale apagado. Hacen lo mismo que sus atajos y botones, y lo añadido sale donde lo ponen los botones del panel. T y R son atajos nuevos (completan D-023) y, como todos, no actúan mientras se escribe en un texto. En la diapositiva, el clic derecho sigue siendo el del navegador. | Vigente |

## Marca

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-020 | 27/10/2026 | Nunca antetítulos (eyebrows): la línea corta en mayúsculas espaciadas encima del titular («CASE STUDY», «03 · …»). No aportan nada y delatan un diseño hecho con IA. Vale para todo lo de Uribe Visuals: carruseles, PDF, presentaciones y web. No son antetítulos las etiquetas del motor (marca, página, pie) ni la línea de datos bajo el titular, que se quedan. El color de acento va a uno de los datos de abajo. | Vigente |
| D-021 | 27/10/2026 | En el motor de «Diseñar», el pie de los interiores y el contacto del final llevan el color de acento del kit (de sus acentos de texto, el que más contraste da sobre su fondo), solo si llega a 3:1; si no, se quedan con el color de antes. La portada, la marca, el número y el pie del final no cambian. | Vigente |

## Mesa

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-017 | 26/10/2026 | La mesa completa se exporta e importa en un archivo para pasarla entre dos Macs, con fotos a 1080 px. | Vigente |
| D-022 | 27/10/2026 | Una foto ya usada se puede volver a usar: la mesa avisa y pregunta, nunca bloquea (antes se descartaba con «ya está en la mesa»). «Misma foto» = mismo nombre y tamaño, solo entre tableros del mismo cliente; está usada si va en una publicación (la bandeja y las canceladas no cuentan). Al ponerla en una casilla, un post, una diapositiva o un hueco, o al sustituir, sale solo su uso más cercano: esta diapositiva, este post, este mes (el tablero abierto), el mes anterior o «en la mesa en [mes]», con «Usar igualmente» / «Cancelar»; en un lote, una lista con «Usar todas» / «Saltar repetidas». No avisan importar a la bandeja (una foto que ya está en ella sin usar no se duplica), las casillas del mes anterior, «Diseñar», mover, pegar ni plantillas. El mes anterior cuenta solo si tiene tablero guardado: lo que viene de Notion no se compara. | Vigente |

## Discrepancias

Decisiones que el código o la skill no cumplen hoy, contrastadas el 26/10/2026 (mesa 3.34, libre 1.10). No se han corregido.

1. **D-005**: `MESA.render('clean', {month})` dibuja el mes a aprobar y, debajo, los meses anteriores del tablero y el mes anterior, separados por una franja (`mesa.js`, `M.render`; skill §5, «Imagen del feed»). No es solo el mes a aprobar.
2. **D-003**: esa misma imagen pone al principio 1 o 2 casillas grises en blanco cuando los meses posteriores no llenan una fila de 3 (`blankStart`), aunque no se hayan creado. Las negras («+ Hueco») sí salen solo si se crearon.
3. **D-002**: los huecos («+ Hueco») van arriba, pero detrás de las publicaciones fijadas (hasta 3), no en la primera casilla.
4. **D-016**: no todos los grupos indican sus selectores. En `kits/uribe.json`, «Base» y «Acentos» no tienen `usos`; en `kits/kamaya.json` ningún grupo lo tiene. Un grupo sin `usos` sale en todos los selectores.
5. **D-016 / D-018**: un hueco libre, sin foto, se exporta con su color de relleno (#2B231F en las plantillas) y su texto guía: «Aplicar» solo bloquea marcos de foto vacíos, no huecos. Si se borra la foto, el hueco vuelve con ese color.
6. **D-016 / D-018**: Ink #16110E es del kit de Uribe Visuals. En un cliente cuyo kit no lo tenga (hoy Kamaya), cambiar #2B231F por #16110E metería un color fuera de su kit.
7. **D-010**, por confirmar: la skill sube a Notion todas las páginas de una Foto de varias páginas, «igual que un carrusel» (§5). No queda claro si «programa» publica solo la primera.
