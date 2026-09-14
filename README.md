# Pancko Medidor V0.3

PWA estática para medir superficies por:

1. **Cámara + referencia física conocida**
2. **Foto/captura + referencia física**
3. **Medidas manuales**: pared/fachada, piso, pileta rectangular y solárium

No usa WebXR ni ARCore.

## Publicar en GitHub Pages

1. Crear un repositorio nuevo, por ejemplo `pancko-medidor`.
2. Subir **el contenido de esta carpeta** a la raíz del repo.
3. En GitHub: `Settings → Pages`.
4. Elegir `Deploy from a branch`.
5. Seleccionar `main` y `/ (root)`.
6. Abrir la URL HTTPS que entrega GitHub Pages.

La cámara (`getUserMedia`) requiere HTTPS o localhost, por eso conviene probarla directamente desde GitHub Pages.

## Cómo probar la medición por referencia

1. Pegá una hoja A4 plana contra una pared.
2. Sacá una foto donde se vea la hoja y toda la pared.
3. Marcá las 4 esquinas de la hoja en este orden:
   - arriba izquierda
   - arriba derecha
   - abajo derecha
   - abajo izquierda
4. Marcá las 4 esquinas de la pared en el mismo orden.
5. Calculá.
6. Compará contra una medida real usando el bloque de calibración.

### Reglas importantes

- La referencia y la superficie deben estar en **el mismo plano físico**.
- Para fachadas grandes, una hoja A4 puede quedar demasiado pequeña. Usá una referencia rectangular mayor y cargá su ancho/alto.
- El resultado de cámara/foto es una **estimación**, no una medición profesional certificada.
- Street View debe tratarse como estimación por sus posibles deformaciones panorámicas.

## Motor geométrico

`geometry.js` implementa en JavaScript puro:

- solución de homografía de 4 puntos;
- transformación proyectiva imagen → plano métrico;
- área de polígonos;
- dimensiones promedio de cuadriláteros;
- detección básica de puntos cruzados;
- evaluación geométrica simple de calidad.

No depende de OpenCV ni librerías externas, así que la PWA puede funcionar offline después de la primera carga.

## V0.1 — qué incluye

- cámara trasera con captura;
- fallback a carga de imagen;
- A4 como referencia;
- referencia rectangular personalizada;
- modo foto con ancho/alto conocidos;
- editor táctil con puntos arrastrables;
- zoom visual;
- homografía;
- comparación contra área real;
- pared/fachada con múltiples descuentos;
- piso;
- pileta rectangular;
- solárium uniforme o por lados;
- service worker + manifest instalable.

## Pendiente para versiones siguientes

- aberturas marcadas directamente sobre foto;
- marcador Pancko / ArUco / AprilTag;
- detección automática;
- OpenCV.js opcional;
- mejor análisis de desenfoque;
- historial de pruebas;
- formas irregulares;
- rendimiento, litros, envases y productos.


## Cambios V0.2
- Las 4 esquinas pueden tocarse en **cualquier orden**.
- El motor normaliza los vértices antes de calcular la homografía.
- Se evita intercambiar ancho/alto por empezar a marcar desde otra esquina.
- Con zoom > 100 %, podés **arrastrar el fondo de la imagen para desplazarte**.
- Los puntos continúan siendo arrastrables para ajuste fino.

**Precisión:** la referencia debe estar físicamente sobre el mismo plano. Un portón o una puerta hundidos respecto de la fachada pueden introducir error.


## Cambios V0.3
- Zoom ampliado hasta **450 %**.
- Botones rápidos de zoom: **100 / 200 / 300 / 450**.
- **Lupa flotante** al arrastrar un vértice para que el dedo no tape el punto.
- Mejor resaltado del vértice activo durante el ajuste fino.
