import { PerceptualEvaluator } from "../src/index.js";

const viewport = document.getElementById("viewport");
const ctxViewport = viewport.getContext("2d");

const inhibitionMap = document.getElementById("inhibitionMap");
const ctxInhibition = inhibitionMap.getContext("2d");

const edgeMapCanvas = document.getElementById("edgeMap");
const ctxEdge = edgeMapCanvas.getContext("2d");

// Sliders
const sigmaSlider = document.getElementById("sigmaSlider");
const gestaltSlider = document.getElementById("gestaltSlider");
const multiSlider = document.getElementById("multiSlider");

const sigmaVal = document.getElementById("sigmaVal");
const gestaltVal = document.getElementById("gestaltVal");
const multiVal = document.getElementById("multiVal");

const runAuditBtn = document.getElementById("runAuditBtn");
const scoreNum = document.getElementById("scoreNum");
const statusBadge = document.getElementById("statusBadge");
const summaryText = document.getElementById("summaryText");

// Table elements
const mContrast = document.getElementById("mContrast");
const sContrast = document.getElementById("sContrast");
const mInhibition = document.getElementById("mInhibition");
const sInhibition = document.getElementById("sInhibition");
const mGestalt = document.getElementById("mGestalt");
const sGestalt = document.getElementById("sGestalt");
const mMulti = document.getElementById("mMulti");
const sMulti = document.getElementById("sMulti");

let currentPreset = "machBands";

// Sync slider values
sigmaSlider.addEventListener("input", (e) => {
  sigmaVal.textContent = e.target.value;
  runAudit();
});
gestaltSlider.addEventListener("input", (e) => {
  gestaltVal.textContent = e.target.value;
  runAudit();
});
multiSlider.addEventListener("input", (e) => {
  multiVal.textContent = e.target.value;
  runAudit();
});

// Preset switcher
document.querySelectorAll(".btn-preset").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentPreset = btn.dataset.preset;
    drawPresetPattern(currentPreset);
    runAudit();
  });
});

runAuditBtn.addEventListener("click", () => {
  runAudit();
});

function drawPresetPattern(preset) {
  const w = viewport.width;
  const h = viewport.height;
  ctxViewport.fillStyle = "#000000";
  ctxViewport.fillRect(0, 0, w, h);

  if (preset === "machBands") {
    // Luminance Step Ramp creating Mach bands
    const steps = 6;
    const stepW = w / steps;
    for (let i = 0; i < steps; i++) {
      const luminance = Math.floor((i / (steps - 1)) * 255);
      ctxViewport.fillStyle = `rgb(${luminance}, ${luminance}, ${luminance})`;
      ctxViewport.fillRect(i * stepW, 0, stepW, h);
    }
  } else if (preset === "highContrast") {
    // Dark mode UI surface with text and button
    ctxViewport.fillStyle = "#0f172a";
    ctxViewport.fillRect(0, 0, w, h);

    // Card background
    ctxViewport.fillStyle = "#1e293b";
    ctxViewport.fillRect(20, 20, w - 40, h - 40);

    // High contrast header
    ctxViewport.fillStyle = "#f8fafc";
    ctxViewport.font = "bold 16px sans-serif";
    ctxViewport.fillText("PERCEPTUAL EVAL", 40, 55);

    // Subtitle text
    ctxViewport.fillStyle = "#94a3b8";
    ctxViewport.font = "12px sans-serif";
    ctxViewport.fillText("Contrast ratio legibility audit", 40, 75);

    // Button
    ctxViewport.fillStyle = "#38bdf8";
    ctxViewport.fillRect(40, 100, 120, 36);

    ctxViewport.fillStyle = "#0f172a";
    ctxViewport.font = "bold 12px sans-serif";
    ctxViewport.fillText("ACTION BTN", 60, 122);
  } else if (preset === "gestaltGrid") {
    // Continuous oriented edges vs noisy background
    ctxViewport.fillStyle = "#111827";
    ctxViewport.fillRect(0, 0, w, h);

    ctxViewport.strokeStyle = "#10b981";
    ctxViewport.lineWidth = 3;

    // Draw coherent curved stroke
    ctxViewport.beginPath();
    ctxViewport.arc(w / 2, h / 2, 70, 0, Math.PI * 1.5);
    ctxViewport.stroke();

    // Random edge noise background
    ctxViewport.strokeStyle = "#374151";
    ctxViewport.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      ctxViewport.beginPath();
      ctxViewport.moveTo(rx, ry);
      ctxViewport.lineTo(rx + (Math.random() - 0.5) * 20, ry + (Math.random() - 0.5) * 20);
      ctxViewport.stroke();
    }
  } else if (preset === "multiStable") {
    // Necker Cube / Ambiguous 3D frame pattern
    ctxViewport.fillStyle = "#050811";
    ctxViewport.fillRect(0, 0, w, h);

    ctxViewport.strokeStyle = "#e2e8f0";
    ctxViewport.lineWidth = 2;

    const size = 70;
    const cx = w / 2 - 35;
    const cy = h / 2 - 35;
    const offset = 25;

    // Front square
    ctxViewport.strokeRect(cx, cy, size, size);
    // Back square
    ctxViewport.strokeRect(cx + offset, cy - offset, size, size);

    // Connecting lines
    ctxViewport.beginPath();
    ctxViewport.moveTo(cx, cy);
    ctxViewport.lineTo(cx + offset, cy - offset);

    ctxViewport.moveTo(cx + size, cy);
    ctxViewport.lineTo(cx + size + offset, cy - offset);

    ctxViewport.moveTo(cx, cy + size);
    ctxViewport.lineTo(cx + offset, cy + size - offset);

    ctxViewport.moveTo(cx + size, cy + size);
    ctxViewport.lineTo(cx + size + offset, cy + size - offset);
    ctxViewport.stroke();
  }
}

function renderHeatmap(canvasCtx, floatArray, width, height, colorMode = "inhibition") {
  const imgData = canvasCtx.createImageData(width, height);
  const data = imgData.data;

  let maxVal = 0.0001;
  for (let i = 0; i < floatArray.length; i++) {
    const val = Math.abs(floatArray[i]);
    if (val > maxVal) maxVal = val;
  }

  for (let i = 0; i < floatArray.length; i++) {
    const norm = Math.min(1.0, Math.abs(floatArray[i]) / maxVal);
    const idx = i * 4;

    if (colorMode === "inhibition") {
      // Cyan to Red heatmap
      data[idx] = Math.floor(norm * 255); // R
      data[idx + 1] = Math.floor((1 - norm) * 220); // G
      data[idx + 2] = Math.floor((1 - norm) * 255); // B
    } else {
      // Emerald edge map
      data[idx] = 0;
      data[idx + 1] = Math.floor(norm * 255);
      data[idx + 2] = Math.floor(norm * 200);
    }
    data[idx + 3] = 255;
  }

  canvasCtx.putImageData(imgData, 0, 0);
}

function runAudit() {
  const evaluator = new PerceptualEvaluator({
    luminanceFormula: "WCAG21",
    lateralInhibitionSigma: parseFloat(sigmaSlider.value),
    gestaltThreshold: parseFloat(gestaltSlider.value),
    multiStabilitySensitivity: parseFloat(multiSlider.value)
  });

  const report = evaluator.analyze(viewport);

  // Update Score & Summary
  scoreNum.textContent = report.score;
  summaryText.textContent = report.diagnostics.summary;

  if (report.score >= 80) {
    statusBadge.textContent = "Pass (High Quality)";
    statusBadge.style.background = "var(--accent-green)";
  } else if (report.score >= 50) {
    statusBadge.textContent = "Warning (Sub-optimal)";
    statusBadge.style.background = "var(--accent-yellow)";
  } else {
    statusBadge.textContent = "Fail (Perceptual Flaws)";
    statusBadge.style.background = "var(--accent-red)";
  }

  // Update Table
  mContrast.textContent = `${report.metrics.contrastRatio}:1`;
  sContrast.innerHTML = report.diagnostics.wcagPassAA 
    ? `<span class="pass-text">PASS (AA)</span>` 
    : `<span class="fail-text">FAIL</span>`;

  mInhibition.textContent = report.metrics.lateralInhibitionPeak;
  sInhibition.innerHTML = report.diagnostics.machBandingWarning 
    ? `<span class="warn-text">GLARE RISK</span>` 
    : `<span class="pass-text">STABLE</span>`;

  mGestalt.textContent = report.metrics.gestaltContinuity;
  sGestalt.innerHTML = report.diagnostics.gestaltSeparationWarning 
    ? `<span class="warn-text">LOW SEPARATION</span>` 
    : `<span class="pass-text">OPTIMAL</span>`;

  mMulti.textContent = report.metrics.multiStabilityIndex;
  sMulti.innerHTML = report.diagnostics.hasDepthAmbiguity 
    ? `<span class="warn-text">3D AMBIGUITY</span>` 
    : `<span class="pass-text">CLEAR</span>`;

  // Render Heatmaps
  renderHeatmap(ctxInhibition, report.maps.lateralInhibition, viewport.width, viewport.height, "inhibition");
  renderHeatmap(ctxEdge, report.maps.gestaltEdges, viewport.width, viewport.height, "gestalt");
}

// Initial Draw & Audit
drawPresetPattern(currentPreset);
runAudit();
