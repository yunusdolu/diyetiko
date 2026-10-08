/**
 * Browser-side meal photo preparation: correct orientation, at most 1600 px on the long side,
 * JPEG ~0.82. Re-encoding through a canvas also DROPS ALL METADATA (EXIF incl. GPS location),
 * which matters for photos taken at home. A 4–8 MB phone photo becomes ~200–400 kB.
 */
export async function preparePhoto(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('encode failed');
  return blob;
}
