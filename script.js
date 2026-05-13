/**
 * G-Code Layer Viewer
 * ====================
 * Parses G-code files to extract layer data and renders an interactive
 * cumulative 2D layer visualisation using HTML5 Canvas.
 *
 * Part 1: Data extraction (layers, Z heights, coordinates)
 * Part 2: Interactive viewer with slider, buttons, and animation
 *
 * No external libraries used.
 */

// ============================================================
//  PART 1 — G-CODE PARSER
// ============================================================

/**
 * Parses a G-code string and extracts layer data.
 * @param {string} gcodeText - Raw G-code file content
 * @returns {object} Parsed data with layers array and metadata
 */
function parseGCode(gcodeText) {
  const lines = gcodeText.split("\n");
  const layers = [];
  let currentLayer = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and pure comments (except layer markers)
    if (!line) continue;

    // --- Layer marker: ;LAYER:n ---
    const layerMatch = line.match(/^;LAYER:(\d+)/i);
    if (layerMatch) {
      currentLayer = {
        number: parseInt(layerMatch[1], 10),
        zHeight: null,
        points: [],
      };
      layers.push(currentLayer);
      continue;
    }

    // Skip comment-only lines
    if (line.startsWith(";")) continue;

    // Only process G1 (linear move) commands
    if (!line.startsWith("G1") && !line.startsWith("g1")) continue;
    if (!currentLayer) continue;

    // --- Extract Z height ---
    const zMatch = line.match(/Z([-]?\d+\.?\d*)/i);
    if (zMatch && currentLayer.zHeight === null) {
      currentLayer.zHeight = parseFloat(zMatch[1]);
    }

    // --- Extract X, Y coordinates ---
    const xMatch = line.match(/X([-]?\d+\.?\d*)/i);
    const yMatch = line.match(/Y([-]?\d+\.?\d*)/i);

    if (xMatch && yMatch) {
      currentLayer.points.push({
        x: parseFloat(xMatch[1]),
        y: parseFloat(yMatch[1]),
      });
    }
  }

  // --- Compute metadata ---
  const totalLayers = layers.length;
  const zHeights = layers
    .filter((l) => l.zHeight !== null)
    .map((l) => l.zHeight);
  const uniqueZHeights = [...new Set(zHeights)];
  const totalPoints = layers.reduce((sum, l) => sum + l.points.length, 0);

  return {
    layers,
    totalLayers,
    zHeights: uniqueZHeights,
    totalPoints,
    zMin: zHeights.length > 0 ? Math.min(...zHeights) : 0,
    zMax: zHeights.length > 0 ? Math.max(...zHeights) : 0,
  };
}

// ============================================================
//  PART 2 — CANVAS RENDERER
// ============================================================

class LayerRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.data = null;
    this.currentLayer = 0;
    this.padding = 40;

    // Compute scale based on canvas size
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth - 4, 600);
    this.canvas.width = size * (window.devicePixelRatio || 1);
    this.canvas.height = size * (window.devicePixelRatio || 1);
    this.canvas.style.width = size + "px";
    this.canvas.style.height = size + "px";
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.size = size;
    if (this.data) this.draw();
  }

  setData(data) {
    this.data = data;
    this.currentLayer = 0;
    this.computeScale();
    this.draw();
  }

  computeScale() {
    if (!this.data || this.data.layers.length === 0) return;

    // Find the max absolute coordinate across all layers
    let maxCoord = 0;
    for (const layer of this.data.layers) {
      for (const pt of layer.points) {
        maxCoord = Math.max(maxCoord, Math.abs(pt.x), Math.abs(pt.y));
      }
    }

    // Scale to fit canvas with padding
    const drawSize = this.size - this.padding * 2;
    this.scale = maxCoord > 0 ? drawSize / (maxCoord * 2) : 1;
    this.centerX = this.size / 2;
    this.centerY = this.size / 2;
  }

  /** Convert model coordinates to canvas coordinates */
  toCanvas(x, y) {
    return {
      cx: this.centerX + x * this.scale,
      cy: this.centerY - y * this.scale, // Flip Y axis
    };
  }

  /** Get color for a layer based on its height (blue → cyan → green → yellow → red) */
  getLayerColor(layerIndex, alpha = 1) {
    if (!this.data || this.data.totalLayers <= 1) {
      return `hsla(185, 100%, 50%, ${alpha})`;
    }
    // Gradient from 210 (blue) → 185 (cyan) → 120 (green) → 30 (orange) → 0 (red)
    const t = layerIndex / (this.data.totalLayers - 1);
    const hue = 210 - t * 210; // 210 → 0
    const sat = 80 + t * 20;
    const light = 50 + t * 10;
    return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
  }

  /** Draw the grid background */
  drawGrid() {
    const ctx = this.ctx;
    const size = this.size;

    // Background
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 0.5;
    const step = 20;
    for (let x = this.padding; x <= size - this.padding; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, this.padding);
      ctx.lineTo(x, size - this.padding);
      ctx.stroke();
    }
    for (let y = this.padding; y <= size - this.padding; y += step) {
      ctx.beginPath();
      ctx.moveTo(this.padding, y);
      ctx.lineTo(size - this.padding, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    // X axis
    ctx.beginPath();
    ctx.moveTo(this.padding, this.centerY);
    ctx.lineTo(size - this.padding, this.centerY);
    ctx.stroke();
    // Y axis
    ctx.beginPath();
    ctx.moveTo(this.centerX, this.padding);
    ctx.lineTo(this.centerX, size - this.padding);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("X", size - this.padding + 15, this.centerY + 4);
    ctx.fillText("Y", this.centerX, this.padding - 10);

    // Origin
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillText("0", this.centerX - 10, this.centerY + 14);
  }

  /** Draw a single layer as a filled polygon with outline */
  drawLayer(layer, layerIndex, isCurrent) {
    const ctx = this.ctx;
    const points = layer.points;
    if (points.length < 2) {
      // Single point — draw a dot
      if (points.length === 1) {
        const { cx, cy } = this.toCanvas(points[0].x, points[0].y);
        const color = this.getLayerColor(layerIndex);
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (isCurrent) {
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      return;
    }

    const fillAlpha = isCurrent ? 0.25 : 0.08;
    const strokeAlpha = isCurrent ? 1 : 0.5;
    const lineWidth = isCurrent ? 2.5 : 1.2;

    // Fill
    ctx.beginPath();
    const first = this.toCanvas(points[0].x, points[0].y);
    ctx.moveTo(first.cx, first.cy);
    for (let i = 1; i < points.length; i++) {
      const { cx, cy } = this.toCanvas(points[i].x, points[i].y);
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.fillStyle = this.getLayerColor(layerIndex, fillAlpha);
    ctx.fill();

    // Stroke
    ctx.beginPath();
    ctx.moveTo(first.cx, first.cy);
    for (let i = 1; i < points.length; i++) {
      const { cx, cy } = this.toCanvas(points[i].x, points[i].y);
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.strokeStyle = this.getLayerColor(layerIndex, strokeAlpha);
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Draw points on current layer
    if (isCurrent) {
      for (const pt of points) {
        const { cx, cy } = this.toCanvas(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.getLayerColor(layerIndex, 0.9);
        ctx.fill();
      }
    }
  }

  /** Main draw function — cumulative view up to currentLayer */
  draw() {
    if (!this.data) return;

    const ctx = this.ctx;
    ctx.save();

    // Clear and draw grid
    this.drawGrid();

    // Draw all layers from 0 to currentLayer (cumulative)
    for (let i = 0; i <= this.currentLayer && i < this.data.layers.length; i++) {
      const isCurrent = i === this.currentLayer;
      this.drawLayer(this.data.layers[i], i, isCurrent);
    }

    ctx.restore();
  }

  setLayer(n) {
    if (!this.data) return;
    this.currentLayer = Math.max(0, Math.min(n, this.data.totalLayers - 1));
    this.draw();
  }
}

// ============================================================
//  UI CONTROLLER
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("layer-canvas");
  const renderer = new LayerRenderer(canvas);

  // UI Elements
  const fileInput = document.getElementById("file-input");
  const uploadArea = document.getElementById("upload-area");
  const slider = document.getElementById("layer-slider");
  const sliderMax = document.getElementById("slider-max");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnPlay = document.getElementById("btn-play");
  const playIcon = document.getElementById("play-icon");
  const pauseIcon = document.getElementById("pause-icon");
  const btnFaster = document.getElementById("btn-faster");
  const btnSlower = document.getElementById("btn-slower");
  const speedValue = document.getElementById("speed-value");

  // Info displays
  const totalLayersEl = document.getElementById("total-layers");
  const zRangeEl = document.getElementById("z-range");
  const totalPointsEl = document.getElementById("total-points");
  const currentLayerNum = document.getElementById("current-layer-num");
  const currentZHeight = document.getElementById("current-z-height");
  const currentPoints = document.getElementById("current-points");
  const overlayLayer = document.getElementById("overlay-layer");
  const heightsList = document.getElementById("heights-list");
  const legendMin = document.getElementById("legend-min");
  const legendMax = document.getElementById("legend-max");

  let data = null;
  let isPlaying = false;
  let playTimer = null;
  let animSpeed = 500; // ms between frames

  // --- Default sample G-code (embedded to avoid CORS issues with file:// protocol) ---
  const DEFAULT_GCODE = `G21 ; mm units
G90 ; absolute positioning

;LAYER:0
G1 Z1.5
G1 X20 Y0
G1 X14 Y14
G1 X0 Y20
G1 X-14 Y14
G1 X-20 Y0
G1 X-14 Y-14
G1 X0 Y-20
G1 X14 Y-14
G1 X20 Y0

;LAYER:1
G1 Z3.0
G1 X19 Y0
G1 X13 Y13
G1 X0 Y19
G1 X-13 Y13
G1 X-19 Y0
G1 X-13 Y-13
G1 X0 Y-19
G1 X13 Y-13
G1 X19 Y0

;LAYER:2
G1 Z4.5
G1 X18 Y0
G1 X13 Y12
G1 X0 Y18
G1 X-13 Y12
G1 X-18 Y0
G1 X-13 Y-12
G1 X0 Y-18
G1 X13 Y-12
G1 X18 Y0

;LAYER:3
G1 Z6.0
G1 X17 Y0
G1 X12 Y12
G1 X0 Y17
G1 X-12 Y12
G1 X-17 Y0
G1 X-12 Y-12
G1 X0 Y-17
G1 X12 Y-12
G1 X17 Y0

;LAYER:4
G1 Z7.5
G1 X16 Y0
G1 X11 Y11
G1 X0 Y16
G1 X-11 Y11
G1 X-16 Y0
G1 X-11 Y-11
G1 X0 Y-16
G1 X11 Y-11
G1 X16 Y0

;LAYER:5
G1 Z9.0
G1 X15 Y0
G1 X10 Y10
G1 X0 Y15
G1 X-10 Y10
G1 X-15 Y0
G1 X-10 Y-10
G1 X0 Y-15
G1 X10 Y-10
G1 X15 Y0

;LAYER:6
G1 Z10.5
G1 X14 Y0
G1 X10 Y9
G1 X0 Y14
G1 X-10 Y9
G1 X-14 Y0
G1 X-10 Y-9
G1 X0 Y-14
G1 X10 Y-9
G1 X14 Y0

;LAYER:7
G1 Z12.0
G1 X13 Y0
G1 X9 Y9
G1 X0 Y13
G1 X-9 Y9
G1 X-13 Y0
G1 X-9 Y-9
G1 X0 Y-13
G1 X9 Y-9
G1 X13 Y0

;LAYER:8
G1 Z13.5
G1 X12 Y0
G1 X8 Y8
G1 X0 Y12
G1 X-8 Y8
G1 X-12 Y0
G1 X-8 Y-8
G1 X0 Y-12
G1 X8 Y-8
G1 X12 Y0

;LAYER:9
G1 Z15.0
G1 X11 Y0
G1 X8 Y7
G1 X0 Y11
G1 X-8 Y7
G1 X-11 Y0
G1 X-8 Y-7
G1 X0 Y-11
G1 X8 Y-7
G1 X11 Y0

;LAYER:10
G1 Z16.5
G1 X10 Y0
G1 X7 Y7
G1 X0 Y10
G1 X-7 Y7
G1 X-10 Y0
G1 X-7 Y-7
G1 X0 Y-10
G1 X7 Y-7
G1 X10 Y0

;LAYER:11
G1 Z18.0
G1 X9 Y0
G1 X6 Y6
G1 X0 Y9
G1 X-6 Y6
G1 X-9 Y0
G1 X-6 Y-6
G1 X0 Y-9
G1 X6 Y-6
G1 X9 Y0

;LAYER:12
G1 Z19.5
G1 X8 Y0
G1 X6 Y5
G1 X0 Y8
G1 X-6 Y5
G1 X-8 Y0
G1 X-6 Y-5
G1 X0 Y-8
G1 X6 Y-5
G1 X8 Y0

;LAYER:13
G1 Z21.0
G1 X7 Y0
G1 X5 Y5
G1 X0 Y7
G1 X-5 Y5
G1 X-7 Y0
G1 X-5 Y-5
G1 X0 Y-7
G1 X5 Y-5
G1 X7 Y0

;LAYER:14
G1 Z22.5
G1 X6 Y0
G1 X4 Y4
G1 X0 Y6
G1 X-4 Y4
G1 X-6 Y0
G1 X-4 Y-4
G1 X0 Y-6
G1 X4 Y-4
G1 X6 Y0

;LAYER:15
G1 Z24.0
G1 X5 Y0
G1 X3 Y3
G1 X0 Y5
G1 X-3 Y3
G1 X-5 Y0
G1 X-3 Y-3
G1 X0 Y-5
G1 X3 Y-3
G1 X5 Y0

;LAYER:16
G1 Z25.5
G1 X4 Y0
G1 X3 Y2
G1 X0 Y4
G1 X-3 Y2
G1 X-4 Y0
G1 X-3 Y-2
G1 X0 Y-4
G1 X3 Y-2
G1 X4 Y0

;LAYER:17
G1 Z27.0
G1 X3 Y0
G1 X2 Y2
G1 X0 Y3
G1 X-2 Y2
G1 X-3 Y0
G1 X-2 Y-2
G1 X0 Y-3
G1 X2 Y-2
G1 X3 Y0

;LAYER:18
G1 Z28.5
G1 X2 Y0
G1 X1 Y1
G1 X0 Y2
G1 X-1 Y1
G1 X-2 Y0
G1 X-1 Y-1
G1 X0 Y-2
G1 X1 Y-1
G1 X2 Y0

;LAYER:19
G1 Z30.0
G1 X0 Y0`;

  // Load the embedded sample on startup
  processGCode(DEFAULT_GCODE);

  // --- File upload handlers (user can still load custom G-code files) ---
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
  });

  // Drag and drop
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      processGCode(e.target.result);
    };
    reader.readAsText(file);
  }

  function processGCode(text) {
    data = parseGCode(text);
    renderer.setData(data);
    updateUI(0);
    setupSlider();
    renderSummary();
    renderHeightsTable();
    renderLegend();
  }

  // --- Slider ---
  function setupSlider() {
    if (!data) return;
    slider.min = 0;
    slider.max = data.totalLayers - 1;
    slider.value = 0;
    sliderMax.textContent = data.totalLayers - 1;
  }

  slider.addEventListener("input", () => {
    const layer = parseInt(slider.value, 10);
    renderer.setLayer(layer);
    updateUI(layer);
  });

  // --- Navigation buttons ---
  btnPrev.addEventListener("click", () => {
    if (!data) return;
    const layer = Math.max(0, renderer.currentLayer - 1);
    goToLayer(layer);
  });

  btnNext.addEventListener("click", () => {
    if (!data) return;
    const layer = Math.min(data.totalLayers - 1, renderer.currentLayer + 1);
    goToLayer(layer);
  });

  // --- Play / Pause ---
  btnPlay.addEventListener("click", () => {
    if (!data) return;
    if (isPlaying) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  function startAnimation() {
    isPlaying = true;
    playIcon.style.display = "none";
    pauseIcon.style.display = "inline";
    btnPlay.querySelector("svg + svg ~ *") || null;
    // Update button text
    const textNodes = Array.from(btnPlay.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE
    );
    textNodes.forEach((n) => (n.textContent = " Pause"));

    // If at the end, restart
    if (renderer.currentLayer >= data.totalLayers - 1) {
      goToLayer(0);
    }

    playTimer = setInterval(() => {
      const next = renderer.currentLayer + 1;
      if (next >= data.totalLayers) {
        stopAnimation();
        return;
      }
      goToLayer(next);
    }, animSpeed);
  }

  function stopAnimation() {
    isPlaying = false;
    clearInterval(playTimer);
    playTimer = null;
    playIcon.style.display = "inline";
    pauseIcon.style.display = "none";
    const textNodes = Array.from(btnPlay.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE
    );
    textNodes.forEach((n) => (n.textContent = " Play"));
  }

  // --- Speed controls ---
  btnFaster.addEventListener("click", () => {
    animSpeed = Math.max(50, animSpeed - 100);
    speedValue.textContent = animSpeed + "ms";
    if (isPlaying) {
      stopAnimation();
      startAnimation();
    }
  });

  btnSlower.addEventListener("click", () => {
    animSpeed = Math.min(2000, animSpeed + 100);
    speedValue.textContent = animSpeed + "ms";
    if (isPlaying) {
      stopAnimation();
      startAnimation();
    }
  });

  // --- Keyboard navigation ---
  document.addEventListener("keydown", (e) => {
    if (!data) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      goToLayer(Math.max(0, renderer.currentLayer - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      goToLayer(Math.min(data.totalLayers - 1, renderer.currentLayer + 1));
    } else if (e.key === " ") {
      e.preventDefault();
      btnPlay.click();
    }
  });

  // --- Helper functions ---
  function goToLayer(n) {
    renderer.setLayer(n);
    slider.value = n;
    updateUI(n);
  }

  function updateUI(layerNum) {
    if (!data || !data.layers[layerNum]) return;
    const layer = data.layers[layerNum];
    currentLayerNum.textContent = layer.number;
    currentZHeight.textContent =
      layer.zHeight !== null ? layer.zHeight.toFixed(1) + " mm" : "—";
    currentPoints.textContent = layer.points.length;
    overlayLayer.textContent = layer.number;

    // Highlight active row in heights table
    document.querySelectorAll(".height-row").forEach((row, i) => {
      row.classList.toggle("active", i === layerNum);
    });
  }

  function renderSummary() {
    if (!data) return;
    totalLayersEl.textContent = data.totalLayers;
    zRangeEl.textContent =
      data.zMin.toFixed(1) + " — " + data.zMax.toFixed(1);
    totalPointsEl.textContent = data.totalPoints;
  }

  function renderHeightsTable() {
    if (!data) return;
    heightsList.innerHTML = data.layers
      .map(
        (l, i) => `
      <div class="height-row ${i === 0 ? "active" : ""}" data-layer="${i}">
        <span class="height-layer">Layer ${l.number}</span>
        <span class="height-z">${l.zHeight !== null ? l.zHeight.toFixed(1) + " mm" : "—"}</span>
        <span class="height-pts">${l.points.length} pts</span>
      </div>`
      )
      .join("");

    // Click to navigate
    heightsList.querySelectorAll(".height-row").forEach((row) => {
      row.addEventListener("click", () => {
        const layer = parseInt(row.getAttribute("data-layer"), 10);
        goToLayer(layer);
      });
    });
  }

  function renderLegend() {
    if (!data) return;
    legendMin.textContent = data.zMin.toFixed(1) + " mm";
    legendMax.textContent = data.zMax.toFixed(1) + " mm";
  }
});
