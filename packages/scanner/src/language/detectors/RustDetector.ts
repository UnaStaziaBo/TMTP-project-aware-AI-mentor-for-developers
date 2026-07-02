import type { LanguageDetector } from '../registry.js';
import { createLanguageResult } from '../registry.js';

export const RustDetector: LanguageDetector = {
  name: 'Rust',
  detect(scanResult) {
    const evidence: string[] = [];

    const hasRustFiles = scanResult.files.some((file) => file.path.endsWith('.rs'));
    if (hasRustFiles) {
      evidence.push('*.rs files');
    }

    const hasCargo = scanResult.manifests.some((manifest) => manifest.path.endsWith('Cargo.toml'));
    if (hasCargo) {
      evidence.push('Cargo.toml');
    }

    if (evidence.length === 0) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 2);
    return createLanguageResult('Rust', evidence, confidence);
  },
};
