import * as crypto from 'crypto';

export function verifyGitHubSignature(req: any, secret?: string) {
  if (!secret) {
    console.warn(
      '[GitHub Signature] No GITHUB_WEBHOOK_SECRET configured, skipping signature check.',
    );
    return true;
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn(
      '[GitHub Signature] No x-hub-signature-256 header provided in request.',
    );
    return false;
  }

  try {
    const payload = req.rawBody
      ? req.rawBody.toString('utf-8')
      : JSON.stringify(req.body);
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expected = `sha256=${hmac}`;
    const matches = signature === expected;
    if (!matches) {
      console.warn(
        `[GitHub Signature] Mismatch! Received: ${signature}, Calculated: ${expected}`,
      );
    }
    return matches;
  } catch (err: any) {
    console.error('[GitHub Signature Error]:', err?.message || err);
    return false;
  }
}

