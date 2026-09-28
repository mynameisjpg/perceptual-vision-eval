# Perceptual Vision Eval Toolkit

> Psychophysical Evaluation Framework for Synthetic Media & Web UI Assessment

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js CI](https://img.shields.io/badge/Node.js-%3E%3D%2018.0.0-brightgreen.svg)](https://nodejs.org/)

The **Perceptual Vision Eval Toolkit** is an open-source browser and Node.js evaluation framework measuring luminance contrast, Gestalt edge continuity, lateral inhibition proxies, and visual multi-stability in AI outputs and synthetic media graphics.

Built on foundational psychophysics from **David Cycleback's *Art Perception*** and **Rudolf Arnheim's visual psychology**, this toolkit provides automated perceptual diagnostics for generated graphics, dark mode surfaces, and dynamic web UI components.

---

## 01. Evaluation Pipeline Architecture

```text
EVALUATION PIPELINE ARCHITECTURE:
[CANVAS / IMAGE INPUT] ──(Grayscale / Luminance Reduction)──> [LATERAL INHIBITION KERNEL]
                                                                        │
                                                                        ▼
[GESTALT EDGE MAP] <──(Sobel / Laplacian High Pass)─── [CONTRAST METRIC MATRIX]
        │
        ▼
[PERCEPTUAL LEGIBILITY SCORE & MULTI-STABILITY DIAGNOSTIC]
```

---

## 02. Key Capabilities

1. **Mach Banding & Lateral Inhibition Simulation:** Computes spatial contrast enhancement along luminance boundaries using a Difference of Gaussians (DoG) filter ($K_{\text{DoG}} = G_{\sigma_1} - G_{\sigma_2}$) to detect visual glare and legibility fatigue.
2. **Gestalt Edge Continuity Index ($C_g$):** Measures line orientation vector coherence and figure-ground separation ratios using Sobel gradient filters.
3. **Multi-Stability Score ($M_s$):** Detects ambiguous spatial regions where the human visual system oscillates between conflicting 3D depth interpretations (e.g., Necker cube flips or dithered noise flips).
4. **WCAG 2.2 + Psychophysical Contrast Ratios ($L_r$):** Evaluates text & component legibility across dithered backgrounds, dark mode surfaces, and high-frequency visual noise.

---

## 03. Quickstart & Installation

Install the package via `npm` or clone the repository directly for local Node.js / browser usage:

```bash
# Clone repository
git clone https://github.com/untitled-jpg/perceptual-vision-eval.git

# Navigate to project root
cd perceptual-vision-eval

# Run built-in test suite
npm test

# Launch interactive HTML5 Canvas demo
npm run demo
```

---

## 04. API Reference & Usage

The toolkit exposes both a high-level `PerceptualEvaluator` class and standalone psychophysical metric utilities.

### ESM Import

```javascript
import {
  PerceptualEvaluator,
  computeLuminanceContrast,
  computeLateralInhibition,
  computeGestaltContinuity,
  computeMultiStability
} from "perceptual-vision-eval";

// Select target canvas element or image buffer object ({ data, width, height })
const canvas = document.getElementById("viewport");
const ctx = canvas.getContext("2d");
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// Initialize evaluator with Cycleback psychophysical parameters
const evaluator = new PerceptualEvaluator({
  luminanceFormula: "WCAG21",          // 'WCAG21' | 'RelativeLuminance'
  lateralInhibitionSigma: 1.8,         // Center-surround receptive field kernel size
  gestaltThreshold: 0.42,              // Edge grouping sensitivity threshold
  multiStabilitySensitivity: 0.75      // Oscillatory depth detection sensitivity
});

// Run automated perceptual audit
const report = evaluator.analyze(imageData);

console.log(`Perceptual Score: ${report.score} / 100`);
console.log(`Contrast Ratio: ${report.metrics.contrastRatio}:1`);
console.log(`Gestalt Continuity: ${report.metrics.gestaltContinuity}`);
console.log(`Multi-Stability Warning: ${report.diagnostics.hasDepthAmbiguity}`);
console.log(`Summary: ${report.diagnostics.summary}`);
```

---

## 05. Technical Specifications & Benchmark Ratios

| Metric Parameter | Formula / Method | Target Threshold | Perceptual Diagnostic |
| :--- | :--- | :--- | :--- |
| **Luminance Contrast ($L_r$)** | $\frac{L_1 + 0.05}{L_2 + 0.05}$ | $\ge 4.5:1$ (AA), $\ge 7:1$ (AAA) | Text & UI legibility against dark slate backgrounds |
| **Lateral Inhibition ($\mathbf{K}_{\text{DoG}}$)** | Difference of Gaussians: $G_{\sigma_1} - G_{\sigma_2}$ | Peak edge ratio $\le 2.4$ | Prevents Mach band glare and visual fatigue |
| **Gestalt Continuity ($C_g$)** | Orientation vector histogram coherence | $C_g \in [0.65, 0.95]$ | Ensures clear figure-ground separation |
| **Multi-Stability Index ($M_s$)** | Spatial frequency phase inversion variance | $M_s \le 0.30$ | Flags ambiguous 3D visual flips in synthetic graphics |

---

## 06. Interactive HTML5 Canvas Demo

To run the interactive browser demo locally, start the demo server:

```bash
npm run demo
```

Then open `http://localhost:3000` in your web browser to test preset synthetic patterns (Mach bands, UI text legibility, Gestalt grids, multi-stable figures) and view live diagnostic heatmaps.

---

## 07. License

MIT License — free for open-source and commercial use. See [LICENSE](LICENSE) for details.
