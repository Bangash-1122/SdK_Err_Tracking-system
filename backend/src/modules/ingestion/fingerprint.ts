import { IngestEventPayload, StackFrame } from '@/contracts/event';
import { hashSha256 } from '@/infra/crypto';

const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
];

const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

/**
 * Deeply scrubs PII and sensitive keys from telemetry payloads
 */
export function scrubPii(target: unknown, sensitiveFields: string[] = DEFAULT_SENSITIVE_FIELDS): unknown {
  if (target === null || target === undefined) {
    return target;
  }

  if (typeof target === 'string') {
    // Scrub inline credit card numbers
    if (CREDIT_CARD_REGEX.test(target)) {
      return target.replace(CREDIT_CARD_REGEX, '[SCRUBBED_CARD]');
    }
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => scrubPii(item, sensitiveFields));
  }

  if (typeof target === 'object') {
    const lowerSensitive = sensitiveFields.map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const scrubbedObj: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(target as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSensitive = lowerSensitive.some((field) => normalizedKey.includes(field));

      if (isSensitive) {
        scrubbedObj[key] = '[SCRUBBED]';
      } else {
        scrubbedObj[key] = scrubPii(val, sensitiveFields);
      }
    }

    return scrubbedObj;
  }

  return target;
}

/**
 * Normalizes stack trace filename paths across operating systems and build tools
 */
export function normalizeFilename(filename: string): string {
  if (!filename) return 'unknown';

  let normalized = filename.replace(/\\/g, '/');

  // Strip query parameters and hash fragments (e.g., bundle.js?v=123)
  normalized = normalized.split('?')[0].split('#')[0];

  // Strip protocol schemes
  normalized = normalized.replace(/^(?:https?|file|webpack):\/\//i, '');

  // Strip machine-specific user directories
  normalized = normalized.replace(/^(?:\/home|\/Users|[A-Za-z]:\/Users)\/[^/]+\//i, '~/');

  // Strip build output hashes (e.g., main.a1b2c3d4.js -> main.js)
  normalized = normalized.replace(/\.[0-9a-fA-F]{8,32}\./g, '.');

  return normalized;
}

/**
 * Normalizes function names, stripping compiler/runtime noise
 */
export function normalizeFunctionName(name: string | null | undefined): string {
  if (!name || name.trim() === '') {
    return 'anonymous';
  }

  const trimmed = name.trim();

  // Common anonymous patterns
  if (/^<anonymous>$/i.test(trimmed) || /^anonymous$/i.test(trimmed)) {
    return 'anonymous';
  }

  // Strip transpiler / async wrapper prefixes
  return trimmed
    .replace(/^Object\./, '')
    .replace(/^(?:async\s+)/, '')
    .replace(/\s+at\s+.*$/, '');
}

/**
 * Normalizes in-app stack frames and computes a deterministic SHA-256 issue fingerprint
 */
export function computeFingerprint(payload: IngestEventPayload): string {
  // If a custom fingerprint is supplied in tags, use it directly
  if (payload.tags?.fingerprint) {
    return hashSha256(payload.tags.fingerprint);
  }

  const exceptionType = payload.exception?.type?.trim() || 'Error';
  const rawFrames: StackFrame[] = payload.exception?.stacktrace?.frames || [];

  // Filter for in-app frames; fallback to all frames if no in-app frames were flagged
  const inAppFrames = rawFrames.filter((f) => f.in_app !== false);
  const selectedFrames = inAppFrames.length > 0 ? inAppFrames : rawFrames;

  if (selectedFrames.length === 0) {
    // If no stack frames, base fingerprint on exception type and sanitized message
    const msg = (payload.exception?.value || payload.message || 'unknown')
      .trim()
      .replace(/[0-9a-fA-F]{8,}/g, ':hex') // replace dynamic IDs
      .replace(/\d+/g, ':num');
    return hashSha256(`${exceptionType}:${msg}`);
  }

  // Select top 5 most relevant frames (innermost caller frames)
  const topFrames = selectedFrames.slice(-5);

  const frameSignatures = topFrames.map((frame) => {
    const fn = normalizeFilename(frame.filename);
    const func = normalizeFunctionName(frame.functionName);
    return `${fn}:${func}`;
  });

  const rawSignature = `${exceptionType}|${frameSignatures.join('|')}`;
  return hashSha256(rawSignature);
}
