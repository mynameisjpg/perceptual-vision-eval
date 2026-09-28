import test from "node:test";
import assert from "node:assert/strict";
import {
  PerceptualEvaluator,
  computeLuminanceContrast,
  computeLateralInhibition,
  computeGestaltContinuity,
  computeMultiStability
} from "../src/index.js";

function createMockImageData(width, height, fillRgba = [0, 0, 0, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillRgba[0];
    data[i * 4 + 1] = fillRgba[1];
    data[i * 4 + 2] = fillRgba[2];
    data[i * 4 + 3] = fillRgba[3];
  }
  return { data, width, height };
}

function createHighContrastPattern(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isWhite = x < width / 2;
      const val = isWhite ? 255 : 0;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

test("PerceptualEvaluator - Initialization with defaults", () => {
  const evaluator = new PerceptualEvaluator();
  assert.equal(evaluator.luminanceFormula, "WCAG21");
  assert.equal(evaluator.lateralInhibitionSigma, 1.8);
  assert.equal(evaluator.gestaltThreshold, 0.42);
});

test("computeLuminanceContrast - High contrast split image", () => {
  const image = createHighContrastPattern(20, 20);
  const result = computeLuminanceContrast(image);
  assert.ok(result.contrastRatio > 4.5, "High contrast pattern should exceed AA ratio");
  assert.equal(result.passAA, true);
});

test("computeLateralInhibition - Difference of Gaussians response", () => {
  const image = createHighContrastPattern(30, 30);
  const result = computeLateralInhibition(image, 1.8);
  assert.ok(result.peakRatio >= 0);
  assert.equal(result.responseMap.length, 900);
});

test("computeGestaltContinuity - Edge continuity detection", () => {
  const image = createHighContrastPattern(30, 30);
  const result = computeGestaltContinuity(image, 0.42);
  assert.ok(result.gestaltContinuity >= 0);
  assert.equal(result.edgeMap.length, 900);
});

test("computeMultiStability - Depth ambiguity variance", () => {
  const image = createHighContrastPattern(30, 30);
  const result = computeMultiStability(image, 0.75);
  assert.ok(result.multiStabilityIndex >= 0);
  assert.equal(typeof result.hasDepthAmbiguity, "boolean");
});

test("PerceptualEvaluator.analyze - Complete report output", () => {
  const evaluator = new PerceptualEvaluator({
    luminanceFormula: "WCAG21",
    lateralInhibitionSigma: 1.8,
    gestaltThreshold: 0.42,
    multiStabilitySensitivity: 0.75
  });

  const image = createHighContrastPattern(40, 40);
  const report = evaluator.analyze(image);

  assert.ok(typeof report.score === "number");
  assert.ok(report.score >= 0 && report.score <= 100);
  assert.ok(report.metrics.contrastRatio > 0);
  assert.ok(typeof report.diagnostics.wcagPassAA === "boolean");
  assert.ok(report.diagnostics.summary.length > 0);
  assert.ok(report.maps.lateralInhibition.length === 1600);
  assert.ok(report.maps.gestaltEdges.length === 1600);
});
