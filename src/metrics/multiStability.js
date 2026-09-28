import { toGrayscaleMatrix } from "../utils/image.js";

/**
 * Computes Multi-Stability Index (M_s) for ambiguous spatial depth regions.
 * Measures spatial frequency symmetry phase inversion variance.
 *
 * @param {{ data: ArrayLike<number>, width: number, height: number }} imageData 
 * @param {number} sensitivity 
 * @returns {{ multiStabilityIndex: number, hasDepthAmbiguity: boolean, phaseVariance: number }}
 */
export function computeMultiStability(imageData, sensitivity = 0.75) {
  const { width, height } = imageData;
  const grayscale = toGrayscaleMatrix(imageData);

  // Divide image into spatial macro-blocks (e.g. 8x8 or 16x16 grid)
  const gridX = 8;
  const gridY = 8;
  const blockW = Math.floor(width / gridX);
  const blockH = Math.floor(height / gridY);

  if (blockW < 2 || blockH < 2) {
    return { multiStabilityIndex: 0.1, hasDepthAmbiguity: false, phaseVariance: 0.05 };
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

          // Phase inversion delta
          const diff = Math.abs(leftPixel - rightPixel);
          horizontalSymmetry += 1.0 - diff;
          count++;
        }
      }

      if (count > 0) {
        blockSymmetries.push(horizontalSymmetry / count);
      }
    }
  }

  // Calculate variance across spatial block symmetries
  let sum = 0;
  for (const s of blockSymmetries) sum += s;
  const mean = sum / blockSymmetries.length;

  let varianceSum = 0;
  for (const s of blockSymmetries) {
    varianceSum += (s - mean) * (s - mean);
  }

  const phaseVariance = blockSymmetries.length > 0 ? varianceSum / blockSymmetries.length : 0;

  // Scale variance by sensitivity parameter to compute multi-stability index M_s
  const rawIndex = Math.min(1.0, Math.sqrt(phaseVariance) * (1.5 + sensitivity));
  const multiStabilityIndex = Math.round(rawIndex * 100) / 100;

  // Multi-stability threshold: M_s <= 0.30 is target; > 0.30 flags ambiguous depth oscillations
  const hasDepthAmbiguity = multiStabilityIndex > 0.30;

  return {
    multiStabilityIndex,
    hasDepthAmbiguity,
    phaseVariance: Math.round(phaseVariance * 1000) / 1000
  };
}
