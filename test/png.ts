// A real PNG, written by hand, so the browser has an image to decode rather than a
// fixture of bytes that happens to be called one. Only the end-to-end suite needs
// this, so it lives outside `src` rather than in a route directory.

import { randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';

/**
 * `noise` fills the image with random pixels, because an image that compresses is
 * an image the browser has no reason to shrink: only a photo that costs real bytes
 * to upload is a faithful stand-in for a phone camera.
 */
export function png(width: number, height: number, noise = false): Buffer {
	const bytesPerRow = width * 3 + 1;
	const raw = Buffer.alloc(bytesPerRow * height);
	const random = noise ? randomBytes(width * height * 3) : undefined;

	for (let y = 0; y < height; y++) {
		const row = y * bytesPerRow;
		raw[row] = 0; // filter: none
		for (let x = 0; x < width; x++) {
			const pixel = row + 1 + x * 3;
			if (random !== undefined) {
				const source = (y * width + x) * 3;
				raw[pixel] = random[source];
				raw[pixel + 1] = random[source + 1];
				raw[pixel + 2] = random[source + 2];
			} else {
				raw[pixel] = (x + y) % 256;
				raw[pixel + 1] = (x * 3) % 256;
				raw[pixel + 2] = (x * 5) % 256;
			}
		}
	}

	const chunk = (type: string, data: Buffer) => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body) >>> 0);
		return Buffer.concat([length, body, crc]);
	};

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8; // bit depth
	header[9] = 2; // truecolour

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	return value >>> 0;
});

function crc32(buffer: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}
