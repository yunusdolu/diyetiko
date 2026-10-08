import 'server-only';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { backend, env } from '@/lib/env';

export type Bucket =
  'recipe-media' | 'site-media' | 'client-files' | 'diary-photos' | 'client-uploads';

export const LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  clientTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'text/plain',
  ],
  mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  /** Meal photos are resized to ≤1600 px JPEG in the browser first (which also drops EXIF/GPS). */
  photoMaxBytes: 4 * 1024 * 1024,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

const localRoot = () =>
  path.join(/* turbopackIgnore: true */ process.cwd(), env.localDataDir, 'storage');

/** Rejects "..", absolute paths and anything outside [a-zA-Z0-9._/-]. */
export function safeObjectPath(p: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(p) || p.includes('..') || p.startsWith('/'))
    throw new Error('bad path');
  return p;
}

export function objectName(ownerId: string, scope: string, fileName: string): string {
  const ext =
    (fileName.split('.').pop() ?? 'bin')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8) || 'bin';
  return `${ownerId}/${scope}/${crypto.randomUUID()}.${ext}`;
}

export async function putObject(
  bucket: Bucket,
  objectPath: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const p = safeObjectPath(objectPath);
  if (backend() === 'local') {
    const file = path.join(localRoot(), bucket, p);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(bytes));
    return;
  }
  // Uses the signed-in user's session → Storage RLS applies (owner folder only).
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(p, bytes, { contentType, upsert: false });
  if (error) throw error;
}

export async function removeObjects(bucket: Bucket, paths: string[]): Promise<void> {
  if (!paths.length) return;
  if (backend() === 'local') {
    await Promise.all(
      paths.map((p) => rm(path.join(localRoot(), bucket, safeObjectPath(p)), { force: true })),
    );
    return;
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(bucket).remove(paths.map(safeObjectPath));
}

/** Private files: a 60-second signed URL (Supabase) or the bytes themselves (local mode). */
export async function readPrivate(
  objectPath: string,
): Promise<{ url: string } | { bytes: Buffer }> {
  const p = safeObjectPath(objectPath);
  if (backend() === 'local')
    return { bytes: await readFile(path.join(localRoot(), 'client-files', p)) };
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from('client-files').createSignedUrl(p, 60);
  if (error || !data) throw error ?? new Error('sign failed');
  return { url: data.signedUrl };
}

/**
 * Private object bytes (meal photos). Supabase: downloaded with the signed-in user's session, so
 * Storage RLS decides (the client's own folder, or the dietitian's practice). Local: the caller has
 * already checked access through the database (RLS) before asking for the path.
 */
export async function downloadPrivate(
  bucket: 'diary-photos' | 'client-uploads',
  objectPath: string,
): Promise<Buffer> {
  const p = safeObjectPath(objectPath);
  if (backend() === 'local') return readFile(path.join(localRoot(), bucket, p));
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).download(p);
  if (error || !data) throw error ?? new Error('download failed');
  return Buffer.from(await data.arrayBuffer());
}

/** True when the bytes really are a JPEG, PNG or WebP image (never trust the declared type). */
export function sniffImage(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  const ascii = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Local mode only: public media served by /api/media. */
export async function readLocalPublic(
  bucket: 'recipe-media' | 'site-media',
  objectPath: string,
): Promise<Buffer> {
  return readFile(path.join(localRoot(), bucket, safeObjectPath(objectPath)));
}

/** What a message may carry: a PDF or a picture, told from the bytes (never the declared type). */
export type UploadType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
export const UPLOAD_EXT: Record<UploadType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export function sniffUpload(bytes: Uint8Array): UploadType | null {
  // "%PDF-" within the first kilobyte (some writers put a few bytes before it)
  const head = String.fromCharCode(...bytes.slice(0, 1024));
  if (head.includes('%PDF-')) return 'application/pdf';
  return sniffImage(bytes);
}
