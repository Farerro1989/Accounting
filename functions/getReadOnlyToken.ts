import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

// 生成只读访问 token（HMAC 签名，带过期时间）
async function generateToken() {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时有效
  const payload = `readonly:${expiresAt}`;
  const secret = Deno.env.get("TELEGRAM_BOT_TOKEN") || "fallback-secret";
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const tokenData = JSON.stringify({ expiresAt, sig: sigHex });
  return btoa(tokenData).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

Deno.serve(async (req) => {
  try {
    const token = await generateToken();
    const url = `${APP_URL}/ReadOnlyView?token=${token}`;
    return Response.json({ token, url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});