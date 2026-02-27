import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============= 配置 =============
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const APP_URL = Deno.env.get("APP_URL") || "";
const BROADCAST_CHAT_IDS = (Deno.env.get("BROADCAST_CHAT_IDS") || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const CURRENCY_MAP = {
  'EUR': 'EUR欧元', 'USD': 'USD美元', 'GBP': 'GBP英镑',
  'SGD': 'SGD新元', 'MYR': 'MYR马币', 'AUD': 'AUD澳币',
  'CHF': 'CHF瑞郎', 'THB': 'THB泰铢', 'VND': 'VND越南盾',
  'CAD': 'CAD加元', 'HKD': 'HKD港币', 'KRW': 'KRW韩币',
  'CNY': 'CNY人民币', 'RMB': 'CNY人民币', 'JPY': 'JPY日元',
  'AED': 'AED迪拉姆', 'PHP': 'PHP菲律宾比索', 'IDR': 'IDR印尼盾'
};

const CURRENCY_MAP_ZH = {
  ...CURRENCY_MAP,
  '欧': 'EUR欧元', '美': 'USD美元', '英': 'GBP英镑', '新': 'SGD新元',
  '马': 'MYR马币', '澳': 'AUD澳币', '瑞': 'CHF瑞郎', '泰': 'THB泰铢',
  '越': 'VND越南盾', '加': 'CAD加元', '港': 'HKD港币', '韩': 'KRW韩币',
  '人': 'CNY人民币', '日': 'JPY日元', '迪': 'AED迪拉姆',
  '菲': 'PHP菲律宾比索', '印': 'IDR印尼盾'
};

const TRANSACTION_KEYWORDS = ['汇款', '转账', '水单', '汇款单', '收款'];
const TRANSACTION_TRIGGER_KEYWORDS = [
  '汇款', '转账', '水单', '汇款单', '币种', '金额', '查收', '收款', '维护期', 'IBAN', '银行', '账户'
];

// ============= Telegram API =============

async function sendTelegramMessage(chatId, text, replyToMessageId = null) {
  try {
    const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (error) {
    console.error('发送消息失败:', error);
    return null;
  }
}

async function broadcastMessage(originChatId, text) {
  for (const broadcastId of BROADCAST_CHAT_IDS) {
    if (broadcastId !== String(originChatId)) {
      await sendTelegramMessage(broadcastId, text);
    }
  }
}

async function downloadTelegramFile(fileId) {
  console.log('📥 下载文件:', fileId);
  const fileInfoRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  if (!fileInfo.ok) throw new Error('获取文件信息失败');
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  const arrayBuffer = await fileRes.arrayBuffer();
  console.log('✅ 文件下载成功');
  return new Blob([arrayBuffer]);
}

// ============= AI 分析 =============

async function analyzeImageContent(base44, imageUrl) {
  try {
    console.log('🔍 分析图片内容...', imageUrl);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `请分析这张图片的内容。判断它是"证件照片"(id_card)还是"银行转账单"(transfer_receipt)。

如果是【证件照片】(如护照、身份证、驾照)：
- 提取姓名 (name)
- 提取出生日期 (birth_date) - 格式 YYYY-MM-DD 或 YYYY
- 提取国籍 (nationality)

如果是【银行转账单】：
- 提取转账金额 (amount) - 纯数字
- 提取币种 (currency) - 3位代码
- 提取收款人姓名 (recipient_name)
- 提取收款账号 (account_number)
- 提取银行名称 (bank_name)
- 提取转账日期 (transfer_date) - YYYY-MM-DD

请返回JSON格式数据。`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: "object",
        properties: {
          image_type: { type: "string", enum: ["id_card", "transfer_receipt", "other"] },
          name: { type: "string" }, birth_date: { type: "string" }, nationality: { type: "string" },
          amount: { type: "number" }, currency: { type: "string" },
          recipient_name: { type: "string" }, account_number: { type: "string" },
          bank_name: { type: "string" }, transfer_date: { type: "string" }
        },
        required: ["image_type"]
      }
    });
    console.log('✅ 图片分析结果:', result);
    return { imageUrl, data: result };
  } catch (error) {
    console.error('❌ 图片分析失败:', error);
    return null;
  }
}

async function analyzeDocument(base44, docUrl) {
  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `请分析这份文档，提取转账水单信息。如果是水单，提取以下字段：
- currency (币种代码), amount (金额,数字), customer_name (汇款人姓名)
- receiving_account_name (收款人/公司名), receiving_account_number (收款账号/IBAN)
- bank_name (银行名称), date (日期 YYYY-MM-DD)
如果不是水单，返回 null。`,
      response_json_schema: {
        type: "object",
        properties: {
          currency: { type: "string" }, amount: { type: "number" },
          customer_name: { type: "string" }, receiving_account_name: { type: "string" },
          receiving_account_number: { type: "string" }, bank_name: { type: "string" },
          date: { type: "string" }
        }
      },
      file_urls: [docUrl]
    });
    if (!result || !result.amount) return null;
    return { imageUrl: docUrl, data: result };
  } catch (error) {
    console.error('❌ 文档分析失败:', error);
    return null;
  }
}

async function analyzeTextWithLLM(base44, text) {
  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `请仔细分析以下转账水单文本，提取关键信息并返回JSON。

文本内容:
${text}

请提取以下字段：
- currency (币种代码,如USD, EUR, CNY等)
- amount (金额,数字)
- customer_name (汇款人姓名)
- receiving_account_name (收款人/公司名)
- receiving_account_number (收款账号/IBAN)
- bank_name (银行名称)
- date (日期 YYYY-MM-DD)
- maintenance_days (维护期天数, 数字)

注意: 币种请使用标准3位代码，金额请返回纯数字，找不到的字段返回null`,
      response_json_schema: {
        type: "object",
        properties: {
          currency: { type: "string" }, amount: { type: "number" },
          customer_name: { type: "string" }, receiving_account_name: { type: "string" },
          receiving_account_number: { type: "string" }, bank_name: { type: "string" },
          date: { type: "string" }, maintenance_days: { type: "number" }
        }
      }
    });
    if (!result) return null;
    const mapped = {};
    if (result.amount) mapped.deposit_amount = result.amount;
    if (result.currency) mapped.currency = result.currency;
    if (result.customer_name) mapped.customer_name = result.customer_name;
    if (result.receiving_account_name) mapped.receiving_account_name = result.receiving_account_name;
    if (result.receiving_account_number) mapped.receiving_account_number = result.receiving_account_number;
    if (result.bank_name) mapped.bank_name = result.bank_name;
    if (result.date) mapped.deposit_date = result.date;
    if (result.maintenance_days) mapped.maintenance_days = result.maintenance_days;
    return mapped;
  } catch (error) {
    console.error('❌ 文本LLM分析失败:', error);
    return null;
  }
}

// ============= 文本解析 =============

function normalizeCurrency(raw) {
  const upper = raw.toUpperCase();
  for (const [key, value] of Object.entries(CURRENCY_MAP_ZH)) {
    if (upper.includes(key)) return value;
  }
  return null;
}

function parseWaterSlip(text) {
  if (!text) return {};
  const data = {};
  const lines = text.split('\n');
  const currentYear = new Date().getFullYear();

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (/(?:汇款\s*日期|日期)\s*[：:=]/.test(t)) {
      let m = t.match(/(?:汇款\s*日期|日期)\s*[：:=]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      if (m) {
        data.deposit_date = m[1].replace(/\//g, '-');
      } else {
        m = t.match(/(?:汇款\s*日期|日期)\s*[：:=]\s*(\d{1,2}[-/]\d{1,2})/);
        if (m) {
          const parts = `${currentYear}-${m[1].replace(/\//g, '-')}`.split('-');
          data.deposit_date = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
        }
      }
    } else if (/维护期\s*(?:（天数）)?\s*[：:=]/.test(t)) {
      const m = t.match(/维护期.*?[：:=]\s*(\d+)/);
      if (m) data.maintenance_days = parseInt(m[1]);
    } else if (/(?:查收\s*币种|入金\s*币种|币种)\s*[：:=]/.test(t)) {
      const m = t.match(/(?:查收\s*币种|入金\s*币种|币种)\s*[：:=]\s*([A-Z]{3}|[\u4e00-\u9fa5]+)/i);
      if (m) {
        const normalized = normalizeCurrency(m[1]);
        if (normalized) data.currency = normalized;
      }
    } else if (/(?:汇款人\s*姓名|汇款人|客户\s*姓名)\s*[：:=]/.test(t)) {
      const m = t.match(/(?:汇款人\s*姓名|汇款人|客户\s*姓名).*?[：:=]\s*(.+)/);
      if (m) data.customer_name = m[1].trim();
    } else if (/(?:收款|入款|公司|账户)\s*(?:账户名|户名|名称|名|人|方)\s*[：:=]/.test(t) && !/汇款|客户/.test(t)) {
      const m = t.match(/(?:收款|入款|公司|账户)\s*(?:账户名|户名|名称|名|人|方).*?[：:=]\s*(.+)/);
      if (m) data.receiving_account_name = m[1].trim();
    } else if (/(?:收款|入款|公司|账户|银行)\s*(?:账号|账户号|卡号|号码)\s*[：:=]/.test(t) && !/汇款|客户/.test(t)) {
      const m = t.match(/(?:收款|入款|公司|账户|银行)\s*(?:账号|账户号|卡号|号码).*?[：:=]\s*([A-Z0-9\s-]+)/i);
      if (m) data.receiving_account_number = m[1].trim();
    } else if (/(?:查收\s*金额|金额)\s*[：:=]/.test(t)) {
      const m = t.match(/(?:查收\s*金额|金额)\s*[：:=]\s*([\d,.\s]+)/);
      if (m) {
        const amount = parseFloat(m[1].replace(/[,\s]/g, ''));
        if (!isNaN(amount)) data.deposit_amount = amount;
      }
    } else if (/(?:汇款\s*笔数|笔数)\s*[：:=]/.test(t)) {
      const m = t.match(/(?:汇款\s*笔数|笔数)\s*[：:=]\s*(\d+)/);
      if (m) data.remittance_count = parseInt(m[1]);
    } else if (/国籍\s*[：:=]/.test(t)) {
      const m = t.match(/国籍\s*[：:=]\s*(.+)/);
      if (m) data.customer_nationality = m[1].trim();
    } else if (/(?:年龄|年齡)\s*[：:=]/.test(t)) {
      const m = t.match(/(?:年龄|年齡)\s*[：:=]\s*(\d+)/);
      if (m) data.customer_age = parseInt(m[1]);
    } else if (/汇率\s*[：:=]/.test(t)) {
      const m = t.match(/汇率\s*[：:=]\s*([\d.]+)/);
      if (m) data.exchange_rate = parseFloat(m[1]);
    } else if (/(?:点位|佣金).*?[：:=]/.test(t)) {
      const m = t.match(/(?:点位|佣金).*?[：:=]\s*([\d.]+)/);
      if (m) data.commission_percentage = parseFloat(m[1]);
    }

    if (/(?:进算|拖算)/.test(t)) {
      data.calculation_mode = t.includes('拖算') ? '拖算' : '进算';
    }
  }
  return data;
}

// ============= 数据合并 =============

function mergeTransferData(transferData, textData) {
  const merged = { ...textData };
  if (!transferData?.data) return merged;
  const td = transferData.data;

  if (td.amount) merged.deposit_amount = td.amount;

  if (td.currency) {
    const normalized = normalizeCurrency(td.currency);
    if (normalized) merged.currency = normalized;
  }

  if (td.recipient_name && !merged.receiving_account_name) merged.receiving_account_name = td.recipient_name;
  if (td.account_number) {
    if (!merged.receiving_account_number) merged.receiving_account_number = td.account_number;
    if (!merged.bank_account) merged.bank_account = td.account_number;
  }
  if (td.bank_name && !merged.bank_name) merged.bank_name = td.bank_name;
  if (td.transfer_date && !merged.deposit_date) merged.deposit_date = td.transfer_date;

  return merged;
}

// ============= 证件信息提取 =============

function extractIdCardInfo(analysisData) {
  const info = { name: '', age: null, nationality: '', url: '' };
  if (!analysisData) return info;
  if (analysisData.name) info.name = analysisData.name;
  if (analysisData.nationality) info.nationality = analysisData.nationality;
  if (analysisData.birth_date) {
    const birthYear = parseInt(analysisData.birth_date.substring(0, 4));
    if (!isNaN(birthYear)) info.age = new Date().getFullYear() - birthYear;
  } else if (analysisData.age) {
    info.age = analysisData.age;
  }
  return info;
}

// ============= 创建交易 =============

async function createTransaction(base44, data, chatId, messageId, idCardPhotoUrl, transferReceiptUrl) {
  data.deposit_amount = parseFloat(data.deposit_amount) || 0;
  data.exchange_rate = parseFloat(data.exchange_rate) || 0.96;
  data.commission_percentage = parseFloat(data.commission_percentage) || 13.5;

  const numberResponse = await base44.asServiceRole.functions.invoke('generateTransactionNumber', {
    date: data.deposit_date || new Date().toISOString().split('T')[0]
  });

  const depositDate = new Date(data.deposit_date || new Date());
  const maintenanceDays = data.maintenance_days || 15;
  const maintenanceEndDate = new Date(depositDate);
  maintenanceEndDate.setDate(maintenanceEndDate.getDate() + maintenanceDays);

  const transaction = {
    transaction_number: numberResponse.data.transaction_number,
    customer_name: data.customer_name || '待完善',
    customer_age: data.customer_age || null,
    customer_nationality: data.customer_nationality || '',
    receiving_account_name: data.receiving_account_name || '待完善',
    receiving_account_number: data.receiving_account_number || '待完善',
    bank_name: data.bank_name || '',
    bank_account: data.bank_account || '',
    bank_address: data.bank_address || '',
    bank_location: data.bank_location || '',
    currency: data.currency,
    deposit_amount: data.deposit_amount,
    deposit_date: data.deposit_date || new Date().toISOString().split('T')[0],
    maintenance_days: maintenanceDays,
    maintenance_end_date: maintenanceEndDate.toISOString().split('T')[0],
    exchange_rate: data.exchange_rate,
    commission_percentage: data.commission_percentage,
    calculation_mode: data.calculation_mode || '进算',
    remittance_count: data.remittance_count || 1,
    transfer_fee: 25,
    violation_penalty: 0,
    fund_status: '等待中',
    acceptance_usdt: 0,
    source: 'telegram',
    telegram_chat_id: String(chatId),
    telegram_message_id: String(messageId),
    id_card_photo_url: idCardPhotoUrl || '',
    transfer_receipt_url: transferReceiptUrl || ''
  };

  const initialUsdt = transaction.deposit_amount / transaction.exchange_rate;
  const commission = initialUsdt * (transaction.commission_percentage / 100);
  transaction.settlement_usdt = initialUsdt - commission - transaction.transfer_fee;

  return await base44.asServiceRole.entities.Transaction.create(transaction);
}

function buildSuccessMessage(transaction) {
  let msg = `✅ <b>水单录入成功，请核对信息</b>\n\n`;
  msg += `📝 编号: <code>${transaction.transaction_number}</code>\n`;
  msg += `💵 查收金额: ${transaction.deposit_amount.toLocaleString()} ${transaction.currency}\n`;
  msg += `🔢 汇款笔数: ${transaction.remittance_count || 1}笔\n`;
  msg += `👤 汇款人: ${transaction.customer_name}`;
  if (transaction.customer_age) {
    msg += ` (${transaction.customer_age}岁)`;
    if (transaction.customer_age >= 70) msg += ` ⚠️⚠️⚠️ <b>高龄客户提醒</b> ⚠️⚠️⚠️`;
  }
  if (transaction.customer_nationality) msg += ` [${transaction.customer_nationality}]`;
  msg += `\n`;
  msg += `🏢 收款账户名: ${transaction.receiving_account_name}\n`;
  msg += `💳 收款账号: ${transaction.receiving_account_number}\n`;
  msg += `💱 汇率: ${transaction.exchange_rate}\n`;
  msg += `📊 点位: ${transaction.commission_percentage}% (${transaction.calculation_mode || '进算'})\n`;
  msg += `📆 汇款日期: ${transaction.deposit_date}\n`;
  msg += `⏳ 维护期: ${transaction.maintenance_days}天 (到期: ${transaction.maintenance_end_date})\n\n`;
  msg += `✨ 如有误请在后台修改`;
  return msg;
}

// ============= 指令处理 =============

async function handleChazhangCommand(chatId, messageId) {
  try {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const payload = `readonly:${expiresAt}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(BOT_TOKEN),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    const token = btoa(JSON.stringify({ expiresAt, sig: sigHex }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const viewUrl = `${APP_URL}/ReadOnlyView?token=${token}`;
    await sendTelegramMessage(chatId,
      `🔐 <b>账目查看链接已生成</b>\n\n📋 点击下方链接查看账目（只读模式）：\n${viewUrl}\n\n⏰ 链接有效期：<b>24小时</b>\n🔒 此链接仅供查看，无法修改任何数据`,
      messageId
    );
  } catch (err) {
    console.error('生成查账链接失败:', err);
    await sendTelegramMessage(chatId, `❌ 生成链接失败: ${err.message}`, messageId);
  }
}

async function handleReanalyzeCommand(base44, message, chatId, messageId, messageText) {
  let targetMessageId = null;
  if (message.reply_to_message) {
    targetMessageId = String(message.reply_to_message.message_id);
  } else {
    const parts = messageText.split(' ');
    if (parts.length > 1) targetMessageId = parts[1];
  }

  if (!targetMessageId) {
    await sendTelegramMessage(chatId, `⚠️ 请回复一条带有图片的消息并发送 /reanalyze，或输入 /reanalyze [message_id]`, messageId);
    return;
  }

  await sendTelegramMessage(chatId, `🔄 正在重新分析消息 ${targetMessageId}...`, messageId);
  const msgs = await base44.asServiceRole.entities.TelegramMessage.list();
  const targetMsg = msgs.find(m => m.message_id === targetMessageId && m.chat_id === String(chatId));

  if (!targetMsg?.file_urls?.length) {
    await sendTelegramMessage(chatId, `❌ 未找到该消息记录或该消息无文件`, messageId);
    return;
  }

  const analysis = await analyzeImageContent(base44, targetMsg.file_urls[0]);
  if (analysis?.data) {
    await sendTelegramMessage(chatId, `✅ <b>重新分析结果</b>\n<pre>${JSON.stringify(analysis.data, null, 2)}</pre>`, messageId);
  } else {
    await sendTelegramMessage(chatId, `❌ 重新分析失败，未识别到内容`, messageId);
  }
}

async function handleProcessBatch(base44, chatId, messageId) {
  try {
    const messages = await base44.asServiceRole.entities.TelegramMessage.list('-created_date', 50);
    const batchMessages = messages.filter(m =>
      m.chat_id === String(chatId) &&
      (m.status === 'pending_batch' || m.status === 'unread') &&
      m.file_urls?.length > 0
    ).slice(0, 10);

    if (batchMessages.length === 0) {
      return "⚠️ 没有找到需要处理的文件消息。请确保先发送图片/文档，再发送 /process_batch";
    }

    await sendTelegramMessage(chatId, `🔄 开始批量处理 ${batchMessages.length} 条消息...`);

    const allImages = batchMessages.flatMap(m => m.file_urls || []);
    if (allImages.length === 0) return "⚠️ 未找到有效的文件链接";

    let idCardData = null, receiptData = null, idCardUrl = '', receiptUrl = '';

    const analysisResults = await Promise.all(allImages.map(async (url) => {
      const analysis = await analyzeImageContent(base44, url);
      if (analysis?.data) return { type: 'image', url, result: analysis };
      const docAnalysis = await analyzeDocument(base44, url);
      if (docAnalysis?.data) return { type: 'document', url, result: docAnalysis };
      return null;
    }));

    for (const item of analysisResults) {
      if (!item) continue;
      if (item.type === 'image') {
        const imgType = item.result.data.image_type;
        console.log(`🖼️ [批量] 识别结果: ${imgType}`);
        if (imgType === 'id_card' && !idCardData) {
          idCardData = item.result.data;
          idCardUrl = item.url;
          const info = extractIdCardInfo(idCardData);
          idCardData.age = info.age;
        } else if (!receiptData) {
          receiptData = item.result.data;
          receiptUrl = item.url;
        }
      } else if (item.type === 'document' && !receiptData) {
        receiptData = item.result.data;
        receiptUrl = item.url;
      }
    }

    if (!receiptData && !idCardData) return "❌ 未能识别出有效的水单或证件信息。请重试或手动录入。";

    const mergedData = { ...receiptData };
    if (idCardData) {
      const info = extractIdCardInfo(idCardData);
      if (info.name) mergedData.customer_name = info.name;
      if (info.age) mergedData.customer_age = info.age;
      if (info.nationality) mergedData.customer_nationality = info.nationality;
    }

    if (!mergedData.amount || !mergedData.currency) {
      return "⚠️ 识别到的信息不完整（缺少金额或币种）。已尝试关联，但数据不足。";
    }

    const finalData = {
      deposit_amount: mergedData.amount,
      currency: mergedData.currency,
      customer_name: mergedData.customer_name,
      customer_age: mergedData.customer_age,
      customer_nationality: mergedData.customer_nationality,
      receiving_account_name: mergedData.receiving_account_name || mergedData.recipient_name,
      receiving_account_number: mergedData.receiving_account_number || mergedData.account_number,
      bank_name: mergedData.bank_name,
      deposit_date: mergedData.transfer_date || mergedData.date,
      maintenance_days: 15, commission_percentage: 13.5, exchange_rate: 0.96
    };

    const transaction = await createTransaction(
      base44, finalData, chatId,
      batchMessages[batchMessages.length - 1].message_id,
      idCardUrl, receiptUrl
    );

    await Promise.allSettled(batchMessages.map(m =>
      base44.asServiceRole.entities.TelegramMessage.update(m.id, { status: 'processed' })
    ));

    let reply = `✅ <b>批量处理完成</b>\n\n`;
    if (idCardData && receiptData) {
      reply += `🔗 <b>已自动关联证件与水单</b>\n`;
      reply += `   证件: ${idCardData.name} (${idCardData.age || '?'}岁)\n`;
      reply += `   水单: ${finalData.deposit_amount} ${finalData.currency}\n\n`;
    } else {
      reply += `⚠️ 未识别到证件，仅依据水单创建。\n\n`;
    }
    reply += `📝 编号: <code>${transaction.transaction_number}</code>\n`;
    reply += `💵 金额: ${transaction.deposit_amount.toLocaleString()} ${transaction.currency}\n`;
    if (finalData.customer_name) reply += `👤 客户: ${finalData.customer_name}\n`;
    if ((finalData.customer_age || 0) >= 70) reply += `⚠️ <b>高龄客户提醒</b> (${finalData.customer_age}岁)\n`;

    return reply;
  } catch (error) {
    console.error('❌ 批量处理异常:', error);
    return `❌ 批量处理失败: ${error.message}`;
  }
}

// ============= 消息存档 =============

async function archiveMessage(base44, { chatId, messageId, mediaGroupId, userName, messageText, allFileUrls, message, transferData, idCardPhotoUrl, extractedCustomerName, extractedAge, extractedNationality }) {
  let category = 'other';
  const tags = [];

  if (messageText) {
    if (messageText.includes('汇款') || messageText.includes('转账') || messageText.includes('水单')) {
      category = 'transaction'; tags.push('transaction');
    }
    if (messageText.includes('你好') || messageText.includes('在吗')) {
      category = 'inquiry'; tags.push('greeting');
    }
  }
  if (allFileUrls.length > 0) {
    tags.push('has_attachment');
    if (message.document) tags.push('document');
    if (message.photo?.length) tags.push('photo');
  }

  let analysisData = null;
  if (transferData?.data) {
    analysisData = transferData.data;
  } else if (idCardPhotoUrl) {
    analysisData = {
      image_type: 'id_card',
      name: extractedCustomerName,
      birth_date: extractedAge ? String(new Date().getFullYear() - extractedAge) : null,
      nationality: extractedNationality
    };
  }

  await base44.asServiceRole.entities.TelegramMessage.create({
    chat_id: String(chatId),
    message_id: String(messageId),
    media_group_id: mediaGroupId,
    sender_name: userName,
    content: messageText || (allFileUrls.length > 0 ? '[文件消息]' : '[未知消息]'),
    file_urls: allFileUrls,
    file_type: allFileUrls.length > 0 ? (message.document ? 'document' : 'photo') : 'text',
    direction: 'incoming',
    tags, category,
    status: 'processed',
    analysis_result: analysisData
  });
  console.log('💾 消息已存档');
}

// ============= 关联证件信息 =============

async function linkIdCardInfo(base44, mergedData, chatId, mediaGroupId, currentIdCardUrl, extractedCustomerName, extractedAge) {
  let linkedIdCardUrl = currentIdCardUrl;

  // 优先注入当前消息中已提取的证件信息
  if (extractedCustomerName) mergedData.customer_name = extractedCustomerName;
  if (extractedAge) mergedData.customer_age = extractedAge;

  // 若无当前证件信息，查找历史记录
  if (!extractedCustomerName && !extractedAge) {
    try {
      const recentMsgs = await base44.asServiceRole.entities.TelegramMessage.list('-created_date', 30);
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      const targetIdCardMsg = recentMsgs.find(m => {
        if (m.chat_id !== String(chatId)) return false;
        if (m.analysis_result?.image_type !== 'id_card') return false;
        if (mediaGroupId && m.media_group_id === mediaGroupId) return true;
        return new Date(m.created_date).getTime() >= fiveMinutesAgo;
      });

      if (targetIdCardMsg?.analysis_result) {
        console.log('🔗 自动关联到历史证件消息:', targetIdCardMsg.message_id);
        const idData = targetIdCardMsg.analysis_result;
        const info = extractIdCardInfo(idData);
        if (info.name) mergedData.customer_name = info.name;
        if (info.age) mergedData.customer_age = info.age;
        if (info.nationality) mergedData.customer_nationality = info.nationality;
        if (targetIdCardMsg.file_urls?.length) linkedIdCardUrl = targetIdCardMsg.file_urls[0];
      }
    } catch (e) {
      console.error('❌ 查找关联证件失败:', e);
    }
  }

  return linkedIdCardUrl;
}

// ============= 主入口 =============

Deno.serve(async (req) => {
  console.log('\n=== 新的Telegram消息 ===');

  if (!BOT_TOKEN) {
    console.error('❌ Bot Token未设置');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const base44 = createClientFromRequest(req);
  const body = await req.json();

  if (!body.message) return new Response(JSON.stringify({ ok: true }), { status: 200 });

  const message = body.message;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const messageText = message.text || message.caption || '';
  const userName = message.from?.first_name || message.from?.username || '用户';
  const mediaGroupId = message.media_group_id || null;

  console.log('📨 消息来自:', userName, '| 文本:', messageText);

  try {
    // ── 指令路由 ──
    if (messageText.trim() === '查账') {
      await handleChazhangCommand(chatId, messageId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (messageText.startsWith('/process_batch')) {
      const resultMsg = await handleProcessBatch(base44, chatId, messageId);
      await sendTelegramMessage(chatId, resultMsg, messageId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (messageText.startsWith('/reanalyze')) {
      await handleReanalyzeCommand(base44, message, chatId, messageId, messageText);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // ── 收集媒体 ──
    const photos = message.photo?.length ? [message.photo[message.photo.length - 1].file_id] : [];
    const hasKeywordsEarly = TRANSACTION_KEYWORDS.some(k => messageText.includes(k));

    // ── 处理图片 ──
    let idCardPhotoUrl = '', transferReceiptUrl = '', transferData = null;
    let extractedCustomerName = '', extractedAge = null, extractedNationality = '';
    const allFileUrls = [];

    const photoResults = await Promise.all(photos.map(async (photoId) => {
      try {
        const blob = await downloadTelegramFile(photoId);
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        const analysis = await analyzeImageContent(base44, file_url);
        return { imageUrl: file_url, analysis };
      } catch (err) {
        console.error('❌ 图片处理失败:', err);
        return null;
      }
    }));

    for (const result of photoResults) {
      if (!result) continue;
      const { imageUrl, analysis } = result;
      allFileUrls.push(imageUrl);

      if (!analysis?.data) continue;
      const imgType = analysis.data.image_type;
      console.log(`🖼️ 图片识别为: ${imgType}`);

      if (imgType === 'id_card') {
        idCardPhotoUrl = imageUrl;
        const info = extractIdCardInfo(analysis.data);
        extractedCustomerName = info.name;
        extractedAge = info.age;
        extractedNationality = info.nationality;

        if (!hasKeywordsEarly && photos.length === 1 && !messageText && !message.document) {
          const idName = extractedCustomerName ? `（${extractedCustomerName}）` : '';
          await sendTelegramMessage(chatId,
            `🪪 <b>检测到证件照片${idName}</b>\n\n请问这张证件照片的用途是：\n1️⃣ 客户身份核验（KYC）\n2️⃣ 关联某笔汇款交易\n\n如需关联交易，请在发送证件时同时发送水单，或回复相关水单消息。\n证件信息已记录，下次发送水单时会自动关联。`,
            messageId
          );
        }
      } else {
        if (!transferData) {
          transferData = { imageUrl, data: analysis.data };
          transferReceiptUrl = imageUrl;
        }
      }
    }

    // ── 处理文档 ──
    if (message.document) {
      try {
        console.log('📄 检测到文档:', message.document.file_name);
        const blob = await downloadTelegramFile(message.document.file_id);
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        allFileUrls.push(file_url);
        if (!transferData) {
          const analysis = await analyzeDocument(base44, file_url);
          if (analysis) { transferData = analysis; transferReceiptUrl = file_url; }
        }
      } catch (err) {
        console.error('❌ 文档处理失败:', err);
      }
    }

    // ── 存档消息 ──
    try {
      await archiveMessage(base44, {
        chatId, messageId, mediaGroupId, userName, messageText, allFileUrls,
        message, transferData, idCardPhotoUrl,
        extractedCustomerName, extractedAge, extractedNationality
      });
    } catch (err) {
      console.error('❌ 消息存档失败:', err);
    }

    // ── 判断是否需要处理为交易 ──
    if (mediaGroupId) await new Promise(r => setTimeout(r, 2000));

    if (!photos.length && !messageText && !message.document) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const hasKeywords = TRANSACTION_TRIGGER_KEYWORDS.some(k => messageText.toLowerCase().includes(k.toLowerCase()));
    const isAutoTriggered = !!transferData;

    if (!hasKeywords && !isAutoTriggered) {
      console.log('ℹ️ 仅存档消息，非交易指令');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const triggerReason = isAutoTriggered ? '检测到转账单附件' : '检测到汇款关键词';
    await sendTelegramMessage(chatId, `🔄 ${triggerReason}，正在自动处理水单信息...`, messageId);

    // ── 解析文本 ──
    let textData = parseWaterSlip(messageText);
    if ((!textData.deposit_amount || !textData.currency) && messageText.length > 10) {
      console.log('🤔 正则解析不完整，尝试LLM分析...');
      const llmData = await analyzeTextWithLLM(base44, messageText);
      if (llmData) { console.log('🤖 LLM结果:', llmData); textData = { ...textData, ...llmData }; }
    }

    // ── 合并与关联 ──
    const mergedData = mergeTransferData(transferData, textData);
    const linkedIdCardUrl = await linkIdCardInfo(
      base44, mergedData, chatId, mediaGroupId,
      idCardPhotoUrl, extractedCustomerName, extractedAge
    );

    console.log('📊 合并后数据:', mergedData);

    if (!mergedData.deposit_amount || !mergedData.currency) {
      await sendTelegramMessage(chatId,
        '❌ <b>信息不完整</b>\n\n缺少必要信息（金额或币种）\n\n请确保：\n1. 转账单图片/文档清晰\n2. 或在文本中提供金额和币种\n3. 或检查图片是否模糊',
        messageId
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // ── 创建交易 ──
    try {
      const transaction = await createTransaction(base44, mergedData, chatId, messageId, linkedIdCardUrl, transferReceiptUrl);
      const successMsg = buildSuccessMessage(transaction);
      await sendTelegramMessage(chatId, successMsg, messageId);
      await broadcastMessage(chatId, successMsg);
      console.log('✅ 交易创建完成');
    } catch (err) {
      console.error('❌ 创建交易失败:', err);
      await sendTelegramMessage(chatId, `❌ <b>录入失败</b>\n\n${err.message}\n\n请联系管理员`, messageId);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (error) {
    console.error('❌ 处理失败:', error);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});