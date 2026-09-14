# Informe de pruebas — Pancko Medidor V0.4

Fecha: 14 de septiembre de 2026.

## Resultado automático

- 31/31 grupos de pruebas aprobados.
- El grupo 31 contiene 1.000 proyecciones sintéticas deterministas.
- Sintaxis validada para `geometry.js`, `editor-utils.js`, `app.js` y el runner de tests.
- 53 referencias a elementos de interfaz contrastadas contra el HTML, sin IDs faltantes.
- Manifest, rutas relativas, recursos precacheados y versión del service worker verificados.

## Matemáticamente validado

- recuperación exacta, dentro de tolerancia numérica, de superficies planas proyectadas;
- perspectiva frontal, leve y fuerte en casos sintéticos;
- referencia central, lateral, en esquina, pequeña y muy menor que la superficie;
- independencia respecto del orden de ingreso de las cuatro esquinas;
- conservación de los ejes ancho/alto en A4 vertical y horizontal;
- rechazo de duplicados, colinealidad y configuraciones casi singulares;
- área de cuadriláteros no perfectamente rectangulares;
- pared con varios descuentos, pileta y solárium;
- clamp de la lupa en los cuatro bordes, con y sin paneo.

## Requiere validación física

- error introducido al ubicar manualmente cada vértice;
- influencia de desenfoque, compresión y distorsión de lente;
- tamaño práctico mínimo de una referencia según distancia;
- repetibilidad entre fotografías de una misma superficie;
- comodidad real de zoom, paneo y lupa en Xiaomi Redmi Note 14 Pro+ 5G;
- diferencia entre toma frontal y toma a 25–30°.

La validación matemática separa errores del algoritmo de los errores físicos de toma, pero no permite asignar todavía una precisión general a la aplicación.
