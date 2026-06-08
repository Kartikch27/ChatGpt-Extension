/**
 * Sanitizes a filename to prevent directory traversal and invalid characters.
 * Removes characters like .., /, \ to keep the file restricted to its target directory.
 */
export function sanitizeFilename(name: string): string {
  // Replace directory traversal segments
  let clean = name.replace(/\.\./g, '');
  // Remove slash and backslash characters to prevent sub-directory escape
  clean = clean.replace(/[/\\]/g, '_');
  // Remove other invalid file characters: < > : " | ? *
  clean = clean.replace(/[<>:"|?*]/g, '');
  // Trim spaces and ensure we don't have leading dots or symbols
  clean = clean.trim();
  if (!clean) {
    clean = 'unnamed_image';
  }
  return clean;
}

/**
 * Downloads a generated image to a dedicated extension folder.
 */
export async function downloadImage(url: string, movementName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const safeName = sanitizeFilename(movementName);
    const filename = `Gemini-Parallel-Workers/${safeName}.png`;

    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        conflictAction: 'uniquify', // Chrome automatically appends (1), (2) for duplicates
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError.message);
          resolve(false);
        } else if (downloadId === undefined) {
          console.error('Download ID undefined (failed)');
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}
