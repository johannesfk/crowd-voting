# Photos live in R2, downscaled in the browser to 1600px / 300 KB

Entry photos are stored as R2 objects. They are downscaled and re-encoded client-side to a 1600px long edge and ~300 KB JPEG before upload, then uploaded as multipart `FormData`.

The target sizes follow from the render context (card thumbnails and a podium graphic, so 1600px covers 2x retina) and from iOS limits: Safari caps a canvas at 3 megapixels on low-memory devices and enforces a 384 MB per-page canvas budget, so an un-downscaled 12 MP phone photo both fails to decode cleanly and wastes memory. Re-encoding through a canvas also bakes EXIF orientation into pixels, which matters because iOS strips orientation metadata without rotating pixels when a user picks a non-original quality in the picker.

Rejected: `getUserMedia` with a live preview — HTTPS-only, and a camera permission prompt at a party is widely denied; the file input has no prompt at all. Rejected: base64 in a JSON body — 33% wire overhead and Safari truncates base64 around 512 KB. Rejected: storing images in D1 — row size limits and degraded unrelated queries.

## Consequences

Two file inputs are required, not one: Android 14+ Chrome removed the camera tile from the photo picker for a plain image accept, so `capture` goes on a dedicated "Take photo" button and the library button omits it. The picker fires `cancel` when the same file is re-picked, so handlers must guard on `files.length === 0` and treat a decode failure by falling back to the original file.