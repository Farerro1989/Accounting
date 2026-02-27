import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// 生成只读访问 token（简单 HMAC 签名，带过期时间）
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
  
  return Buffer.from(JSON.stringify({ expiresAt, sig: sigHex })).toString('base64url');
}

Deno.serve(async (req) => {
  try {
    const token = await generateToken();
    return Response.json({ token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});