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

## Mesa

| ID | Fecha | Regla | Estado |
|---|---|---|---|
| D-017 | 26/10/2026 | La mesa completa se exporta e importa en un archivo para pasarla entre dos Macs, con fotos a 1080 px. | Vigente |

## Discrepancias

Decisiones que el código o la skill no cumplen hoy, contrastadas el 26/10/2026 (mesa 3.34, libre 1.10). No se han corregido.

1. **D-005**: `MESA.render('clean', {month})` dibuja el mes a aprobar y, debajo, los meses anteriores del tablero y el mes anterior, separados por una franja (`mesa.js`, `M.render`; skill §5, «Imagen del feed»). No es solo el mes a aprobar.
2. **D-003**: esa misma imagen pone al principio 1 o 2 casillas grises en blanco cuando los meses posteriores no llenan una fila de 3 (`blankStart`), aunque no se hayan creado. Las negras («+ Hueco») sí salen solo si se crearon.
3. **D-002**: los huecos («+ Hueco») van arriba, pero detrás de las publicaciones fijadas (hasta 3), no en la primera casilla.
4. **D-016**: no todos los grupos indican sus selectores. En `kits/uribe.json`, «Base» y «Acentos» no tienen `usos`; en `kits/kamaya.json` ningún grupo lo tiene. Un grupo sin `usos` sale en todos los selectores.
5. **D-016 / D-018**: un hueco libre, sin foto, se exporta con su color de relleno (#2B231F en las plantillas) y su texto guía: «Aplicar» solo bloquea marcos de foto vacíos, no huecos. Si se borra la foto, el hueco vuelve con ese color.
6. **D-016 / D-018**: Ink #16110E es del kit de Uribe Visuals. En un cliente cuyo kit no lo tenga (hoy Kamaya), cambiar #2B231F por #16110E metería un color fuera de su kit.
7. **D-010**, por confirmar: la skill sube a Notion todas las páginas de una Foto de varias páginas, «igual que un carrusel» (§5). No queda claro si «programa» publica solo la primera.
