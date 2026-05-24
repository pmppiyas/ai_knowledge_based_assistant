import * as crypto from 'crypto';

export function verifyGitHubSignature(req: any, secret: string) {
  const signature = req.headers['x-hub-signature-256'];

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return signature === `sha256=${hmac}`;
}
