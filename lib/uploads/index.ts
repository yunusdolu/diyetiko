import 'server-only';
import { NextResponse } from 'next/server';
import { LIMITS, sniffUpload, UPLOAD_EXT, type UploadType } from '@/lib/storage';

/*
 * Files carried by messages (a lab report as a PDF, a photo of a result). One place for the two
 * rules that matter: what may be stored (PDF or picture, told from the bytes, 10 MB at most) and
 * how it is handed back (its real type, never guessed by the browser, the name as a download hint).
 */

export interface ReadUpload {
  bytes: Uint8Array;
  type: UploadType;
  ext: string;
  /** the sender's file name, trimmed of path parts and odd characters */
  name: string;
}

/** A display name that is safe in a header and a list: no path parts, no control characters. */
export function cleanFileName(raw: string, ext: string): string {
  const base =
    raw
      .split(/[\\/]/)
      .pop()!
      .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
      .trim()
      .slice(0, 160) || `dosya.${ext}`;
  return /\.[A-Za-z0-9]{2,5}$/.test(base) ? base : `${base}.${ext}`;
}

export async function readUpload(
  file: unknown,
): Promise<{ ok: true; file: ReadUpload } | { ok: false; error: 'invalid' | 'tooLarge' | 'type' }> {
  if (!(file instanceof File)) return { ok: false, error: 'invalid' };
  if (file.size <= 0) return { ok: false, error: 'invalid' };
  if (file.size > LIMITS.maxBytes) return { ok: false, error: 'tooLarge' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffUpload(bytes);
  if (!type) return { ok: false, error: 'type' };
  const ext = UPLOAD_EXT[type];
  return { ok: true, file: { bytes, type, ext, name: cleanFileName(file.name, ext) } };
}

export const UPLOAD_STATUS = { invalid: 400, tooLarge: 413, type: 415 } as const;

/** The stored bytes, with the type read from them again and nothing left for the browser to guess. */
export function fileResponse(bytes: Buffer, name: string): NextResponse {
  const type = sniffUpload(bytes);
  if (!type) return new NextResponse('not found', { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
