import { normalizeImageData } from "./utils/image.js";
import { computeLuminanceContrast } from "./metrics/contrast.js";
import { computeLateralInhibition } from "./metrics/lateralInhibition.js";
import { computeGestaltContinuity } from "./metrics/gestalt.js";
import { computeMultiStability } from "./metrics/multiStability.js";

/**
 * Main evaluation class for automated psychophysical diagnostics.
 */
export class PerceptualEvaluator {
  /**
   * @param {Object} [options]
   * @param {'WCAG21'|'RelativeLuminance'} [options.luminanceFormula='WCAG21']
   * @param {number} [options.lateralInhibitionSigma=1.8] Center-surround receptive field kernel size
   * @param {number} [options.gestaltThreshold=0.42] Edge grouping sensitivity threshold
   * @param {number} [options.multiStabilitySensitivity=0.75] Oscillatory depth detection sensitivity
   */
  constructor(options = {}) {
    this.luminanceFormula = options.luminanceFormula || "WCAG21";
    this.lateralInhibitionSigma = options.lateralInhibitionSigma ?? 1.8;
    this.gestaltThreshold = options.gestaltThreshold ?? 0.42;
    this.multiStabilitySensitivity = options.multiStabilitySensitivity ?? 0.75;
  }

  /**
   * Evaluates ImageData or Canvas against psychophysical perception metrics.
   * 
   * @param {HTMLCanvasElement|CanvasRenderingContext2D|ImageData|{data: ArrayLike<number>, width: number, height: number}} input 
   * @returns {{ score: number, metrics: Object, diagnostics: Object, maps: Object }}
   */
  analyze(input) {
    const imageData = normalizeImageData(input);

    const contrast = computeLuminanceContrast(imageData, this.luminanceFormula);
    const lateralInhibition = computeLateralInhibition(imageData, this.lateralInhibitionSigma);
    const gestalt = computeGestaltContinuity(imageData, this.gestaltThreshold);
    const multiStability = computeMultiStability(imageData, this.multiStabilitySensitivity);

    // Compute composite perceptual score (0 - 100)
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
        gestaltEdges: gestalt.edgeMap
      }
    };
  }

  /**
   * @private
   */
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
