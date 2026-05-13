# Task 2 — G-Code Parsing & Layer Visualisation

## Overview

![Layer Viewer Screenshot].(Layer Viewer Screenshot.png)

A browser-based G-code parser and interactive layer viewer that extracts layer data from G-code files and provides a cumulative 2D visualisation of the model geometry. Built entirely with **vanilla HTML, CSS, and JavaScript** — no external libraries.

## How to Run

Simply open `index.html` in any modern web browser. The sample `cone.gcode` file is loaded automatically. You can also drag-and-drop or upload your own G-code file.

**🔗 Live Demo:** [https://lalit-7.github.io/G-Code-Parsing-Layer-Visualisation-/](https://lalit-7.github.io/G-Code-Parsing-Layer-Visualisation-/)

**Note:** If opening directly as a file (file:// protocol), some browsers may block the automatic loading of `cone.gcode` due to CORS restrictions. In that case, you can:
1. Use a simple local server: `python -m http.server 8000` and open `http://localhost:8000`
2. Or manually upload the `cone.gcode` file using the upload area

## Approach

### Part 1 — Data Extraction

The parser reads G-code line by line and extracts:

- **Layer markers** — Lines matching `;LAYER:n` pattern indicate the start of a new layer
- **Z heights** — Lines containing `Zn.n` within G1 commands represent the height of that layer
- **XY coordinates** — Lines with `Xn Yn` in G1 commands are extracted as geometry points for the layer

The parser is designed to be **fault-tolerant**:
- Ignores comment lines (starting with `;`) that aren't layer markers
- Ignores unrecognised G-code commands (G21, G90, etc.)
- Handles negative coordinates
- Handles decimal and integer values
- Gracefully skips malformed lines without crashing

**Extraction results for the provided cone.gcode:**
- Total layers: **20** (Layer 0 through Layer 19)
- Z heights (in order): 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5, 12.0, 13.5, 15.0, 16.5, 18.0, 19.5, 21.0, 22.5, 24.0, 25.5, 27.0, 28.5, 30.0

### Part 2 — Interactive Layer Viewer

The viewer uses **HTML5 Canvas** to render a 2D top-down view of the model geometry.

**Key design decisions:**

1. **Cumulative rendering** — At layer N, all layers from 0 to N are drawn. This builds the model progressively, matching the real 3D printing process.

2. **Color-coded height** — Layers are coloured on a blue→cyan→green→yellow→red gradient based on their Z height. This provides an intuitive visual representation of the vertical structure.

3. **Polygon rendering** — Each layer's XY points are connected as a closed polygon with semi-transparent fill and a solid outline. The current (topmost visible) layer has higher opacity and visible vertex points.

4. **Coordinate system** — The canvas uses a centered coordinate system with X and Y axes drawn as reference lines, and a subtle grid background for scale reference.

## Features

- **Cumulative 2D view** — See the model build up layer by layer
- **Layer slider** — Drag to scrub through all layers
- **Prev/Next buttons** — Step through layers one at a time
- **Play/Pause animation** — Auto-play through layers to watch the build
- **Speed control** — Adjust animation speed (50ms to 2000ms per frame)
- **Keyboard navigation** — Arrow keys to step, Space to play/pause
- **File upload** — Drag-and-drop or browse to load custom G-code files
- **Data summary** — Total layers, Z range, total points at a glance
- **Z Heights table** — Expandable table showing all layers with their Z heights
- **Height colour legend** — Visual colour scale showing the height mapping
- **Responsive design** — Works on desktop and mobile

## Assumptions

1. The G-code file uses absolute positioning (G90)
2. Layer markers follow the `;LAYER:n` format
3. Z heights appear as `Z<value>` within G1 commands
4. XY coordinates appear as `X<value> Y<value>` pairs within G1 commands
5. Each layer's geometry is a closed polygon (points are connected in order)
6. The first Z value encountered in a layer is used as that layer's height

## Libraries Used

**None.** The entire application is built with vanilla HTML, CSS, and JavaScript:
- **HTML5 Canvas** for 2D rendering
- **CSS3** with custom properties, backdrop-filter, and animations
- **ES6+ JavaScript** for parsing and UI logic

## File Structure

```
Task2_GCodeLayerViewer/
├── index.html    — Page structure
├── style.css     — All styling
├── script.js     — G-code parser, Canvas renderer, and UI logic
├── cone.gcode    — Sample G-code file (cone geometry)
└── README.md     — This file
```
