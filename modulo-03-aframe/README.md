# Módulo 03 · A-Frame: Mirador de la camanchaca

Escena inmersiva en realidad virtual 360°, hecha con A-Frame (arquitectura Entity-Component-System). El visitante está en un cerro de la costa del norte de Chile, frente a un atrapanieblas, mientras la camanchaca avanza desde el mar.

Demo: https://juandomingoo.github.io/unidad-3-ejercicios/modulo-03-aframe/

## Interacción

- **Mirar alrededor**: arrastrar con el mouse, mover el celular o usar un visor VR (botón de gafas abajo a la derecha).
- **Gaze (mirada fija)**: mirar un punto naranjo durante 1,5 s, o hacerle clic, abre un panel con parte de la historia. El punto se vuelve azul cuando ya se descubrió.
- **Recorrido**: un contador fijo en la vista muestra cuántos de los 4 puntos se han descubierto. Al completarlo, el estanque se llena, el cerro florece y aparece un mensaje final.
- **Audio espacial**: el viento sale desde el mar, así que suena distinto según hacia dónde se mire. Empieza al pulsar **Entrar al mirador**, porque los navegadores bloquean el audio hasta que el usuario interactúa.

## Los 4 puntos

1. **La camanchaca**: qué es la niebla costera.
2. **El inventor**: Carlos Espinosa Arancibia y la sequía de 1956 en Antofagasta.
3. **Cómo funciona**: malla, canaleta y estanque, sin energía.
4. **El legado**: la patente cedida a la UNESCO.

## Tecnologías y componentes propios

- **A-Frame 1.5.0** (sobre Three.js): `a-cursor` con *fuse*, `sound` posicional y modo VR.
- `terreno`: relieve low-poly generado por código, con costa y cerro.
- `mar`: oleaje animado moviendo los vértices.
- `camanchaca`: 1.400 partículas de niebla que avanzan desde el mar.
- `atrapanieblas`: malla, gotas que escurren y estanque con nivel animado.
- `panel`: tarjetas dibujadas en canvas (soportan tildes y ñ) que siempre miran a la cámara.
- `hotspot` y `recorrido`: lógica de descubrimiento, contador y final.
- `flores`: el cerro florece al completar el recorrido.
- `viento.mp3`: sonido de viento generado por código (ruido filtrado), sin derechos de terceros.
