import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// 验证只读 token（与 getReadOnlyToken 中的生成逻辑对应）
async function verifyToken(token) {
  if (!token) return false;
  try {
    // base64url decode
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(padded));
    if (!decoded.expiresAt || Date.now() > decoded.expiresAt) return false;

    // 验证签名
    const secret = Deno.env.get("TELEGRAM_BOT_TOKEN") || "fallback-secret";
    const payload = `readonly:${decoded.expiresAt}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(decoded.sig.match(/.{2}/g).map(b => parseInt(b, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
    return valid;
  } catch (e) {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const token = body.token;

    const isValid = await verifyToken(token);
    if (!isValid) {
      return Response.json({ error: "Invalid or expired token" }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);
    const transactions = await base44.asServiceRole.entities.Transaction.list("-deposit_date", 500);

    // 返回只读所需字段（隐藏敏感利润数据）
    const safeTransactions = transactions.map(t => ({
      id: t.id,
      transaction_number: t.transaction_number,
      customer_name: t.customer_name,
      customer_age: t.customer_age,
      customer_nationality: t.customer_nationality,
      receiving_account_name: t.receiving_account_name,
      receiving_account_number: t.receiving_account_number,
      currency: t.currency,
      deposit_amount: t.deposit_amount,
      remittance_count: t.remittance_count,
      deposit_date: t.deposit_date,
      maintenance_days: t.maintenance_days,
      maintenance_end_date: t.maintenance_end_date,
      fund_status: t.fund_status,
      bank_name: t.bank_name,
    }));

    return Response.json({ transactions: safeTransactions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});