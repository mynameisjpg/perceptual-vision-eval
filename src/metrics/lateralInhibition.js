import { toGrayscaleMatrix } from "../utils/image.js";

/**
 * Computes 1D Gaussian kernel.
 * @param {number} sigma 
 * @returns {Float32Array}
 */
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

/**
 * Convolves 2D Float32Array matrix with separable 1D Gaussian kernel.
 */
function gaussianBlur2D(input, width, height, sigma) {
  const kernel = create1DGaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const temp = new Float32Array(width * height);
  const output = new Float32Array(width * height);

  // Horizontal pass
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

  // Vertical pass
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

/**
 * Computes Mach Banding and Lateral Inhibition using Difference of Gaussians (DoG) filter.
 * Simulates retinal ganglion cell center-surround receptive fields.
 *
 * @param {{ data: ArrayLike<number>, width: number, height: number }} imageData 
 * @param {number} sigma 
 * @returns {{ peakRatio: number, machBandWarning: boolean, responseMap: Float32Array, maxOvershoot: number }}
 */
export function computeLateralInhibition(imageData, sigma = 1.8) {
  const { width, height } = imageData;
  const grayscale = toGrayscaleMatrix(imageData);

  // Center-surround receptive field parameters
  const sigmaCenter = Math.max(0.5, sigma * 0.5);
  const sigmaSurround = sigma * 1.5;

  const gCenter = gaussianBlur2D(grayscale, width, height, sigmaCenter);
  const gSurround = gaussianBlur2D(grayscale, width, height, sigmaSurround);

  const responseMap = new Float32Array(width * height);
  let maxOvershoot = 0.0;
  let responseSum = 0.0;

  for (let i = 0; i < width * height; i++) {
    // Difference of Gaussians (DoG) proxy for lateral inhibition
    const dog = gCenter[i] - gSurround[i];
    responseMap[i] = dog;
    const absDog = Math.abs(dog);
    if (absDog > maxOvershoot) {
      maxOvershoot = absDog;
    }
    responseSum += absDog;
  }

  // Scale peak edge ratio: typical perceptual Mach band threshold is ~2.4 in spatial contrast response
  const peakRatio = Math.round((maxOvershoot * 10) * 100) / 100;
  const machBandWarning = peakRatio > 2.4;

  return {
    peakRatio,
    maxOvershoot: Math.round(maxOvershoot * 1000) / 1000,
    machBandWarning,
    responseMap
  };
}
