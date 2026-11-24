# Módulo 03 · A-Frame: Mirador de la camanchaca

Escena inmersiva en realidad virtual hecha con A-Frame (arquitectura Entity-Component). El usuario está en un cerro del norte frente a un atrapanieblas, mientras la niebla avanza desde el mar.

## Interacción

- **Mirar alrededor**: arrastra con el mouse, mueve el celular o usa un visor VR.
- **Hotspots (gaze)**: al mirar fijo un punto naranja durante 1,5 s (o al hacerle clic) se abre un panel con información sobre la camanchaca, Carlos Espinosa y la patente cedida a la UNESCO.
- **Audio espacial**: el viento (`viento.mp3`) sale desde el lado del mar y suena distinto según hacia dónde mires.

## Tecnologías

- **A-Frame 1.5.0**: entidades, `a-cursor` con *fuse* (gaze), `sound` posicional
- Componentes propios: `hotspot` (muestra y oculta los paneles) y `neblina` (anima la niebla)
- `viento.mp3` es un sonido de viento generado por código (ruido filtrado), sin derechos de terceros
