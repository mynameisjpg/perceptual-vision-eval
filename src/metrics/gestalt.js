import { toGrayscaleMatrix } from "../utils/image.js";

/**
 * Computes Gestalt Edge Continuity Index (C_g) and figure-ground separation metrics.
 * Uses Sobel filters to extract gradient magnitude & orientation vector coherence.
 *
 * @param {{ data: ArrayLike<number>, width: number, height: number }} imageData 
 * @param {number} threshold 
 * @returns {{ gestaltContinuity: number, edgeDensity: number, coherenceScore: number, separationWarning: boolean, edgeMap: Float32Array }}
 */
export function computeGestaltContinuity(imageData, threshold = 0.42) {
  const { width, height } = imageData;
  const grayscale = toGrayscaleMatrix(imageData);

  const edgeMap = new Float32Array(width * height);
  const orientations = new Float32Array(width * height);

  let edgePixelCount = 0;
  let totalCoherenceSum = 0;

  // Sobel convolution
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

      // Sobel Kernels
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

  // Calculate local orientation alignment (Gestalt Good Continuation)
  let validNeighbors = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (edgeMap[idx] < threshold * 0.3) continue;

      const theta1 = orientations[idx];

      // Check 8-neighborhood orientation delta
      const neighbors = [
        orientations[(y - 1) * width + x],
        orientations[(y + 1) * width + x],
        orientations[y * width + (x - 1)],
        orientations[y * width + (x + 1)]
      ];

      for (const theta2 of neighbors) {
        const delta = Math.abs(theta1 - theta2);
        const alignment = Math.cos(2 * delta); // Smooth orientation alignment [1 = parallel, -1 = orthogonal]
        totalCoherenceSum += (alignment + 1) / 2; // Map to [0, 1]
        validNeighbors++;
      }
    }
  }

  const edgeDensity = edgePixelCount / (width * height);
  const coherenceScore = validNeighbors > 0 ? totalCoherenceSum / validNeighbors : 0.5;

  // Gestalt Continuity score combining edge strength and smooth orientation alignment
  const rawContinuity = 0.4 * Math.min(1.0, edgeDensity * 12) + 0.6 * coherenceScore;
  const gestaltContinuity = Math.round(rawContinuity * 100) / 100;

  // Target threshold range is [0.65, 0.95] for clear visual grouping & figure-ground separation
  const separationWarning = gestaltContinuity < 0.65;

  return {
    gestaltContinuity,
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
    coherenceScore: Math.round(coherenceScore * 100) / 100,
    separationWarning,
    edgeMap
  };
}
