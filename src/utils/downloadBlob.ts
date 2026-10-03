// Long enough for any browser to have started reading the file; FileSaver.js
// uses the same order of magnitude.
const REVOKE_URL_AFTER_MS = 30_000;

// Saves an in-memory file through the browser's normal download flow. The
// link is attached to the page first (Firefox ignores clicks on detached
// links), and its object URL is only released later, since revoking it right
// after click() can cancel the download before it starts.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_AFTER_MS);
}
