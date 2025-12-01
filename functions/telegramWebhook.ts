import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============= Telegram API 函数 =============

async function sendTelegramMessage(chatId, message, replyToMessageId = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    };
    
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    return await response.json();
  } catch (error) {
    console.error('发送消息失败:', error);
    return null;
  }
}

async function downloadTelegramFile(fileId) {
  try {
    console.log('📥 下载文件:', fileId);
    
    const fileInfoResponse = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      throw new Error('获取文件信息失败');
    }
    
    const filePath = fileInfo.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    
    const fileResponse = await fetch(fileUrl);
    const arrayBuffer = await fileResponse.arrayBuffer();
    
    console.log('✅ 文件下载成功');
    return new Blob([arrayBuffer]);
  } catch (error) {
    console.error('❌ 下载文件失败:', error);
    throw error;
  }
}

// ============= 图片分析函数 =============

async function analyzeTransferReceipt(base44, imageBlob) {
  try {
    console.log('🔍 开始分析转账单...');
    
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
      file: imageBlob
    });
    
    const imageUrl = uploadResult.file_url;
    console.log('📎 图片URL:', imageUrl);
    
    // 使用更详细的提示词来识别转账单信息
    const transferData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `请仔细分析这张银行转账单截图，提取以下关键信息。

【必须提取的信息】
1. 转账金额 (amount) - 纯数字，不包含货币符号，例如：5000、10000.50
2. 币种 (currency) - 货币代码，例如：EUR、USD、GBP、SGD等
3. 收款人姓名 (recipient_name) - 完整的收款人名称

【尽量提取的信息】
4. 收款账号 (account_number) - IBAN或银行账号
5. 银行名称 (bank_name) - 收款银行的名称
6. 转账日期 (transfer_date) - 格式：YYYY-MM-DD

【注意事项】
- 转账金额必须准确无误
- 如果图片中有多个金额，选择"实际转账金额"或"到账金额"
- 币种要使用标准的3字母代码（如EUR、USD）
- 收款人姓名要完整，不要截断
- 如果某项信息无法确定，返回null
- 不要猜测或捏造信息

请返回JSON格式的数据。`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: "object",
        properties: {
          amount: { 
            type: "number",
            description: "转账金额（纯数字）"
          },
          currency: { 
            type: "string",
            description: "币种代码（EUR/USD/GBP等）"
          },
          recipient_name: { 
            type: "string",
            description: "收款人完整姓名"
          },
          account_number: { 
            type: "string",
            description: "收款账号或IBAN"
          },
          bank_name: { 
            type: "string",
            description: "收款银行名称"
          },
          transfer_date: { 
            type: "string",
            description: "转账日期 YYYY-MM-DD"
          }
        },
        required: ["amount", "currency"]
      }
    });
    
    console.log('✅ 转账单识别结果:', transferData);
    return { imageUrl, data: transferData };
    
  } catch (error) {
    console.error('❌ 转账单分析失败:', error);
    return null;
  }
}

// ============= 文本解析函数 =============

function parseWaterSlip(text) {
  if (!text) return {};
  
  const data = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 汇款日期
    if (/(汇款日期|日期)/i.test(trimmed)) {
      const match = trimmed.match(/(?:汇款日期|日期)[：:：]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      if (match) {
        try {
          const dateStr = match[1].replace(/\//g, '-');
          const parts = dateStr.split('-');
          data.deposit_date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } catch (e) {
          console.error('日期解析失败:', e);
        }
      }
    }
    
    // 维护期
    else if (/维护期/i.test(trimmed)) {
      const match = trimmed.match(/维护期[：:：]\s*(\d+)/);
      if (match) {
        data.maintenance_days = parseInt(match[1]);
      }
    }
    
    // 查收币种/币种
    else if (/(查收币种|币种)/i.test(trimmed)) {
      const match = trimmed.match(/(?:查收币种|币种)[：:：]\s*([A-Z]{3}|[\u4e00-\u9fa5]+)/i);
      if (match) {
        const curr = match[1].toUpperCase();
        const currencyMap = {
          'EUR': 'EUR欧元', '欧': 'EUR欧元',
          'USD': 'USD美元', '美': 'USD美元',
          'GBP': 'GBP英镑', '英': 'GBP英镑',
          'SGD': 'SGD新元', '新': 'SGD新元',
          'MYR': 'MYR马币', '马': 'MYR马币',
          'AUD': 'AUD澳币', '澳': 'AUD澳币',
          'CHF': 'CHF瑞郎', '瑞': 'CHF瑞郎',
          'THB': 'THB泰铢', '泰': 'THB泰铢',
          'VND': 'VND越南盾', '越': 'VND越南盾',
          'CAD': 'CAD加元', '加': 'CAD加元',
          'HKD': 'HKD港币', '港': 'HKD港币',
          'KRW': 'KRW韩币', '韩': 'KRW韩币'
        };
        
        for (const [key, value] of Object.entries(currencyMap)) {
          if (curr.includes(key)) {
            data.currency = value;
            break;
          }
        }
      }
    }
    
    // 汇款人姓名
    else if (/(汇款人姓名|汇款人|姓名)/i.test(trimmed) && !/账户|账号/i.test(trimmed)) {
      const match = trimmed.match(/(?:汇款人姓名|汇款人|姓名)[：:：]\s*(.+)/i);
      if (match) {
        data.customer_name = match[1].trim();
      }
    }
    
    // 入款账户名
    else if (/入款账户名/i.test(trimmed)) {
      const match = trimmed.match(/入款账户名[：:：]\s*(.+)/i);
      if (match) {
        data.receiving_account_name = match[1].trim();
      }
    }
    
    // 入款账户号
    else if (/入款账户号/i.test(trimmed)) {
      const match = trimmed.match(/入款账户号[：:：]\s*([A-Z0-9\s]+)/i);
      if (match) {
        data.receiving_account_number = match[1].trim();
      }
    }
    
    // 银行名称 (from text, separate from AI's bank_name)
    else if (/银行名称/i.test(trimmed)) {
      const match = trimmed.match(/银行名称[：:：]\s*(.+)/i);
      if (match) {
        data.bank_name = match[1].trim();
      }
    }
    
    // 查收金额
    else if (/(查收金额|金额)/i.test(trimmed)) {
      const match = trimmed.match(/(?:查收金额|金额)[：:：]\s*([\d,.\s]+)/i);
      if (match) {
        const amountStr = match[1].replace(/[,\s]/g, '');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
          data.deposit_amount = amount;
        }
      }
    }
  }
  
  return data;
}

// ============= 数据合并函数 =============

function mergeData(transferData, textData) {
  const merged = { ...textData };
  
  // 优先使用转账单识别的信息
  if (transferData && transferData.data) {
    const td = transferData.data;
    
    if (td.amount) {
      merged.deposit_amount = td.amount;
    }
    
    if (td.currency) {
      const curr = td.currency.toUpperCase();
      const currencyMap = {
        'EUR': 'EUR欧元', 'USD': 'USD美元', 'GBP': 'GBP英镑',
        'SGD': 'SGD新元', 'MYR': 'MYR马币', 'AUD': 'AUD澳币',
        'CHF': 'CHF瑞郎', 'THB': 'THB泰铢', 'VND': 'VND越南盾',
        'CAD': 'CAD加元', 'HKD': 'HKD港币', 'KRW': 'KRW韩币'
      };
      for (const [key, value] of Object.entries(currencyMap)) {
        if (curr.includes(key)) {
          merged.currency = value;
          break;
        }
      }
    }
    
    if (td.recipient_name && !merged.receiving_account_name) {
      merged.receiving_account_name = td.recipient_name;
    }
    
    if (td.account_number) {
      if (!merged.receiving_account_number) {
        merged.receiving_account_number = td.account_number;
      }
      if (!merged.bank_account) {
        merged.bank_account = td.account_number;
      }
    }
    
    if (td.bank_name && !merged.bank_name) {
      merged.bank_name = td.bank_name;
    }
    
    if (td.transfer_date && !merged.deposit_date) {
      merged.deposit_date = td.transfer_date;
    }
  }
  
  // Removed old default value assignments, createTransaction will handle them
  
  return merged;
}

// ============= 创建交易函数 =============

async function createTransaction(base44, data, chatId, messageId, idCardPhotoUrl, transferReceiptUrl) {
  // 生成交易编号
  const numberResponse = await base44.asServiceRole.functions.invoke('generateTransactionNumber', {
    date: data.deposit_date || new Date().toISOString().split('T')[0]
  });
  
  // 计算维护期到期日期
  const depositDate = new Date(data.deposit_date || new Date());
  const maintenanceDays = data.maintenance_days || 15; // Default to 15 days
  const maintenanceEndDate = new Date(depositDate);
  maintenanceEndDate.setDate(maintenanceEndDate.getDate() + maintenanceDays);
  
  const transaction = {
    transaction_number: numberResponse.data.transaction_number,
    customer_name: data.customer_name || '待完善',
    receiving_account_name: data.receiving_account_name || '待完善',
    receiving_account_number: data.receiving_account_number || '待完善',
    bank_name: data.bank_name || '', // This is for AI-identified bank name or text-parsed '银行名称'
    bank_account: data.bank_account || '', // This is for AI-identified account number (IBAN)
    bank_address: data.bank_address || '', // Only from previous text parsing (now removed from parseWaterSlip)
    bank_location: data.bank_location || '', // Only from previous text parsing (now removed from parseWaterSlip)
    currency: data.currency,
    deposit_amount: data.deposit_amount,
    deposit_date: data.deposit_date || new Date().toISOString().split('T')[0],
    maintenance_days: maintenanceDays,
    maintenance_end_date: maintenanceEndDate.toISOString().split('T')[0],
    exchange_rate: data.exchange_rate || 0.95, // Default if not parsed by AI or text
    commission_percentage: data.commission_percentage || 11, // Default if not parsed by AI or text
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
  
  // 计算结算USDT
  const initialUsdt = transaction.deposit_amount / transaction.exchange_rate;
  const commission = initialUsdt * (transaction.commission_percentage / 100);
  transaction.settlement_usdt = initialUsdt - commission - transaction.transfer_fee;
  
  return await base44.asServiceRole.entities.Transaction.create(transaction);
}

// ============= 主处理函数 =============

Deno.serve(async (req) => {
  console.log('\n=== 新的Telegram消息 ===');
  
  try {
    if (!BOT_TOKEN) {
      console.error('❌ Bot Token未设置');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    if (!body.message) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    const message = body.message;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const messageText = message.text || message.caption || '';
    const userName = message.from?.first_name || message.from?.username || '用户';
    
    console.log('📨 消息来自:', userName);
    console.log('📝 消息文本:', messageText);
    
    // 收集所有图片
    const photos = [];
    
    if (message.photo && message.photo.length > 0) {
      photos.push(message.photo[message.photo.length - 1].file_id);
    }
    
    if (message.document && message.document.mime_type?.includes('image')) {
      photos.push(message.document.file_id);
    }
    
    console.log('🖼️ 发现图片数量:', photos.length);
    
    // 必须有图片或文本
    if (photos.length === 0 && !messageText) {
      console.log('⚠️ 没有可处理的内容');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    // 检测是否是水单信息
    const keywords = ['汇款', '转账', '币种', '金额', '账户', '银行', 'IBAN', '查收', '收款', '维护期'];
    const hasKeywords = keywords.some(k => messageText.toLowerCase().includes(k.toLowerCase()));
    
    if (photos.length === 0 && !hasKeywords) {
      console.log('⚠️ 不是水单信息');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    console.log('✅ 检测到水单信息');
    await sendTelegramMessage(chatId, '🔄 正在处理水单...\n分析转账单和保存证件照...', messageId);
    
    // 解析文本
    const textData = parseWaterSlip(messageText);
    console.log('📝 文本数据:', textData);
    
    // 处理所有图片 - 只收录不比对
    let idCardPhotoUrl = '';
    let transferReceiptUrl = '';
    let transferData = null;
    const allFileUrls = []; // 收集所有文件链接用于保存消息记录

    // 1. 处理图片
    for (let i = 0; i < photos.length; i++) {
      try {
        const photoId = photos[i];
        const imageBlob = await downloadTelegramFile(photoId);
        
        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
          file: imageBlob
        });
        const imageUrl = uploadResult.file_url;
        allFileUrls.push(imageUrl);
        
        if (i === 0) {
          idCardPhotoUrl = imageUrl;
          console.log('🪪 收录证件照:', imageUrl);
        } else if (i === 1) {
          console.log('💳 分析转账单提取数据...');
          const analysis = await analyzeTransferReceipt(base44, imageBlob);
          if (analysis) {
            transferReceiptUrl = analysis.imageUrl;
            transferData = analysis;
          }
        }
      } catch (error) {
        console.error('❌ 图片处理失败:', error);
      }
    }

    // 2. 处理文档 (PDF, Word, etc.)
    if (message.document) {
      try {
        console.log('📄 检测到文档:', message.document.file_name);
        const docFileId = message.document.file_id;
        const docBlob = await downloadTelegramFile(docFileId);
        
        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
          file: docBlob
        });
        const docUrl = uploadResult.file_url;
        allFileUrls.push(docUrl);
        console.log('📎 文档已保存:', docUrl);

        // 如果是PDF或图片类文档，尝试作为水单分析
        const mimeType = message.document.mime_type || '';
        if (!transferData && (mimeType.includes('pdf') || mimeType.includes('image'))) {
           // 这里简单复用analyzeTransferReceipt，虽然它主要是为图片设计的，但如果LLM支持多模态或我们有转换逻辑则可行
           // 目前Core.InvokeLLM支持file_urls，我们可以尝试传入文档URL让LLM提取
           console.log('🤖 尝试分析文档内容...');
           const analysis = await analyzeDocument(base44, docUrl);
           if (analysis) {
             transferData = analysis;
             // 如果是文档作为水单，我们没有"图片URL"，但可以记录文档URL
             if (!transferReceiptUrl) transferReceiptUrl = docUrl;
           }
        }
      } catch (error) {
        console.error('❌ 文档处理失败:', error);
      }
    }

    // 3. 保存消息记录 (双向同步基础)
    try {
      // 简单的分类逻辑
      let category = 'other';
      let tags = [];
      
      if (text) {
        if (text.includes('汇款') || text.includes('转账') || text.includes('水单')) {
          category = 'transaction';
          tags.push('transaction');
        }
        if (text.includes('你好') || text.includes('在吗')) {
          category = 'inquiry';
          tags.push('greeting');
        }
      }
      if (allFileUrls.length > 0) {
        tags.push('has_attachment');
        if (message.document) tags.push('document');
        if (photos.length > 0) tags.push('photo');
      }

      // 异步调用LLM进行更智能的分类（不阻塞主流程）
      // 注意：在Serverless环境中最好await，否则可能被冻结。为了响应速度，这里用简单规则，或者快速LLM调用。
      
      await base44.asServiceRole.entities.TelegramMessage.create({
        chat_id: String(chatId),
        message_id: String(message.message_id),
        sender_name: senderName,
        content: text || (allFileUrls.length > 0 ? '[文件消息]' : '[未知消息]'),
        file_urls: allFileUrls,
        file_type: allFileUrls.length > 0 ? (message.document ? 'document' : 'photo') : 'text',
        direction: 'incoming',
        tags: tags,
        category: category,
        status: 'unread'
      });
      console.log('💾 消息已存档');
    } catch (error) {
      console.error('❌ 消息存档失败:', error);
    }
    
    // 合并数据
    const mergedData = mergeData(transferData, textData);
    console.log('📊 合并后数据:', mergedData);
    
    // 验证必要字段
    if (!mergedData.deposit_amount || !mergedData.currency) {
      await sendTelegramMessage(
        chatId,
        '❌ <b>信息不完整</b>\n\n缺少必要信息（金额或币种）\n\n请确保：\n1. 转账单图片清晰\n2. 或在文本中提供金额和币种',
        messageId
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    // 创建交易
    try {
      const transaction = await createTransaction(
        base44, 
        mergedData, 
        chatId, 
        messageId, 
        idCardPhotoUrl, 
        transferReceiptUrl
      );
      
      // 生成成功消息
      let successMsg = `✅ <b>水单录入成功</b>\n\n`;
      successMsg += `━━━━━━━━━━━━━━━━━━\n`;
      successMsg += `📋 <b>交易信息</b>\n`;
      successMsg += `━━━━━━━━━━━━━━━━━━\n\n`;
      
      successMsg += `📝 编号: <code>${transaction.transaction_number}</code>\n\n`;
      
      if (idCardPhotoUrl) {
        successMsg += `✓ 证件照已保存\n`;
      }
      if (transferReceiptUrl) {
        successMsg += `✓ 转账单已保存\n`;
      }
      successMsg += `\n`;
      
      successMsg += `👤 汇款人: ${transaction.customer_name}\n`;
      successMsg += `🏢 入款账户: ${transaction.receiving_account_name}\n`;
      successMsg += `💳 入款账号: ${transaction.receiving_account_number}\n`;
      if (transaction.bank_name && transaction.bank_name !== '待完善') {
        successMsg += `🏦 银行名称: ${transaction.bank_name}\n`;
      }
      if (transaction.bank_account) {
        successMsg += `💳 AI识别账号: ${transaction.bank_account}\n`;
      }
      successMsg += `\n`;
      successMsg += `💵 金额: ${transaction.deposit_amount.toLocaleString()} ${transaction.currency}\n`;
      successMsg += `📅 汇款日期: ${transaction.deposit_date}\n`;
      successMsg += `⏱️ 维护期: ${transaction.maintenance_days}天\n`;
      successMsg += `📆 到期日: ${transaction.maintenance_end_date}\n`;
      successMsg += `📊 汇率: ${transaction.exchange_rate}\n`;
      successMsg += `💸 佣金: ${transaction.commission_percentage}%\n`;
      successMsg += `\n`;
      successMsg += `━━━━━━━━━━━━━━━━━━\n\n`;
      successMsg += `📊 状态: ${transaction.fund_status}\n`;
      successMsg += `💰 结算USDT: ${transaction.settlement_usdt.toFixed(2)}\n`;
      successMsg += `🆔 DB ID: <code>${transaction.id}</code>\n`;
      successMsg += `⏰ ${new Date().toLocaleString('zh-CN')}\n\n`;
      successMsg += `✨ 已保存到系统`;
      
      await sendTelegramMessage(chatId, successMsg, messageId);
      console.log('✅ 处理完成');
      
    } catch (error) {
      console.error('❌ 创建交易失败:', error);
      await sendTelegramMessage(
        chatId,
        `❌ <b>录入失败</b>\n\n${error.message}\n\n请联系管理员`,
        messageId
      );
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
    
  } catch (error) {
    console.error('❌ 处理失败:', error);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});