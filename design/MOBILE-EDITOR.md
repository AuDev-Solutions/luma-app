# Acceso a los controles en celular

El problema era el panel de vista previa fijo: al combinar el lienzo alto con el selector de origen y la barra inferior, la zona disponible para editar se reducía a unos pocos campos. La comprobación anterior de ausencia de desbordamiento horizontal no detectaba esta obstrucción vertical.

| Before | After | Why |
| --- | --- | --- |
| Poste fijo sobre los controles móviles | Panel en el flujo normal de la página | Aprovechar la altura disponible al desplazarse hacia segmentos y diseños |
| Espacio de desplazamiento superior de más de 400 px | Margen superior de 12 px | Evitar una zona reservada para un panel que ya no queda fijo |
| Abrir la vista grande solo desde el lienzo | «Ver poste» siempre accesible en la barra inferior | Consultar la escena desde cualquier parte del editor |
| Cierre devolvía el foco al lienzo superior | Foco al botón que abrió la vista, sin desplazamiento | Continuar editando donde estaba la persona |
| Campos numéricos móviles de 13 px | Campos de 16 px | Mejorar legibilidad al introducir rangos |

Validación con `output/playwright/verify-mobile-editor.js`: pantallas de 320×740, 390×844, 430×932 y 740×390, además de apertura/cierre desde escritorio. Se comprueba que el panel móvil no sea sticky, que el punto central del campo reciba el toque y que la barra inferior no lo cubra; también selección de diseño, transición, posición/foco tras cerrar y ausencia de errores de JavaScript o desbordamiento horizontal. Capturas `mobile-editor-fixed.png` y `mobile-gallery-fixed.png` revisadas visualmente. Prueba de interfaz en navegador con emulación móvil, sin enviar comandos al poste físico.
