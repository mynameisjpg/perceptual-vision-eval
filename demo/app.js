// Perceptual Vision Eval Toolkit — Interactive Psychophysical Engine & UI Controller
// Supports standalone file:// browser execution and local Node HTTP server

// --- 01. Core Psychophysical Math & Image Processing Utilities ---

function normalizeImageData(input) {
  if (!input) {
    throw new Error("Invalid image input provided to perceptual evaluator.");
  }
  if (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) {
    const ctx = input.getContext("2d");
    return ctx.getImageData(0, 0, input.width, input.height);
  }
  if (typeof CanvasRenderingContext2D !== "undefined" && input instanceof CanvasRenderingContext2D) {
    return input.getImageData(0, 0, input.canvas.width, input.canvas.height);
  }
  if (input.data && typeof input.width === "number" && typeof input.height === "number") {
    return {
      data: input.data,
      width: Math.floor(input.width),
      height: Math.floor(input.height)
    };
  }
  throw new Error("Unsupported image input format.");
}

function toGrayscaleMatrix(imageData) {
  const { data, width, height } = imageData;
  const grayscale = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    // Linear sRGB conversion (ITU-R BT.709) for psychophysical luminance accuracy
    const rLin = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLin = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLin = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    grayscale[i] = 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }
  return grayscale;
}

function computeLuminanceContrast(imageData, formula = "WCAG21") {
  const grayscale = toGrayscaleMatrix(imageData);
  const totalPixels = grayscale.length;
  if (totalPixels === 0) {
    return { contrastRatio: 1, minLuminance: 0, maxLuminance: 0, meanLuminance: 0, passAA: false, passAAA: false };
  }
  let sumL = 0.0;
  const samples = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const l = grayscale[i];
    samples[i] = l;
    sumL += l;
  }
  samples.sort();
  const p5Index = Math.floor(totalPixels * 0.05);
  const p95Index = Math.floor(totalPixels * 0.95);
  const L2 = samples[p5Index];
  const L1 = samples[p95Index];
  const meanLuminance = sumL / totalPixels;
  const contrastRatio = (L1 + 0.05) / (L2 + 0.05);
  const roundedRatio = Math.round(contrastRatio * 100) / 100;
  return {
    contrastRatio: roundedRatio,
    minLuminance: Math.round(L2 * 1000) / 1000,
    maxLuminance: Math.round(L1 * 1000) / 1000,
    meanLuminance: Math.round(meanLuminance * 1000) / 1000,
    passAA: roundedRatio >= 4.5,
    passAAA: roundedRatio >= 7.0
  };
}

function create1DGaussianKernel(sigma) {
  const radius = Math.ceil(sigma * 3);
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = val;
    sum += val;
  }
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  return kernel;
}

function gaussianBlur2D(input, width, height, sigma) {
  const kernel = create1DGaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const temp = new Float32Array(width * height);
  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const px = Math.min(width - 1, Math.max(0, x + k));
        sum += input[y * width + px] * kernel[k + radius];
      }
      temp[y * width + x] = sum;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const py = Math.min(height - 1, Math.max(0, y + k));
        sum += temp[py * width + x] * kernel[k + radius];
      }
      output[y * width + x] = sum;
    }
  }
  return output;
}

function computeLateralInhibition(imageData, sigma = 1.8) {
  const { width, height } = imageData;
  const grayscale = toGrayscaleMatrix(imageData);
  const sigmaCenter = Math.max(0.5, sigma * 0.5);
  const sigmaSurround = sigma * 1.5;
  const gCenter = gaussianBlur2D(grayscale, width, height, sigmaCenter);
  const gSurround = gaussianBlur2D(grayscale, width, height, sigmaSurround);
  const responseMap = new Float32Array(width * height);
  let maxOvershoot = 0.0;
  for (let i = 0; i < width * height; i++) {
    const dog = gCenter[i] - gSurround[i];
    responseMap[i] = dog;
    const absDog = Math.abs(dog);
    if (absDog > maxOvershoot) {
      maxOvershoot = absDog;
    }
  }
  const peakRatio = Math.round((maxOvershoot * 10) * 100) / 100;
  const machBandWarning = peakRatio > 2.4;
  return {
    peakRatio,
    maxOvershoot: Math.round(maxOvershoot * 1000) / 1000,
    machBandWarning,
    responseMap
  };
}

function computeGestaltContinuity(imageData, threshold = 0.42) {
  const { width, height } = imageData;
  const grayscale = toGrayscaleMatrix(imageData);
  const edgeMap = new Float32Array(width * height);
  const orientations = new Float32Array(width * height);
  let edgePixelCount = 0;
  let totalCoherenceSum = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const p00 = grayscale[(y - 1) * width + (x - 1)];
      const p01 = grayscale[(y - 1) * width + x];
      const p02 = grayscale[(y - 1) * width + (x + 1)];
      const p10 = grayscale[y * width + (x - 1)];
      const p12 = grayscale[y * width + (x + 1)];
      const p20 = grayscale[(y + 1) * width + (x - 1)];
      const p21 = grayscale[(y + 1) * width + x];
      const p22 = grayscale[(y + 1) * width + (x + 1)];

      const gx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
      const gy = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edgeMap[idx] = magnitude;
      orientations[idx] = Math.atan2(gy, gx);

      if (magnitude > threshold * 0.5) {
        edgePixelCount++;
      }
    }
  }

  let validNeighbors = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (edgeMap[idx] < threshold * 0.3) continue;
      const theta1 = orientations[idx];
      const neighbors = [
        orientations[(y - 1) * width + x],
        orientations[(y + 1) * width + x],
        orientations[y * width + (x - 1)],
        orientations[y * width + (x + 1)]
      ];
      for (const theta2 of neighbors) {
        const delta = Math.abs(theta1 - theta2);
        const alignment = Math.cos(2 * delta);
        totalCoherenceSum += (alignment + 1) / 2;
        validNeighbors++;
      }
    }
  }

  const edgeDensity = edgePixelCount / (width * height);
  const coherenceScore = validNeighbors > 0 ? totalCoherenceSum / validNeighbors : 0.5;
  const rawContinuity = 0.4 * Math.min(1.0, edgeDensity * 12) + 0.6 * coherenceScore;
  const gestaltContinuity = Math.round(rawContinuity * 100) / 100;
  const separationWarning = gestaltContinuity < 0.65;

  return {
    gestaltContinuity,
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
    coherenceScore: Math.round(coherenceScore * 100) / 100,
    separationWarning,
    edgeMap
  };
}

function computeMultiStability(imageData, sensitivity = 0.75) {
  const { width, height } = imageData;
  const grayscale = toGrayscaleMatrix(imageData);
  const gridX = 8;
  const gridY = 8;
  const blockW = Math.floor(width / gridX);
  const blockH = Math.floor(height / gridY);
  const varianceMap = new Float32Array(width * height);

  if (blockW < 2 || blockH < 2) {
    return { multiStabilityIndex: 0.1, hasDepthAmbiguity: false, phaseVariance: 0.05, varianceMap };
  }

  const blockSymmetries = [];
  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      let horizontalSymmetry = 0;
      let count = 0;
      const startX = gx * blockW;
      const startY = gy * blockH;

      for (let y = 0; y < blockH; y++) {
        for (let x = 0; x < Math.floor(blockW / 2); x++) {
          const leftPixel = grayscale[(startY + y) * width + (startX + x)];
          const rightPixel = grayscale[(startY + y) * width + (startX + blockW - 1 - x)];
          const diff = Math.abs(leftPixel - rightPixel);
          horizontalSymmetry += 1.0 - diff;
          count++;
        }
      }
      const symVal = count > 0 ? horizontalSymmetry / count : 0;
      blockSymmetries.push(symVal);

      // Write block symmetry value to 2D variance map for viewport display
      for (let y = 0; y < blockH; y++) {
        for (let x = 0; x < blockW; x++) {
          varianceMap[(startY + y) * width + (startX + x)] = Math.abs(0.5 - symVal) * 2;
        }
      }
    }
  }

  let sum = 0;
  for (const s of blockSymmetries) sum += s;
  const mean = sum / blockSymmetries.length;
  let varianceSum = 0;
  for (const s of blockSymmetries) {
    varianceSum += (s - mean) * (s - mean);
  }
  const phaseVariance = blockSymmetries.length > 0 ? varianceSum / blockSymmetries.length : 0;
  const rawIndex = Math.min(1.0, Math.sqrt(phaseVariance) * (1.5 + sensitivity));
  const multiStabilityIndex = Math.round(rawIndex * 100) / 100;
  const hasDepthAmbiguity = multiStabilityIndex > 0.30;

  return {
    multiStabilityIndex,
    hasDepthAmbiguity,
    phaseVariance: Math.round(phaseVariance * 1000) / 1000,
    varianceMap
  };
}

class PerceptualEvaluator {
  constructor(options = {}) {
    this.luminanceFormula = options.luminanceFormula || "WCAG21";
    this.lateralInhibitionSigma = options.lateralInhibitionSigma ?? 1.8;
    this.gestaltThreshold = options.gestaltThreshold ?? 0.42;
    this.multiStabilitySensitivity = options.multiStabilitySensitivity ?? 0.75;
  }

  analyze(input) {
    const imageData = normalizeImageData(input);
    const contrast = computeLuminanceContrast(imageData, this.luminanceFormula);
    const lateralInhibition = computeLateralInhibition(imageData, this.lateralInhibitionSigma);
    const gestalt = computeGestaltContinuity(imageData, this.gestaltThreshold);
    const multiStability = computeMultiStability(imageData, this.multiStabilitySensitivity);

    const contrastScore = Math.min(40, (contrast.contrastRatio / 7) * 40);
    const gestaltScore = Math.min(30, (gestalt.gestaltContinuity / 0.85) * 30);
    const lateralScore = lateralInhibition.machBandWarning ? 5 : 15;
    const multiStabilityScore = multiStability.hasDepthAmbiguity ? 5 : 15;
    const totalScore = Math.round(Math.min(100, Math.max(0, contrastScore + gestaltScore + lateralScore + multiStabilityScore)));

    return {
      score: totalScore,
      metrics: {
        contrastRatio: contrast.contrastRatio,
        minLuminance: contrast.minLuminance,
        maxLuminance: contrast.maxLuminance,
        lateralInhibitionPeak: lateralInhibition.peakRatio,
        gestaltContinuity: gestalt.gestaltContinuity,
        multiStabilityIndex: multiStability.multiStabilityIndex
      },
      diagnostics: {
        wcagPassAA: contrast.passAA,
        wcagPassAAA: contrast.passAAA,
        machBandingWarning: lateralInhibition.machBandWarning,
        gestaltSeparationWarning: gestalt.separationWarning,
        hasDepthAmbiguity: multiStability.hasDepthAmbiguity,
        summary: this._generateSummary(totalScore, contrast, lateralInhibition, gestalt, multiStability)
      },
      maps: {
        lateralInhibition: lateralInhibition.responseMap,
        gestaltEdges: gestalt.edgeMap,
        multiStability: multiStability.varianceMap
      }
    };
  }

  _generateSummary(score, contrast, lateral, gestalt, multi) {
    const issues = [];
    if (!contrast.passAA) issues.push("Low contrast ratio below WCAG AA threshold (< 4.5:1)");
    if (lateral.machBandWarning) issues.push("Mach banding glare risk along luminance step transitions");
    if (gestalt.separationWarning) issues.push("Weak figure-ground separation and edge orientation coherence");
    if (multi.hasDepthAmbiguity) issues.push("Spatial multi-stability depth flip ambiguity detected");

    if (issues.length === 0) {
      return `Excellent perceptual fidelity (Score: ${score}/100). Clear figure-ground legibility and stable visual optics.`;
    }
    return `Perceptual audit flags ${issues.length} item(s): ${issues.join("; ")}.`;
  }
}

// --- 02. Interactive UI, Event Listeners & Rendering Logic ---

document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("viewport");
  if (!viewport) return;
  const ctxViewport = viewport.getContext("2d");

  const inhibitionMap = document.getElementById("inhibitionMap");
  const ctxInhibition = inhibitionMap.getContext("2d");

  const edgeMapCanvas = document.getElementById("edgeMap");
  const ctxEdge = edgeMapCanvas.getContext("2d");

  const multiMapCanvas = document.getElementById("multiMap");
  const ctxMulti = multiMapCanvas ? multiMapCanvas.getContext("2d") : null;

  // Control Elements
  const sigmaSlider = document.getElementById("sigmaSlider");
  const gestaltSlider = document.getElementById("gestaltSlider");
  const multiSlider = document.getElementById("multiSlider");

  const sigmaVal = document.getElementById("sigmaVal");
  const gestaltVal = document.getElementById("gestaltVal");
  const multiVal = document.getElementById("multiVal");

  const runAuditBtn = document.getElementById("runAuditBtn");
  const resetBtn = document.getElementById("resetBtn");
  const scoreNum = document.getElementById("scoreNum");
  const scoreCircle = document.getElementById("scoreCircle");
  const statusBadge = document.getElementById("statusBadge");
  const summaryText = document.getElementById("summaryText");
  const resolutionBadge = document.getElementById("resolutionBadge");

  // Metric Card & Table Elements
  const mContrast = document.getElementById("mContrast");
  const sContrast = document.getElementById("sContrast");
  const mInhibition = document.getElementById("mInhibition");
  const sInhibition = document.getElementById("sInhibition");
  const mGestalt = document.getElementById("mGestalt");
  const sGestalt = document.getElementById("sGestalt");
  const mMulti = document.getElementById("mMulti");
  const sMulti = document.getElementById("sMulti");

  const cardValContrast = document.getElementById("cardValContrast");
  const cardBadgeContrast = document.getElementById("cardBadgeContrast");
  const cardValInhibition = document.getElementById("cardValInhibition");
  const cardBadgeInhibition = document.getElementById("cardBadgeInhibition");
  const cardValGestalt = document.getElementById("cardValGestalt");
  const cardBadgeGestalt = document.getElementById("cardBadgeGestalt");
  const cardValMulti = document.getElementById("cardValMulti");
  const cardBadgeMulti = document.getElementById("cardBadgeMulti");

  const recommendationsList = document.getElementById("recommendationsList");

  let currentPreset = "machBands";

  // Sync Slider Display Values
  if (sigmaSlider && sigmaVal) {
    sigmaSlider.addEventListener("input", (e) => {
      sigmaVal.textContent = e.target.value;
      runAudit();
    });
  }
  if (gestaltSlider && gestaltVal) {
    gestaltSlider.addEventListener("input", (e) => {
      gestaltVal.textContent = e.target.value;
      runAudit();
    });
  }
  if (multiSlider && multiVal) {
    multiSlider.addEventListener("input", (e) => {
      multiVal.textContent = e.target.value;
      runAudit();
    });
  }

  // Preset Buttons
  document.querySelectorAll(".btn-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPreset = btn.dataset.preset;
      drawPresetPattern(currentPreset);
      runAudit();
    });
  });

  // Action Buttons
  if (runAuditBtn) runAuditBtn.addEventListener("click", runAudit);
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (sigmaSlider) { sigmaSlider.value = 1.8; sigmaVal.textContent = "1.8"; }
      if (gestaltSlider) { gestaltSlider.value = 0.42; gestaltVal.textContent = "0.42"; }
      if (multiSlider) { multiSlider.value = 0.75; multiVal.textContent = "0.75"; }
      document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
      const firstPreset = document.querySelector('.btn-preset[data-preset="machBands"]');
      if (firstPreset) firstPreset.classList.add("active");
      currentPreset = "machBands";
      drawPresetPattern(currentPreset);
      runAudit();
    });
  }

  // Image File Upload & Drag-and-Drop
  const imageUploader = document.getElementById("imageUploader");
  const dropzone = document.getElementById("dropzone");

  function loadCustomImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
        
        // Preserve image aspect ratio inside viewport
        const w = 320;
        const h = 240;
        viewport.width = w;
        viewport.height = h;

        ctxViewport.fillStyle = "#000000";
        ctxViewport.fillRect(0, 0, w, h);

        const hRatio = w / img.width;
        const vRatio = h / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShiftX = (w - img.width * ratio) / 2;
        const centerShiftY = (h - img.height * ratio) / 2;

        ctxViewport.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
        if (resolutionBadge) resolutionBadge.textContent = `${img.width} × ${img.height} px (Scaled)`;
        runAudit();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  if (imageUploader) {
    imageUploader.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        loadCustomImage(e.target.files[0]);
      }
    });
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadCustomImage(e.dataTransfer.files[0]);
      }
    });
  }

  function drawPresetPattern(preset) {
    const w = 320;
    const h = 240;
    viewport.width = w;
    viewport.height = h;

    ctxViewport.fillStyle = "#000000";
    ctxViewport.fillRect(0, 0, w, h);
    if (resolutionBadge) resolutionBadge.textContent = `${w} × ${h} px`;

    if (preset === "machBands") {
      const steps = 6;
      const stepW = w / steps;
      for (let i = 0; i < steps; i++) {
        const luminance = Math.floor((i / (steps - 1)) * 255);
        ctxViewport.fillStyle = `rgb(${luminance}, ${luminance}, ${luminance})`;
        ctxViewport.fillRect(i * stepW, 0, stepW, h);
      }
    } else if (preset === "highContrast") {
      ctxViewport.fillStyle = "#0f172a";
      ctxViewport.fillRect(0, 0, w, h);

      ctxViewport.fillStyle = "#1e293b";
      ctxViewport.fillRect(20, 20, w - 40, h - 40);

      ctxViewport.fillStyle = "#f8fafc";
      ctxViewport.font = "bold 16px sans-serif";
      ctxViewport.fillText("PERCEPTUAL EVAL", 40, 55);

      ctxViewport.fillStyle = "#94a3b8";
      ctxViewport.font = "12px sans-serif";
      ctxViewport.fillText("Contrast ratio legibility audit", 40, 75);

      ctxViewport.fillStyle = "#38bdf8";
      ctxViewport.fillRect(40, 100, 120, 36);

      ctxViewport.fillStyle = "#0f172a";
      ctxViewport.font = "bold 12px sans-serif";
      ctxViewport.fillText("ACTION BTN", 60, 122);
    } else if (preset === "gestaltGrid") {
      ctxViewport.fillStyle = "#111827";
      ctxViewport.fillRect(0, 0, w, h);

      ctxViewport.strokeStyle = "#10b981";
      ctxViewport.lineWidth = 3;

      ctxViewport.beginPath();
      ctxViewport.arc(w / 2, h / 2, 70, 0, Math.PI * 1.5);
      ctxViewport.stroke();

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
      ctxViewport.fillStyle = "#050811";
      ctxViewport.fillRect(0, 0, w, h);

      ctxViewport.strokeStyle = "#e2e8f0";
      ctxViewport.lineWidth = 2;

      const size = 70;
      const cx = w / 2 - 35;
      const cy = h / 2 - 35;
      const offset = 25;

      ctxViewport.strokeRect(cx, cy, size, size);
      ctxViewport.strokeRect(cx + offset, cy - offset, size, size);

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

  function renderHeatmap(canvas, floatArray, width, height, colorMode = "inhibition") {
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const canvasCtx = canvas.getContext("2d");
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
        data[idx] = Math.floor(norm * 255);        // Red
        data[idx + 1] = Math.floor((1 - norm) * 220); // Green
        data[idx + 2] = Math.floor((1 - norm) * 255); // Blue
      } else if (colorMode === "gestalt") {
        data[idx] = 0;
        data[idx + 1] = Math.floor(norm * 255);
        data[idx + 2] = Math.floor(norm * 180);
      } else if (colorMode === "multi") {
        data[idx] = Math.floor(norm * 245);
        data[idx + 1] = Math.floor(norm * 158);
        data[idx + 2] = 11;
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

    // Update Score Circle & Overall Badge
    if (scoreNum) scoreNum.textContent = report.score;
    if (summaryText) summaryText.textContent = report.diagnostics.summary;

    if (scoreCircle) {
      if (report.score >= 80) {
        scoreCircle.style.borderColor = "var(--accent-green)";
        scoreCircle.style.background = "radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)";
      } else if (report.score >= 50) {
        scoreCircle.style.borderColor = "var(--accent-yellow)";
        scoreCircle.style.background = "radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%)";
      } else {
        scoreCircle.style.borderColor = "var(--accent-red)";
        scoreCircle.style.background = "radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%)";
      }
    }

    if (statusBadge) {
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
    }

    // Update 4 Metric Cards
    if (cardValContrast) cardValContrast.textContent = `${report.metrics.contrastRatio}:1`;
    if (cardBadgeContrast) {
      cardBadgeContrast.textContent = report.diagnostics.wcagPassAA ? "WCAG AA" : "POOR";
      cardBadgeContrast.style.background = report.diagnostics.wcagPassAA ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
      cardBadgeContrast.style.color = report.diagnostics.wcagPassAA ? "var(--accent-green)" : "var(--accent-red)";
    }

    if (cardValInhibition) cardValInhibition.textContent = report.metrics.lateralInhibitionPeak;
    if (cardBadgeInhibition) {
      cardBadgeInhibition.textContent = report.diagnostics.machBandingWarning ? "GLARE" : "STABLE";
      cardBadgeInhibition.style.background = report.diagnostics.machBandingWarning ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)";
      cardBadgeInhibition.style.color = report.diagnostics.machBandingWarning ? "var(--accent-yellow)" : "var(--accent-green)";
    }

    if (cardValGestalt) cardValGestalt.textContent = report.metrics.gestaltContinuity;
    if (cardBadgeGestalt) {
      cardBadgeGestalt.textContent = report.diagnostics.gestaltSeparationWarning ? "WEAK" : "OPTIMAL";
      cardBadgeGestalt.style.background = report.diagnostics.gestaltSeparationWarning ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)";
      cardBadgeGestalt.style.color = report.diagnostics.gestaltSeparationWarning ? "var(--accent-yellow)" : "var(--accent-green)";
    }

    if (cardValMulti) cardValMulti.textContent = report.metrics.multiStabilityIndex;
    if (cardBadgeMulti) {
      cardBadgeMulti.textContent = report.diagnostics.hasDepthAmbiguity ? "AMBIGUOUS" : "STABLE";
      cardBadgeMulti.style.background = report.diagnostics.hasDepthAmbiguity ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)";
      cardBadgeMulti.style.color = report.diagnostics.hasDepthAmbiguity ? "var(--accent-yellow)" : "var(--accent-green)";
    }

    // Update Metrics Table
    if (mContrast) mContrast.textContent = `${report.metrics.contrastRatio}:1`;
    if (sContrast) {
      sContrast.innerHTML = report.diagnostics.wcagPassAAA
        ? `<span class="pass-text">PASS (AAA)</span>`
        : report.diagnostics.wcagPassAA 
        ? `<span class="pass-text">PASS (AA)</span>` 
        : `<span class="fail-text">FAIL (< 4.5:1)</span>`;
    }

    if (mInhibition) mInhibition.textContent = report.metrics.lateralInhibitionPeak;
    if (sInhibition) {
      sInhibition.innerHTML = report.diagnostics.machBandingWarning 
        ? `<span class="warn-text">GLARE RISK (> 2.4)</span>` 
        : `<span class="pass-text">STABLE (&le; 2.4)</span>`;
    }

    if (mGestalt) mGestalt.textContent = report.metrics.gestaltContinuity;
    if (sGestalt) {
      sGestalt.innerHTML = report.diagnostics.gestaltSeparationWarning 
        ? `<span class="warn-text">LOW SEPARATION (< 0.65)</span>` 
        : `<span class="pass-text">OPTIMAL (&ge; 0.65)</span>`;
    }

    if (mMulti) mMulti.textContent = report.metrics.multiStabilityIndex;
    if (sMulti) {
      sMulti.innerHTML = report.diagnostics.hasDepthAmbiguity 
        ? `<span class="warn-text">3D AMBIGUITY (> 0.30)</span>` 
        : `<span class="pass-text">STABLE (&le; 0.30)</span>`;
    }

    // Render Heatmaps
    renderHeatmap(inhibitionMap, report.maps.lateralInhibition, viewport.width, viewport.height, "inhibition");
    renderHeatmap(edgeMapCanvas, report.maps.gestaltEdges, viewport.width, viewport.height, "gestalt");
    if (multiMapCanvas && report.maps.multiStability) {
      renderHeatmap(multiMapCanvas, report.maps.multiStability, viewport.width, viewport.height, "multi");
    }

    // Generate Actionable Recommendations
    if (recommendationsList) {
      const recs = [];
      if (!report.diagnostics.wcagPassAA) {
        recs.push(`<strong>Luminance Contrast (${report.metrics.contrastRatio}:1) is below WCAG AA (4.5:1):</strong> Increase text brightness or darken surface background for legibility.`);
      } else if (report.diagnostics.wcagPassAAA) {
        recs.push(`<strong>Excellent Text Contrast (${report.metrics.contrastRatio}:1):</strong> Meets strict WCAG AAA standards.`);
      }

      if (report.diagnostics.machBandingWarning) {
        recs.push(`<strong>Mach Band Glare Risk Detected (DoG Peak: ${report.metrics.lateralInhibitionPeak}):</strong> Sharp step transitions simulate retinal ganglion cell over-excitation. Smooth step edges with subtle dithering or blur.`);
      }

      if (report.diagnostics.gestaltSeparationWarning) {
        recs.push(`<strong>Weak Gestalt Edge Continuity (${report.metrics.gestaltContinuity}):</strong> Edge orientation vectors lack structural coherence. Sharpen boundary outlines or increase figure-ground contrast.`);
      }

      if (report.diagnostics.hasDepthAmbiguity) {
        recs.push(`<strong>Multi-Stability 3D Depth Ambiguity (${report.metrics.multiStabilityIndex}):</strong> Spatial phase symmetry creates conflicting visual depth flip illusions (Necker effect). Break horizontal symmetry or add directional shadows.`);
      }

      if (recs.length === 0) {
        recs.push("<strong>Optimal Optical Performance:</strong> All 4 visual perception metrics pass technical benchmarks with high perceptual fidelity.");
      }

      recommendationsList.innerHTML = recs.map(r => `<li>${r}</li>`).join("");
    }
  }

  // Initial Draw & Audit
  drawPresetPattern(currentPreset);
  runAudit();
});
