# Módulo 02 · AR.js: Atrapanieblas en tu mesa

Ejercicio de realidad aumentada web con marcador (*marker-based*). Al apuntar la cámara al marcador **Hiro** aparece un atrapanieblas en miniatura: las gotas de la camanchaca bajan por la malla y el agua del estanque sube y baja.

## Cómo usarlo

1. Imprime **`hiro.png`** (incluido en esta carpeta) o ábrelo en otra pantalla, como un celular o una tablet.
2. Abre la página en el celular o el computador y acepta el permiso de cámara.
3. Apunta la cámara al marcador. El modelo 3D aparece encima.

> Necesita `https://` (GitHub Pages) o `localhost` para usar la cámara.

## Tecnologías

- **AR.js 3.4.5** (seguimiento de marcadores)
- **A-Frame 1.3.0**, construido sobre **Three.js**
- Dos componentes propios en JavaScript: `gotas` (anima las partículas de agua con Three.js) y `nivel-agua` (anima el estanque)
