/**
 * Adds hostnames to Firebase Auth "Authorized domains" via Identity Toolkit Admin API.
 *
 * One-time setup (pick one):
 * - Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON key that has access
 *   to this Firebase/GCP project (Project Owner or Editor is simplest).
 * - Or install Google Cloud SDK and run: gcloud auth application-default login
 *
 * Usage:
 *   node scripts/add-firebase-authorized-domains.mjs
 *   node scripts/add-firebase-authorized-domains.mjs diamond-track.pages.dev
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'firebase-applet-config.json');
const { projectId } = JSON.parse(readFileSync(configPath, 'utf8'));

const DEFAULT_DOMAINS = ['diamond-track.pages.dev'];

const extraDomains = process.argv.slice(2).filter(Boolean);
const domainsToAdd = [...new Set([...DEFAULT_DOMAINS, ...extraDomains])];

const auth = new GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/cloud-platform',
  ],
  projectId,
});

async function main() {
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error('No access token returned. Check GOOGLE_APPLICATION_CREDENTIALS or ADC login.');
  }

  const baseUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const getRes = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) {
    const body = await getRes.text();
    throw new Error(`GET config failed (${getRes.status}): ${body}`);
  }

  const config = await getRes.json();
  const current = Array.isArray(config.authorizedDomains) ? config.authorizedDomains : [];
  const next = [...new Set([...current, ...domainsToAdd])];

  const patchUrl = `${baseUrl}?updateMask=authorizedDomains`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authorizedDomains: next }),
  });
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`PATCH config failed (${patchRes.status}): ${body}`);
  }

  console.log('Updated authorized domains:', next.join(', '));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
