/**
 * Serve marked + DOMPurify + 3Dmol for local web chat (no CDN; works offline).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let cache: { marked: string; purify: string; threeDmol: string } | null = null;

export function getWebVendorScripts(): { marked: string; purify: string; threeDmol: string } {
  if (!cache) {
    const markedRoot = dirname(require.resolve('marked/package.json'));
    const markedPath = join(markedRoot, 'lib', 'marked.umd.js');
    const purifyPath = require.resolve('dompurify/dist/purify.min.js');
    const threeDmolPath = require.resolve('3dmol/build/3Dmol-min.js');
    cache = {
      marked: readFileSync(markedPath, 'utf8'),
      purify: readFileSync(purifyPath, 'utf8'),
      threeDmol: readFileSync(threeDmolPath, 'utf8'),
    };
  }
  return cache;
}

/** Paths served by local-web; use in <script src>. */
export const WEB_VENDOR_MARKED_PATH = '/_bioclaw-vendor/marked.umd.js';
export const WEB_VENDOR_PURIFY_PATH = '/_bioclaw-vendor/purify.min.js';
export const WEB_VENDOR_THREEDMOL_PATH = '/_bioclaw-vendor/3Dmol-min.js';
