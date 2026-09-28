/**
 * Normalizes input sources into standard ImageData format ({ data, width, height }).
 * Supports HTMLCanvasElement, CanvasRenderingContext2D, ImageData objects, or raw pixel buffer objects.
 * 
 * @param {HTMLCanvasElement|CanvasRenderingContext2D|ImageData|{data: Uint8ClampedArray|Uint8Array|Array, width: number, height: number}} input 
 * @returns {{ data: Uint8ClampedArray|Uint8Array|Array, width: number, height: number }}
 */
export function normalizeImageData(input) {
  if (!input) {
    throw new Error("Invalid image input provided to perceptual evaluator.");
  }

  // Handle HTMLCanvasElement
  if (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) {
    const ctx = input.getContext("2d");
    return ctx.getImageData(0, 0, input.width, input.height);
  }

  // Handle CanvasRenderingContext2D
  if (typeof CanvasRenderingContext2D !== "undefined" && input instanceof CanvasRenderingContext2D) {
    return input.getImageData(0, 0, input.canvas.width, input.canvas.height);
  }

  // Handle standard ImageData object or generic object with data, width, height
  if (input.data && typeof input.width === "number" && typeof input.height === "number") {
    return {
      data: input.data,
      width: Math.floor(input.width),
      height: Math.floor(input.height)
    };
  }

  throw new Error("Unsupported image input format. Expected ImageData, Canvas, Context2D, or { data, width, height } object.");
}

/**
 * Converts ImageData pixels to 2D Float32Array grayscale matrix normalized [0, 1].
 * Uses standard ITU-R BT.601 / Rec.709 luminance weights: 0.2126 R + 0.7152 G + 0.0722 B.
 * 
 * @param {{ data: ArrayLike<number>, width: number, height: number }} imageData 
 * @returns {Float32Array} Grayscale matrix of size width * height
 */
export function toGrayscaleMatrix(imageData) {
  const { data, width, height } = imageData;
  const grayscale = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;

    // Linear sRGB conversion for psychophysical accuracy
    const rLin = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLin = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLin = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    grayscale[i] = 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }

  return grayscale;
}
