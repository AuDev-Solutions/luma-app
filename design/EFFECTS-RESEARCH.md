# Colección LUMA — 20 diseños para postes

Investigación e implementación: 29 de septiembre de 2026.

## Referencias y criterio

Se consultaron los [efectos oficiales de WLED](https://kno.wled.ge/features/effects/) y sus [paletas](https://kno.wled.ge/features/palettes/) para seleccionar movimientos que funcionen en una línea de píxeles. Los números de efecto se obtienen del dispositivo conectado. Se usa la paleta de dos colores elegidos, salvo Prisma y Color fijo.

[Philips Hue / Signify](https://www.signify.com/en-us/our-company/news/press-releases/2023/20230831-philips-hue-integrates-smart-lighting-sensors-and-cameras-to-help-secure-your-home) documenta Prism, Glisten y Opal para Festavia. Inspira la variedad entre espectros y destellos; LUMA no incorpora algoritmos ni recursos gráficos de Hue.

La [galería editable de Twinkly](https://help.twinkly.com/hc/en-gb/articles/18277872204573-how-do-i-edit-a-preset-effect) inspira el flujo de elegir, personalizar y aplicar. La selección de seis destacados es editorial: no se encontró una clasificación verificable de popularidad o uso. Se priorizan contraste a distancia, dirección vertical y variedad entre escenas tranquilas y llamativas.

No se incorporaron efectos de matrices 2D ni efectos que requieran micrófono. La vista del navegador aproxima el aspecto, mientras WLED ejecuta su propio algoritmo y temporización.

## Diseños y correspondencia física

| Diseño LUMA | Familia | Efecto WLED |
| --- | --- | --- |
| Aurora | Calma | Gradient |
| Color fijo | Calma | Solid |
| Ascenso | Movimiento | Comet / Meteor |
| Respiración | Calma | Breathe |
| Destellos | Destellos | Sparkle |
| Festiva | Fiesta | Chase |
| Océano | Calma | Pacifica |
| Fuego ámbar | Movimiento | Fire 2012 |
| Prisma | Fiesta | Rainbow |
| Atardecer | Calma | Gradient |
| Lluvia estelar | Movimiento | Rain |
| Luciérnagas | Destellos | Twinklefox |
| Nebulosa | Destellos | Twinklecat |
| Neón nocturno | Fiesta | Colorwaves |
| Onda esmeralda | Movimiento | Running |
| Vaivén | Movimiento | Sinelon |
| Ondas de luz | Movimiento | Ripple |
| Caramelo | Fiesta | Chase 2 |
| Luz de vela | Calma | Candle Multi |
| Nieve | Destellos | Twinkle |

Cada diseño incluye colores, brillo y velocidad iniciales. Seleccionar una tarjeta carga esos valores en la cara elegida; con «Ambas caras», los carga en las dos. Es posible ajustar y guardar una variante. Nada se envía al dispositivo hasta pulsar «Aplicar al poste».

## Revisión de interfaz

| Before | After | Why |
| --- | --- | --- |
| Seis tarjetas con una paleta compartida | 20 diseños con colores y velocidades propios | La selección produce una escena completa y distinguible |
| Una cuadrícula sin filtros | Selección, categorías, búsqueda y favoritos | Encontrar un ambiente sin recorrer toda la colección |
| Vista y botón de aplicar se pierden al desplazar | Vista compacta fija arriba y acciones abajo en móvil | Ver el resultado y aplicar desde cualquier parte del editor |
| Misma personalización para todos | Prisma identifica su espectro; Color fijo deshabilita velocidad | Evitar controles que prometan cambios inexistentes |
| Degradados calculados para cada LED y cada fotograma | Fondo y luces precalculados, miniaturas SVG estáticas | Reducir trabajo continuo en el teléfono |
| Pausa seguía redibujando | Cero redibujos en reposo; pausa al ocultar | Reducir carga y consumo |
| Montaje inicial de 50 | Montaje inicial de 100, con detección al conectar | Reflejar las dos tiras actuales en serie |

## Alcance de las comprobaciones

El catálogo fue comprobado en navegador y con un controlador simulado. La IP del controlador físico, 192.168.1.50, no respondió durante esta ampliación. Los 20 diseños no se han comprobado ópticamente en los LED; disponibilidad real depende del firmware y se indica al conectar.

## Paridad con WLED · 30 de septiembre de 2026

Revisión del firmware local (`WLED/wled00`, v17.0.0-devV5): `json.cpp` (`deserializeSegment`, selección `sel`/`mainseg`), `FX_fcn.cpp` (`Segment::setMode` con `fxdef`, `color_from_palette`) y los metadatos `_data_FX_MODE_*` de `FX.cpp`.

| Before | After | Why |
| --- | --- | --- |
| Edición iniciaba en «Todos los segmentos» y se enviaba `sel:true` a todos | Se edita el segmento seleccionado (el primero por defecto); solo ese queda `sel` y es `mainseg` | En WLED, color y efecto actúan sobre los segmentos seleccionados; un color fijo ya no se extiende a todo el poste |
| Intensidad fija 128 y paleta genérica «Colors 1&2» | Valores por efecto de `/json/fxdata` (c1–c3, o1–o3), intensidad propia y paleta afinada | WLED carga estos valores al cambiar de efecto; con ellos Fuego usa la paleta Fire (con negro), Océano las paletas propias de Pacifica, Gradient su amplitud 16 y Vela su parpadeo 224 |
| Sin selector de paleta | 15 paletas nativas resueltas por nombre desde el controlador | Cada efecto se combina con cualquier paleta, igual que en WLED |
| Sin control de intensidad ni de dirección | Deslizador con la etiqueta del efecto (Estela, Chispas, Gotas…), «Invertir dirección» (`rev`) y «Espejo desde el centro» (`mi`) | Parámetros que WLED expone por efecto y por segmento |

Nuevos diseños (10): Goteo (Drip), Estallido (Fireworks Starburst), Aurora boreal (Aurora), Latido (Heartbeat), Tormenta (Lightning), Radar (Scanner), Plasma (Plasma), Malabares (Juggle), Bloques (Tetrix), Rebotes (Bouncing Balls). Todos son 1D, no requieren micrófono y existen en el firmware v17. Se deshabilitan si el controlador no los incluye.

Verificación: 23 pruebas unitarias y compilación de producción. En Chromium, a 1440 px y 390 px, con un controlador simulado: el color fijo en Cara A no altera Cara B, el payload solo selecciona el segmento editado, Fuego envía la paleta 35 y `c2=128` desde fxdata, y no hay desbordamiento ni errores de página. Capturas: `output/playwright/wled-parity-*.png`. El ESP32 (192.168.1.50) no respondió, así que estos cambios no se han enviado ni se han comprobado ópticamente en los LED.
