/**
 * downloadReceiptsZip.ts
 * Bundles receipt files from the given transactions into a ZIP and triggers
 * a browser download.
 *
 * ZIP structure:
 *   receipts/
 *     {date}_{slug}/
 *       receipt.{ext}
 */

import JSZip from 'jszip';

import { Transaction } from '../types';
import { downloadDocument } from './storage';

/** Turns a transaction title into a safe folder-name slug */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Returns a file extension from a blob's MIME type */
function extFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/tiff': 'tiff',
  };
  return map[mimeType.toLowerCase()] ?? 'bin';
}

/** Downloads a Storage object as a Blob, with a 30-second timeout to prevent hanging. */
async function fetchBlob(path: string, timeoutMs = 30_000): Promise<Blob> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Download timed out after 30 s')), timeoutMs),
  );
  return Promise.race([downloadDocument(path), timeout]);
}

export async function downloadReceiptsZip(
  transactions: Transaction[],
  zipName = 'receipts.zip',
): Promise<void> {
  const zip = new JSZip();
  const receiptsFolder = zip.folder('receipts')!;

  const withDocs = transactions.filter((t) => t.receiptFileUrl || t.exemptionFormUrl);

  if (withDocs.length === 0) {
    throw new Error('No documents to download.');
  }

  await Promise.all(
    withDocs.map(async (t) => {
      const date = t.date ?? 'undated';
      const slug = slugify(t.title);
      const folderName = `${date}_${slug}`;
      const folder = receiptsFolder.folder(folderName)!;

      const files: { path: string; name: string }[] = [];
      if (t.receiptFileUrl) files.push({ path: t.receiptFileUrl, name: 'receipt' });
      if (t.exemptionFormUrl)
        files.push({ path: t.exemptionFormUrl, name: 'exemption_form' });

      await Promise.all(
        files.map(async ({ path, name }) => {
          try {
            const blob = await fetchBlob(path);
            const ext = extFromMimeType(blob.type);
            folder.file(`${name}.${ext}`, blob);
          } catch (err) {
            folder.file(
              `${name}_unavailable.txt`,
              `Could not download ${name} for: ${t.title}\nError: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }),
      );
    }),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(a.href);
}
