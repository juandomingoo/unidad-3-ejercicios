> **Módulo 01 · Interacción Natural (NUI) con MediaPipe**: ejercicio de la Unidad 3 del Taller de Diseño de Interfaces.
> Demo: https://juandomingoo.github.io/unidad-3-ejercicios/modulo-01-mediapipe/
>
> Archivos: `index.html` + `style.css` + `app.js` (código que corre). La carpeta `src/` tiene el mismo código separado por partes (configuración, mundo, personajes, creación, entrada de gestos, juego, HUD) para leerlo con más facilidad.

# Crónicas del Santuario: RPG en tercera persona con gestos

Juego de rol de fantasía en 3D (**Three.js** v0.187) que se controla con las manos gracias a **MediaPipe Gesture Recognizer** (`@mediapipe/tasks-vision` v1.2.3). Todo se procesa en tu navegador.

## Misión
El santuario perdió sus 8 cristales. Recórrelos por el bosque, derrota a sus guardianes y llévalos de vuelta. Basta con caminar sobre un cristal para recogerlo; se entrega solo al entrar en el santuario. Dentro del círculo brillante estás a salvo: los enemigos no pueden entrar y tu vida se regenera rápido.

## Creación de personaje
- **Razas:** Humano, Enano, Elfo, Orco y No-muerto. Cada una tiene su físico y una bonificación.
- **Clases:** Guerrero (Torbellino), Mago (Nova de escarcha), Cazador (Descarga múltiple) y Paladín (Luz sagrada).
- **Apariencia:** tono de piel, peinado, color de pelo, barba, color de armadura y capa.

## Control con gestos
**La posición de la mano mueve al personaje y la forma de la mano decide la acción**, así que puedes caminar mientras atacas.

| Mano | Acción |
|---|---|
| Moverla arriba / abajo | Avanzar / retroceder |
| Moverla a izquierda / derecha | Girar |
| ✋ Abierta | Solo moverse |
| ✊ Puño | Ataque básico (mantén el puño para repetir) |
| ✌️ Victoria | Habilidad de clase |
| ☝️ Índice arriba | Correr |
| 👍 Pulgar arriba | Saltar |
| 👎 Pulgar abajo | Poción |
| 🤟 Te quiero | Día / noche (de noche los enemigos son más fieros) |

Si el personaje se mueve solo, coloca la mano donde la tengas cómoda y pulsa **⊕ Recentrar mano**.

**Teclado:** WASD para moverte, Shift para correr, Espacio para saltar, J o clic para atacar, K para la habilidad, R para la poción, N para día/noche, Esc para pausar y ver la ayuda. Clic derecho y arrastrar para girar.

## Enemigos
- **Trasgo saqueador:** rápido y débil.
- **Chamán de la ceniza:** ataca a distancia con bolas de fuego.
- **Gólem de sombra:** lento y muy resistente.

Cada cristal tiene guardianes, y cada cierto tiempo llegan partidas de enemigos a cazarte. Cuantos más cristales entregas, más difícil se vuelve.

## Cómo ejecutarlo
La cámara solo funciona en `localhost` o `https`:

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000>. `cronicas-del-santuario.html` es la misma página en un solo archivo.

## Código
`src/` contiene el código separado por partes, y `app.js` es la unión de todas:

```bash
cat src/0*.js > app.js
```

| Archivo | Contenido |
|---|---|
| `01_setup.js` | Configuración (`CFG`), razas, clases y renderizador |
| `02_world.js` | Terreno, bosque, santuario, cristales y día/noche |
| `03_characters.js` | Constructor de personajes, animación y enemigos |
| `04_creator.js` | Pantalla de creación |
| `05_input.js` | MediaPipe, joystick de mano, teclado y ratón |
| `06_game.js` | Jugador, combate, IA, oleadas y cámara |
| `07_hud_loop.js` | Interfaz, minimapa y bucle principal |
