# VOSC-Activity-1
# Classic Ludo Game

A fully featured, authentic Ludo game built using pure HTML, CSS, and vanilla JavaScript.

## Features
- **Authentic 15x15 Layout:**
  - 4 colored corner nests (Red, Green, Blue, Yellow) with inner white boxes and 4 pawn slots each.
  - 8 safe star spaces (4 colored starting stars + 4 path stars) where pawns are immune to capture.
  - Directional runway entrance arrows and a 4-triangle center finish area.
- **Animated 3D Tumbling Die:**
  - Realistic 3D rotational physics using CSS 3D transforms.
  - Standard, balanced 3x3 dot pip layouts for faces 1 through 6.
  - Provably fair, cryptographically unbiased rolls via `crypto.getRandomValues()` with rejection sampling.
  - Synthesized rolling and win sound effects via Web Audio API.
- **Flexible Match Configurations & AI:**
  - Configure Red, Green, Blue, and Yellow as **Human**, **Computer (AI)**, or **Inactive**.
  - Smart AI heuristics that prioritize rolling out pawns on 6s, capturing rivals, seeking safe stars, and finishing in Home.
- **Celebrations:**
  - Full-screen particle confetti bursts whenever a pawn finishes at Home.
  - Victorious fanfare and celebration modal banner when a player gets all 4 pawns home.

## Project Structure
```text
ludo-game/
├── index.html   # Main structure, board layout, and 3D dice markup
├── style.css    # Responsive board grid, 3D animations, pawn tokens, and colors
├── script.js    # Movement validation, AI logic, Web Audio, and confetti
└── README.md    # Documentation and run instructions
