# Perceptual Vision Eval Toolkit

> Psychophysical Evaluation Framework for Synthetic Media & Web UI Assessment

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js CI](https://img.shields.io/badge/Node.js-%3E%3D%2018.0.0-brightgreen.svg)](https://nodejs.org/)

The **Perceptual Vision Eval Toolkit** is an open-source browser and Node.js evaluation framework measuring luminance contrast, Gestalt edge continuity, lateral inhibition proxies, and visual multi-stability in AI outputs and synthetic media graphics.

Built on foundational psychophysics from **David Cycleback's _Art Perception_** and **Rudolf Arnheim's visual psychology**, this toolkit provides automated perceptual diagnostics for generated graphics, dark mode surfaces, and dynamic web UI components.

---

## How It Works (In Simple Words)

Think of this toolkit as an **"eye doctor" for computer graphics and UI designs**. It takes an image or HTML canvas, analyzes how the human eye and brain will perceive it, and returns a visual health score out of 100.

### 4 Visual Tests Performed:

1. **Text & UI Readability (Contrast):** Checks if text or buttons stand out clearly from the background so users don't have to squint.
2. **Eye Strain & Glare Protection (Lateral Inhibition):** Simulates human retina cells to flag harsh light-against-dark edges that cause glare, visual ghosting (Mach bands), or eye fatigue.
3. **Shape & Border Flow (Gestalt Edge Continuity):** Checks if lines and borders align neatly into recognizable shapes and separate cleanly from the background.
4. **Visual Illusion Detection (Multi-Stability):** Detects confusing areas where your brain might get tricked into seeing conflicting 3D depth shapes (like optical illusions).

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

## 03. How to Test Any Image

### Option 1: Interactive Browser Demo (No Installation Required)

1. **Open the Demo**: Double-click [`demo/index.html`](demo/index.html) in your file manager to launch it in any web browser (or run `npm run demo` and open `http://localhost:3000`).
2. **Upload or Drag & Drop**:
   - Click **📷 Upload Custom Image** in the left sidebar to select an image from your computer.
   - Or **drag and drop** any `.png`, `.jpg`, or `.webp` file directly onto the **Input Viewport** canvas.
3. **Inspect Diagnostics**:
   - **Perceptual Score**: Composite visual quality score (`0 – 100`).
   - **Luminance Contrast**: WCAG 2.2 AA/AAA legibility status.
   - **Lateral Inhibition DoG Heatmap**: Cyan/red heatmap highlighting high-contrast glare boundaries & Mach banding.
   - **Gestalt Edge Map**: Green edge alignment and figure-ground separation map.
   - **Multi-Stability Index**: Detects 3D depth flip ambiguity.

---

## 04. Programmatic API Usage

Install the package via `npm` or import modules directly:

```javascript
import { PerceptualEvaluator } from "perceptual-vision-eval";

// 1. Initialize evaluator with sensitivity parameters
const evaluator = new PerceptualEvaluator({
  luminanceFormula: "WCAG21",      // 'WCAG21' | 'RelativeLuminance'
  lateralInhibitionSigma: 1.8,     // Center-surround receptive field kernel size
  gestaltThreshold: 0.42,          // Edge grouping sensitivity
  multiStabilitySensitivity: 0.75, // Depth ambiguity sensitivity
});

// 2. Pass HTMLCanvasElement, CanvasRenderingContext2D, ImageData, or { data, width, height }
const canvas = document.getElementById("viewport");
const report = evaluator.analyze(canvas);

// 3. Read automated diagnostic report
console.log(`Perceptual Score: ${report.score} / 100`);
console.log(`Contrast Ratio: ${report.metrics.contrastRatio}:1`);
console.log(`Summary: ${report.diagnostics.summary}`);
```

---

## 05. Technical Specifications & Benchmark Ratios

| Metric Parameter                                   | Formula / Method                                       | Target Threshold                  | Perceptual Diagnostic                                 |
| :------------------------------------------------- | :----------------------------------------------------- | :-------------------------------- | :---------------------------------------------------- |
| **Luminance Contrast ($L_r$)**                     | $\frac{L_1 + 0.05}{L_2 + 0.05}$                        | $\ge 4.5:1$ (AA), $\ge 7:1$ (AAA) | Text & UI legibility against dark slate backgrounds   |
| **Lateral Inhibition ($\mathbf{K}_{\text{DoG}}$)** | Difference of Gaussians: $G_{\sigma_1} - G_{\sigma_2}$ | Peak edge ratio $\le 2.4$         | Prevents Mach band glare and visual fatigue           |
| **Gestalt Continuity ($C_g$)**                     | Orientation vector histogram coherence                 | $C_g \in [0.65, 0.95]$            | Ensures clear figure-ground separation                |
| **Multi-Stability Index ($M_s$)**                  | Spatial frequency phase inversion variance             | $M_s \le 0.30$                    | Flags ambiguous 3D visual flips in synthetic graphics |

---

## 06. Developer Setup & Testing

```bash
# Clone repository
git clone https://github.com/mynameisjpg/perceptual-vision-eval.git
cd perceptual-vision-eval

# Run built-in test suite
npm test

# Launch local server
npm run demo
```

---

## 07. License

MIT License — free for open-source and commercial use. See [LICENSE](LICENSE) for details.
