type ServiceAccount = {
  client_email: string;
  private_key: string; // PEM
  token_uri?: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signRs256(privateKeyPem: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return base64UrlEncode(sig);
}

let cachedToken: { access_token: string; expires_at_ms: number } | null = null;

export async function getGoogleAccessToken(args: { serviceAccountJson: string; scope: string }): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at_ms - 60_000 > now) return cachedToken.access_token;

  const sa = JSON.parse(args.serviceAccountJson) as ServiceAccount;
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  if (!sa.client_email || !sa.private_key) throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON");

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: args.scope,
    aud: tokenUri,
    iat,
    exp,
  };

  const enc = (obj: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)).buffer);
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const signature = await signRs256(sa.private_key, signingInput);
  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await resp.json()) as any;
  if (!resp.ok) throw new Error(`Google token error: ${json?.error ?? resp.status}`);

  const access_token = String(json.access_token ?? "");
  const expires_in = Number(json.expires_in ?? 3600);
  if (!access_token) throw new Error("Google token missing access_token");

  cachedToken = { access_token, expires_at_ms: now + expires_in * 1000 };
  return access_token;
}


