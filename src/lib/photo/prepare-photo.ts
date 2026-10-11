// The browser half of the photo pipeline (ADR 0005). A phone camera produces
// twelve megapixels; venue wifi cannot carry a room full of them, so the image is
// decoded, shrunk to a 1600px long edge and re-encoded to a JPEG of about 300 KB
// before it is uploaded.
//
// Two properties matter more than the compression itself. A photo that is already
// small enough is left completely alone — re-encoding it would only degrade it for
// nothing. And any failure at all, from a corrupt file to a browser with no canvas,
// falls back to the original file, because losing somebody's entry to a decode
// error would be far worse than a slow upload.

/** Long edge of the stored photo: 2x on the card and podium sizes we render. */
export const LONG_EDGE = 1600;

/** Roughly what a downscaled JPEG costs, and the point below which we stop. */
export const TARGET_BYTES = 300 * 1024;

/** Tried in order until the encode is small enough; the last one is the fallback. */
const QUALITIES = [0.82, 0.7, 0.6, 0.5];

export async function preparePhoto(file: File): Promise<File> {
	if (file.size <= TARGET_BYTES) return file;

	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));

		const canvas = document.createElement('canvas');
		// Never upscale, and never a canvas Safari will refuse to allocate: 1600px
		// on the long edge is under its 3 megapixel cap.
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));

		const context = canvas.getContext('2d');
		if (context === null) return file;
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();

		let encoded: Blob | null = null;
		for (const quality of QUALITIES) {
			encoded = await toBlob(canvas, quality);
			if (encoded === null) return file;
			if (encoded.size <= TARGET_BYTES) break;
		}
		if (encoded === null) return file;

		// An encoder that made it bigger has not earned the right to replace what
		// the guest already had.
		if (encoded.size >= file.size) return file;

		return new File([encoded], renamedAsJpeg(file.name), {
			type: 'image/jpeg',
			lastModified: file.lastModified
		});
	} catch {
		// No decoder, no canvas, a file that is not really an image: the guest's
		// entry is worth more than their upload being small.
		return file;
	}
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function renamedAsJpeg(name: string): string {
	return `${name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
}
