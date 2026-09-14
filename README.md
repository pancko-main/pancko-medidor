# Pancko Medidor V0.4 experimental

PWA estática y local para calcular superficies mediante:

1. cámara + referencia física conocida;
2. foto/captura + referencia física o dimensiones conocidas;
3. medidas manuales de pared, piso, pileta rectangular y solárium.

No utiliza WebXR, ARCore, backend ni servicios externos. Está preparada para publicarse en GitHub Pages.

## Regla física fundamental

La referencia y la superficie deben estar en el **mismo plano físico**. Una placa apoyada contra la pared es válida. Un portón hundido o adelantado respecto de la fachada puede introducir un error sistemático que la homografía no puede corregir.

El método corrige la perspectiva de un plano, pero no reconstruye una escena 3D. Cámara y foto producen estimaciones geométricas, no mediciones profesionales certificadas.

## Cambios V0.4

- homografía reforzada mediante normalización previa de coordenadas;
- validación explícita de puntos duplicados, cuadriláteros no convexos, referencias degeneradas y transformaciones casi singulares;
- orden estable de vértices para cualquier punto inicial o sentido de marcado;
- ancho y alto calculados como promedio de los lados opuestos en el plano rectificado;
- zoom máximo de 600 % y nuevo acceso rápido 600 %;
- lupa generada desde la fotografía limpia: ya no muestra números ni nodos;
- retícula central fina y de alto contraste;
- posicionamiento de lupa corregido con paneo y clamp sobre la zona realmente visible;
- validación independiente de ancho, alto y superficie reales;
- advertencia destacada cuando la referencia ocupa muy pocos píxeles;
- advertencia cuando los descuentos manuales superan el área bruta;
- caché PWA actualizado a `pancko-medidor-v0.4.0`;
- 30 pruebas automáticas dirigidas más 1.000 proyecciones deterministas ejecutadas en cada test.

## Motor geométrico

`geometry.js` implementa sin dependencias:

- orden y validación de cuadriláteros;
- solución de homografía de cuatro correspondencias;
- normalización numérica de coordenadas;
- transformación imagen → plano métrico;
- área por fórmula del polígono;
- dimensiones por promedio de lados opuestos;
- evaluación geométrica orientativa de la toma;
- funciones puras para pared, pileta, solárium y comparación real.

`editor-utils.js` contiene el cálculo puro de posición de la lupa para poder probar sus límites sin depender del navegador.

## Ejecutar tests

Con Node.js instalado, desde la carpeta del proyecto:

```bash
npm test
```

El banco cubre perspectiva leve/fuerte, posiciones y tamaños de referencia, 24 permutaciones de vértices, duplicados, degeneración, relaciones de aspecto, A4 vertical/horizontal, recuperación proyectiva, resolución, calidad, cálculos manuales y lupa en bordes con/sin paneo.

También puede abrirse `tests/geometry-tests.html` para una comprobación básica en navegador.

## Publicar en GitHub Pages

Subir **el contenido de esta carpeta** a la raíz del repositorio `pancko-medidor`, reemplazando la versión anterior. Las rutas son relativas y funcionan bajo `/pancko-medidor/`.

Después de publicar, recargar la aplicación. El service worker V0.4 elimina cachés anteriores durante la activación. Si el teléfono conserva temporalmente la versión anterior, cerrar la PWA, abrir la URL en Chrome y recargar una vez.

## Protocolo físico inicial

1. Medir con cinta una pared interior de aproximadamente 3 × 2,5 m.
2. Colocar una hoja A4 completamente plana contra esa pared.
3. Realizar al menos tres fotos casi frontales y registrar ancho, alto y área.
4. Repetir con la misma pared desde aproximadamente 25–30°.
5. Para una fachada grande, usar una referencia mayor que A4 y medir sus dos dimensiones con cuidado.
6. Completar en la app los datos reales disponibles y comparar error y repetibilidad.

## Limitaciones conocidas

- una referencia pequeña magnifica el error de colocar los vértices;
- lente gran angular, desenfoque y compresión pueden introducir error físico;
- Street View puede sumar distorsión panorámica y stitching;
- objetos fuera del plano de referencia no se miden correctamente;
- todavía no existe historial de calibraciones ni marcado visual de aberturas.
