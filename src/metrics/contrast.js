import { toGrayscaleMatrix } from "../utils/image.js";

/**
 * Computes luminance metrics and WCAG 2.2 contrast ratios from ImageData.
 *
 * @param {{ data: ArrayLike<number>, width: number, height: number }} imageData 
 * @param {'WCAG21'|'RelativeLuminance'} formula 
 * @returns {{ contrastRatio: number, minLuminance: number, maxLuminance: number, meanLuminance: number, passAA: boolean, passAAA: boolean }}
 */
export function computeLuminanceContrast(imageData, formula = "WCAG21") {
  const grayscale = toGrayscaleMatrix(imageData);
  const totalPixels = grayscale.length;

  if (totalPixels === 0) {
    return { contrastRatio: 1, minLuminance: 0, maxLuminance: 0, meanLuminance: 0, passAA: false, passAAA: false };
  }

  let minL = 1.0;
  let maxL = 0.0;
  let sumL = 0.0;

  // Compute 5th and 95th percentiles to avoid single-pixel outliers
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

  // WCAG Relative Luminance Contrast Formula: (L1 + 0.05) / (L2 + 0.05)
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
