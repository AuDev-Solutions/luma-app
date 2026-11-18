# LUMA · Control de iluminación

Interfaz móvil y de escritorio para luces WS2811. Una tira de prueba de 50 píxeles, dos caras de 50 (100 en total) o poste de dos caras de 200 (400 en total). Aplicación independiente del repositorio WLED.

## Ejecutar

```powershell
cd luma-app
npm install
npm start
```

Abrir http://localhost:5173. Desde el celular, conectado a la misma Wi-Fi del computador, usar la dirección LAN que Vite muestra al iniciar. El equipo debe permitir el puerto 5173 en esa red. `npm start` compila y sirve los archivos optimizados; `npm run build` produce `dist/`; `npm run preview` sirve una compilación existente. `npm run dev` se reserva para desarrollo en el puerto 5174. `npm test` valida el adaptador y los modelos.

La vista previa utiliza un fondo estático y sprites de luz reutilizados. La animación se suspende al pausar, ocultar la pestaña o desplazar la vista fuera de pantalla; el color fijo solo se redibuja cuando cambia un ajuste. La resolución interna se limita a 2×. En vistas estrechas se enfatiza el ancho de los LED y se reduce el halo vertical para distinguir los colores; la vista ampliada permite examinar una o ambas caras. Estos cambios no alteran los efectos que ejecuta WLED.

## Instalar LUMA dentro del poste (sin PC)

```powershell
npm run build:poste                              # un solo archivo comprimido (~207 KB) en dist-poste/
npm run instalar:poste -- 192.168.1.50          # añade PIN al final si el poste tiene uno
```

Luego abre `http://<ip-del-poste>/luma.htm` (en el Wi-Fi propio del poste: `http://4.3.2.1/luma.htm`). Se conecta sola y se puede añadir a la pantalla de inicio del teléfono. Instalada el 30-09-2026 en el poste 192.168.1.50.

## Pruebas

- `npm test`: 35 pruebas de lógica (segmentos, paletas, presets, horario, límites, temas).
- `npm run test:e2e`: 7 recorridos en Chromium contra un poste simulado (4 colores, deshacer, temas, guardar en el poste, modo automático, horario, límite de corriente, en vivo, móvil). Usa `LUMA_CHROME` o el Chromium de Playwright instalado.

## Novedades (30-09-2026)

- **Escenas en el poste**: al guardar, la escena queda también en el controlador (disponible desde cualquier teléfono). Se escriben subiendo `presets.json`, sin cambiar las luces al guardar. Mostrar, editar, eliminar y elegir la escena **al encender**.
- **Modo automático**: rota escenas del poste cada N minutos, sin teléfono conectado.
- **Horario**: encender al anochecer (con ubicación) o a una hora, y apagar a una hora. El poste no tiene reloj con pila: con internet en su Wi-Fi mantiene la hora; si no, LUMA le da la hora del teléfono al conectar. La zona horaria se toma del teléfono.
- **Temas**: Navidad, Noche de invierno, Año nuevo, Halloween, Amor y amistad, Fiestas patrias, Blanco cálido, Fiesta.
- **Brillo general**, **En vivo** (cada cambio llega al instante), **Deshacer/Rehacer** (Ctrl+Z / Ctrl+Y), tercer color y paletas «Degradado de tus 3 colores» y «Tus 3 colores en bandas».
- **Mi montaje › Consumo**: corriente estimada y límite; el límite se calcula con el 85 % de los amperios de la fuente. **Seguridad**: estado del Wi-Fi propio y de las actualizaciones remotas, enlace a los ajustes avanzados y PIN de ajustes.
- Recuerda el poste y se reconecta al abrir. Instalable como app (manifest + service worker en https/localhost).

## Estado del hardware (05-10-2026)

- PCB con ESP32-S3, firmware WLED 17.0.0-devV5. Dos caras de 100 LEDs WS281x: **cara A en GPIO 17** (LED 1–100, driver RMT) y **cara B en GPIO 3** (LED 101–200, **driver I2S**, `"drv":1`; el GPIO 18 de la PCB no da señal). Con las dos salidas en RMT este firmware solo emite por la primera: la segunda salida debe ir en I2S.
- **Las dos caras muestran siempre lo mismo, en todos los efectos.** Las dos salidas empiezan en el LED 1 (`"start": 0` en ambas): WLED envía cada píxel a las dos salidas que lo contienen, así que la cara B repite a la cara A LED por LED, incluidos los efectos aleatorios (destellos, fuegos artificiales, lluvia, fuego…), que con un segmento por cara se verían distintos. WLED ve 100 LEDs; la vista de LUMA muestra un solo poste. Si el poste tiene la cara B en los LED 101–200, LUMA la cambia sola al conectarse (conserva pines, drivers y límites). Con cable continuo en un solo pin no es posible: ahí LUMA copia la escena en un segmento por cara.
- Funciona solo, sin red de casa: Wi-Fi propio «LUMA-Poste1», siempre activo, en http://4.3.2.1 (LUMA es la página principal). Solo 2,4 GHz: el ESP32 no se conecta a redes de 5 GHz.
- Para instalar una versión nueva de LUMA desde el PC hay que alcanzar el poste: unirse a su red un momento o añadirle una red de 2,4 GHz y quitarla al terminar (si busca una red que no encuentra, su red propia se vuelve inestable).
- Si un cambio de «LED & Hardware» no se aplica, reinicia cortando la corriente: el poste puede ignorar el reinicio por software y lee `cfg.json` al arrancar.
- **Límite de corriente desactivado** (`maxpwr: 0`): configúralo en Mi montaje › Consumo con los amperios reales de la fuente.
- Sin hora tras un corte de luz (no tiene internet ni reloj con pila): pendiente añadir RTC DS3231 o fotocelda.

## Incluido

- Vista animada de ambas caras, selección de cara, pausa y apagado de la vista previa.
- 32 diseños con paletas y velocidades propias, selección recomendada, categorías, búsqueda sin distinción de acentos y favoritos guardados en este navegador. Catálogo y fuentes en `design/EFFECTS-RESEARCH.md`.
- En móvil la vista del poste se desplaza con la página para dejar espacio al editor. «Ver poste», junto a las acciones inferiores, abre la vista ampliada y devuelve el foco al mismo botón sin perder la posición de edición. Miniaturas estáticas para evitar animaciones simultáneas innecesarias. Prisma utiliza su espectro propio; Color fijo deshabilita velocidad.
- Montaje inicial: una cara de 100 LEDs en un pin de datos. También dos caras de 100 (200), una tira de 50, dos tiras de 50 o dos caras de 200. Los WS2811 no informan cuántos hay conectados: LUMA lee la cantidad configurada en WLED. En «Mi montaje», con el poste conectado, «Ya conecté la segunda cara» cambia la salida de WLED de 100 a 200 LEDs en el mismo pin (conserva pin, tipo, orden de color y límite de corriente) y «Volver a detectar» relee la cantidad. «La cara B empieza arriba» ajusta la vista cuando la segunda tira continúa el cable desde lo alto.
- Editor en pestañas Colores · Efectos · Segmentos. Colores: rueda de color con luminosidad, código hexadecimal, colores rápidos y aleatorio, y ranuras Principal/Fondo. Con varias partes, la barra «Editando» elige qué parte se edita desde cualquier pestaña; «Partir en partes iguales» (2–6) asigna un color a cada parte, y con «Todos» un efecto mueve cada parte en su propio color.
- Editor de hasta 16 segmentos: dividir, renombrar, ajustar rangos, eliminar y seleccionar diseños independientes. Transición global en segundos y accesos rápidos. Se guardan rangos y transición con la escena. Detalles en `design/SEGMENTS.md`.
- Escenas guardadas, recuperadas y eliminadas en localStorage (máximo 12). El borrado de datos del navegador elimina esas escenas.
- Conexión HTTP a WLED: consulta `/json`, valida información y efectos, envía cambios explícitos con POST a `/json/state` y vuelve a leer el estado para confirmar que el controlador los aceptó.
- Estado demostración por defecto. No se buscan equipos ni se envían comandos automáticamente.

## Conectar hardware

1. Instalar una versión de WLED compatible con la placa exacta ESP32-S3 N16R8 y configurar las salidas físicas desde WLED. Esta app no flashea ni configura GPIO.
2. Configurar la cantidad física real de píxeles en WLED: 50, 100 o 400. LUMA importa los segmentos con efectos reconocidos al conectar. En «Segmentos» se pueden dividir y editar los rangos antes de aplicar; no es necesario crearlos primero en WLED. La app no cambia GPIO ni número de LED.
3. Unir teléfono y controlador a la misma red. Abrir Conectar poste, indicar la IP y conectar. En el AP predeterminado de WLED, la dirección habitual es `4.3.2.1`; en la Wi-Fi de casa se usa la IP asignada por el router. Al conectar, «Poste en vivo» recibe los colores del controlador y carga sus ajustes reconocidos. La etiqueta de conexión identifica el dispositivo; la etiqueta de la vista indica si llegan cuadros.
4. Seleccionar un segmento o «Todos los segmentos», elegir sus diseños y ajustar «Transición». Pulsar Aplicar al poste para enviar la distribución completa y comprobar la respuesta del controlador. Brillo global se normaliza a 255 y brillo por segmento refleja el porcentaje elegido. La limitación de corriente debe estar configurada previamente en WLED.

El navegador debe permitir HTTP a la red local. Una app publicada con HTTPS puede bloquear conexiones a un WLED HTTP; el despliegue final requiere servir desde el controlador o una solución local compatible, todavía pendiente. La instalación dentro de la flash/firmware de la ESP32 no forma parte de esta primera entrega. Los archivos estáticos pueden compilarse sin servidor de aplicación, pero requieren integrar su alojamiento y rutas.

## Límites explícitos

«Borrador» simula la intención visual y no reproduce exactamente los algoritmos de WLED. «Poste en vivo» dibuja los RGB recibidos por WebSocket `/ws` mediante Peek (`lv:true`), sin sustituirlos por el simulador si se pierde la señal. Al editar se muestra el borrador; al aplicar correctamente se vuelve al poste en vivo. Hay latencia de red y diferencias ópticas entre pantalla y LED. WLED entrega Peek a un solo navegador a la vez: el otro mostrará falta de señal y podrá reconectar. Las asociaciones de los 20 diseños están en `design/EFFECTS-RESEARCH.md`. Los IDs se resuelven desde el controlador, no se presuponen; los diseños ausentes se deshabilitan al conectar. Se verifican también paleta, intensidad y ambos colores al aplicar. Algunos parámetros no son usados por todos los efectos físicos.

Guardar escena conserva ajustes en este navegador y, si se marca, también en el poste. No hay Bluetooth, nube, efectos con música ni sincronización entre postes. Desconectar la app conserva el estado del poste.

Fuentes del contrato: https://kno.wled.ge/interfaces/json-api/ y https://kno.wled.ge/interfaces/websocket/

Diseño: `design/concept.png`, brief y decisiones en `design/DESIGN.md`. Identidad provisional LUMA.
