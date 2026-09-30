# Segmentos y transición

El editor aparece antes de los diseños. Permite hasta 16 segmentos, limitado también por la capacidad comunicada por el controlador. «Dividir segmento» conserva el diseño de las dos mitades. Cada grupo tiene nombre y rango editable; «Todos los segmentos» aplica los siguientes ajustes a todos. Los rangos son inclusivos para la persona: 1–25 corresponde a `start:0, stop:25` en WLED. No se admiten superposiciones. Los huecos se representan apagados.

La transición se presenta en segundos (0–10 en el control habitual; si se importa un valor mayor, el control lo conserva hasta 65). Es global, se guarda con la escena y se convierte a décimas al enviar. Suaviza cambios de color/brillo; cambiar los límites de un segmento reinicia su animación y no garantiza un fundido de la geometría. El borrador continúa siendo una aproximación del efecto; «Poste en vivo» muestra los datos recibidos de la ESP32.

La implementación sigue la [API JSON oficial de WLED](https://kno.wled.ge/interfaces/json-api/). El adaptador envía límites, ajustes de cada segmento y transición en una solicitud. Los IDs del dispositivo se compactan para evitar que la eliminación por lotes de WLED renumere segmentos supervivientes. Los segmentos anteriores sobrantes se eliminan con `stop:0`. Después se comprueban los rangos, efectos, colores, brillo, paleta y transición devueltos por el controlador. No cambia cantidad de LEDs, GPIO ni configuración eléctrica.

| Before | After | Why |
| --- | --- | --- |
| Solo cara A / cara B | Mapa de rangos y selección por segmento | Permitir varios diseños dentro de una misma tira |
| Transición fija de 0,4 s | Deslizador en segundos y accesos rápidos | Ajustar el fundido sin abandonar LUMA |
| Simulación por cara completa | Mapa de LED físico a segmento, calculado al cambiar el rango | Mantener coherencia espacial sin búsquedas por LED en cada fotograma |
| Escenas limitadas a dos caras | Segmentos y transición guardados; migración de escenas anteriores | Conservar diseños existentes |

Validación: 19 pruebas automatizadas aprobadas y compilación de producción correcta. El recorrido de navegador `output/playwright/verify-segments.js` usa un controlador simulado y verifica selección independiente, rangos, transición de 2 s, bloqueo de solapamientos, guardado/carga, eliminación y ausencia de errores de React. Inspección a 320, 390 y 1440 px sin desbordamiento horizontal; capturas móvil/escritorio revisadas. Consulta de solo lectura a la ESP32 confirmó 100 LEDs y capacidad de 64 segmentos; LUMA limita su editor a 16. Esta entrega no alteró el efecto que estaba reproduciendo el poste físico.
