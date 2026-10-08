export type PublicBucket = 'recipe-media' | 'site-media';

/** Public URL for an object in a public bucket (Supabase Storage, or the local media route). */
export function publicMediaUrl(
  bucket: PublicBucket,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const safe = path.split('/').map(encodeURIComponent).join('/');
  return base
    ? `${base}/storage/v1/object/public/${bucket}/${safe}`
    : `/api/media/${bucket}/${safe}`;
}
