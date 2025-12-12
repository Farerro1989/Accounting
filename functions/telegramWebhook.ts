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

// ============= 图片/文档分析函数 =============

// LLM分析文档 (PDF/Word)
async function analyzeDocument(base44, docUrl) {
  const currentYear = new Date().getFullYear();
  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `请分析这份文档，提取转账水单信息。如果是水单，请提取以下字段并返回JSON：
      - currency (币种代码,如USD, EUR)
      - amount (金额,数字)
      - customer_name (汇款人姓名)
      - receiving_account_name (收款人/公司名)
      - receiving_account_number (收款账号/IBAN)
      - bank_name (银行名称)
      - date (日期 YYYY-MM-DD)
      
      如果不是水单，返回 null。`,
      response_json_schema: {
        type: "object",
        properties: {
          currency: { type: "string" },
          amount: { type: "number" },
          customer_name: { type: "string" },
          receiving_account_name: { type: "string" },
          receiving_account_number: { type: "string" },
          bank_name: { type: "string" },
          date: { type: "string" }
        }
      },
      file_urls: [docUrl]
    });

    if (!result || !result.amount) return null;
    return { imageUrl: docUrl, data: result };
  } catch (error) {
    console.error("文档分析失败:", error);
    return null;
  }
}

// 智能图片内容分析 (支持水单和证件)
async function analyzeImageContent(base44, imageUrl) {
  const currentYear = new Date().getFullYear();
  try {
    console.log('🔍 开始智能分析图片内容...', imageUrl);
    
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
          image_type: { 
            type: "string", 
            enum: ["id_card", "transfer_receipt", "other"],
            description: "图片类型"
          },
          // 证件字段
          name: { type: "string", description: "证件姓名" },
          birth_date: { type: "string", description: "出生日期" },
          nationality: { type: "string", description: "国籍" },
          // 水单字段
          amount: { type: "number" },
          currency: { type: "string" },
          recipient_name: { type: "string" },
          account_number: { type: "string" },
          bank_name: { type: "string" },
          transfer_date: { type: "string" }
        },
        required: ["image_type"]
      }
    });
    
    console.log('✅ 图片智能分析结果:', result);
    return { imageUrl, data: result };
    
  } catch (error) {
    console.error('❌ 图片分析失败:', error);
    return null;
  }
}

// ============= 文本解析函数 =============

// LLM分析文本内容 (当正则匹配失败或需要更精确提取时使用)
async function analyzeText(base44, text) {
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
      
      注意:
      1. 币种请使用标准3位代码
      2. 金额请返回纯数字
      3. 如果没有找到某项信息，请返回null`,
      response_json_schema: {
        type: "object",
        properties: {
          currency: { type: "string" },
          amount: { type: "number" },
          customer_name: { type: "string" },
          receiving_account_name: { type: "string" },
          receiving_account_number: { type: "string" },
          bank_name: { type: "string" },
          date: { type: "string" },
          maintenance_days: { type: "number" }
        }
      }
    });
    
    if (!result) return null;
    
    // 简单的字段映射以匹配内部格式
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
    console.error("文本LLM分析失败:", error);
    return null;
  }
}

function parseWaterSlip(text) {
  if (!text) return {};
  
  const data = {};
  const lines = text.split('\n');
  const currentYear = new Date().getFullYear();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 1. 汇款日期 (支持空格，支持MM-DD自动补年份)
    if (/(?:汇款\s*日期|日期)\s*[：:：=]/.test(trimmed)) {
      // 匹配完整日期 YYYY-MM-DD
      let match = trimmed.match(/(?:汇款\s*日期|日期)\s*[：:：=]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      if (match) {
        data.deposit_date = match[1].replace(/\//g, '-');
      } else {
        // 匹配简写日期 MM-DD 或 M-D
        match = trimmed.match(/(?:汇款\s*日期|日期)\s*[：:：=]\s*(\d{1,2}[-/]\d{1,2})/);
        if (match) {
          data.deposit_date = `${currentYear}-${match[1].replace(/\//g, '-')}`;
          // 格式化月日，确保是MM-DD
          const parts = data.deposit_date.split('-');
          if (parts.length === 3) {
            data.deposit_date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
      }
    }
    
    // 2. 维护期
    else if (/维护期\s*(?:（天数）)?\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/维护期.*?[：:：=]\s*(\d+)/);
      if (match) data.maintenance_days = parseInt(match[1]);
    }
    
    // 3. 查收币种/入金币种
    else if (/(?:查收\s*币种|入金\s*币种|币种)\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/(?:查收\s*币种|入金\s*币种|币种)\s*[：:：=]\s*([A-Z]{3}|[\u4e00-\u9fa5]+)/i);
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
          'KRW': 'KRW韩币', '韩': 'KRW韩币',
          'CNY': 'CNY人民币', '人': 'CNY人民币',
          'JPY': 'JPY日元', '日': 'JPY日元',
          'AED': 'AED迪拉姆', '迪': 'AED迪拉姆',
          'PHP': 'PHP菲律宾比索', '菲': 'PHP菲律宾比索',
          'IDR': 'IDR印尼盾', '印': 'IDR印尼盾'
        };
        for (const [key, value] of Object.entries(currencyMap)) {
          if (curr.includes(key)) {
            data.currency = value;
            break;
          }
        }
      }
    }
    
    // 4. 汇款人姓名
    else if (/(?:汇款人\s*姓名|汇款人|客户\s*姓名)\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/(?:汇款人\s*姓名|汇款人|客户\s*姓名).*?[：:：=]\s*(.+)/);
      if (match) data.customer_name = match[1].trim();
    }
    
    // 5. 收款账户名/入款账户名 (扩展匹配: 收款人, 收款方, 公司名, 户名)
    else if (/(?:收款|入款|公司|账户)\s*(?:账户名|户名|名称|名|人|方)\s*[：:：=]/.test(trimmed) && !/汇款|客户/.test(trimmed)) {
      const match = trimmed.match(/(?:收款|入款|公司|账户)\s*(?:账户名|户名|名称|名|人|方).*?[：:：=]\s*(.+)/);
      if (match) data.receiving_account_name = match[1].trim();
    }
    
    // 6. 收款账户/入款账户号 (扩展匹配: 账号, 卡号, 账户号)
    else if (/(?:收款|入款|公司|账户|银行)\s*(?:账号|账户号|卡号|号码)\s*[：:：=]/.test(trimmed) && !/汇款|客户/.test(trimmed)) {
      const match = trimmed.match(/(?:收款|入款|公司|账户|银行)\s*(?:账号|账户号|卡号|号码).*?[：:：=]\s*([A-Z0-9\s-]+)/i);
      if (match) data.receiving_account_number = match[1].trim();
    }
    
    // 7. 查收金额
    else if (/(?:查收\s*金额|金额)\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/(?:查收\s*金额|金额)\s*[：:：=]\s*([\d,.\s]+)/);
      if (match) {
        const amount = parseFloat(match[1].replace(/[,\s]/g, ''));
        if (!isNaN(amount)) data.deposit_amount = amount;
      }
    }

    // 8. 汇款笔数
    else if (/(?:汇款\s*笔数|笔数)\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/(?:汇款\s*笔数|笔数)\s*[：:：=]\s*(\d+)/);
      if (match) data.remittance_count = parseInt(match[1]);
    }

    // 9. 国籍
    else if (/国籍\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/国籍\s*[：:：=]\s*(.+)/);
      if (match) data.customer_nationality = match[1].trim();
    }

    // 10. 年龄
    else if (/(?:年龄|年齡)\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/(?:年龄|年齡)\s*[：:：=]\s*(\d+)/);
      if (match) data.customer_age = parseInt(match[1]);
    }

    // 11. 汇率
    else if (/汇率\s*[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/汇率\s*[：:：=]\s*([\d.]+)/);
      if (match) data.exchange_rate = parseFloat(match[1]);
    }

    // 12. 点位 (支持 "点位（包含加点）:13%")
    else if (/(?:点位|佣金).*?[：:：=]/.test(trimmed)) {
      const match = trimmed.match(/(?:点位|佣金).*?[：:：=]\s*([\d.]+)/);
      if (match) data.commission_percentage = parseFloat(match[1]);
    }

    // 13. 进算/拖算 (单独一行或包含在行内)
    if (/(?:进算|拖算)/.test(trimmed)) {
      data.calculation_mode = trimmed.includes('拖算') ? '拖算' : '进算';
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
        'CAD': 'CAD加元', 'HKD': 'HKD港币', 'KRW': 'KRW韩币',
        'CNY': 'CNY人民币', 'RMB': 'CNY人民币',
        'JPY': 'JPY日元', 'AED': 'AED迪拉姆',
        'PHP': 'PHP菲律宾比索', 'IDR': 'IDR印尼盾'
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
  // 确保数值字段有效
  data.deposit_amount = parseFloat(data.deposit_amount) || 0;
  data.exchange_rate = parseFloat(data.exchange_rate) || 0.96;
  data.commission_percentage = parseFloat(data.commission_percentage) || 13.5;
  data.transfer_fee = parseFloat(data.transfer_fee) || 25;

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
    customer_age: data.customer_age || null,
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
    exchange_rate: data.exchange_rate || 0.95,
    commission_percentage: data.commission_percentage || 13.5, // Updated default to 13.5
    calculation_mode: data.calculation_mode || '进算',
    remittance_count: data.remittance_count || 1,
    customer_nationality: data.customer_nationality || '',
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

// ============= 批量处理函数 =============

async function processBatch(base44, chatId) {
  try {
    // 1. 获取最近未处理的消息 (pending_batch 或 unread 且包含文件)
    // 注意：Base44 SDK 列表查询可能需要根据实际支持的过滤语法调整
    // 这里假设 .filter() 支持简单对象过滤。如果不支持复杂查询，可能需要 list 后过滤
    const messages = await base44.asServiceRole.entities.TelegramMessage.list(); // 获取最近消息
    
    // 过滤出当前chatId的、未处理的、有文件的消息
    const batchMessages = messages.filter(m => 
      m.chat_id === String(chatId) && 
      (m.status === 'pending_batch' || m.status === 'unread') &&
      m.file_urls && m.file_urls.length > 0
    ).slice(0, 10); // 限制处理最近10条，防止过多

    if (batchMessages.length === 0) {
      return "⚠️ 没有找到需要处理的文件消息。请确保先发送图片/文档，再发送 /process_batch";
    }

    await sendTelegramMessage(chatId, `🔄 开始批量处理 ${batchMessages.length} 条消息...`);

    // 2. 收集所有图片/文档 URL
    let allImages = [];
    batchMessages.forEach(msg => {
      if (msg.file_urls) {
        allImages = [...allImages, ...msg.file_urls];
      }
    });

    if (allImages.length === 0) return "⚠️ 未找到有效的文件链接";

    // 3. 分析所有文件
    let idCardData = null;
    let receiptData = null;
    let idCardUrl = '';
    let receiptUrl = '';
    let transactionData = {};

    for (const url of allImages) {
      // 简单判断文件类型（图片vs文档），这里复用之前的 analyzeImageContent
      // 如果是文档URL，可能需要 analyzeDocument。为简化，先假设大部分是图片。
      // 实际应根据 metadata 或 url 后缀判断，但 telegram file path 不一定有后缀。
      // 尝试作为图片分析
      const analysis = await analyzeImageContent(base44, url);
      
      if (analysis && analysis.data) {
        const type = analysis.data.image_type;
        console.log(`🖼️ [批量] 识别结果: ${type} (${url})`);

        if (type === 'id_card') {
          idCardData = analysis.data;
          idCardUrl = url;
          // 计算年龄
          if (idCardData.birth_date) {
             const birthYear = parseInt(idCardData.birth_date.substring(0, 4));
             if (!isNaN(birthYear)) {
               idCardData.age = new Date().getFullYear() - birthYear;
             }
          }
        } else if (type === 'transfer_receipt') {
          // 如果有多张水单，目前逻辑是覆盖或保留第一张。
          // 既然是"关联"，假设是一对一。
          if (!receiptData) {
            receiptData = analysis.data;
            receiptUrl = url;
          }
        } else {
          // 如果未识别出类型，若还没有水单，暂作水单处理
          if (!receiptData) {
             receiptData = analysis.data;
             receiptUrl = url;
          }
        }
      } else {
        // 尝试文档分析
        const docAnalysis = await analyzeDocument(base44, url);
        if (docAnalysis && docAnalysis.data) {
           if (!receiptData) {
             receiptData = docAnalysis.data;
             receiptUrl = url;
             console.log(`📄 [批量] 文档识别为水单`);
           }
        }
      }
    }

    // 4. 关联与合并数据
    if (!receiptData && !idCardData) {
      return "❌ 未能识别出有效的水单或证件信息。请重试或手动录入。";
    }

    // 基础数据来自水单，补充数据来自证件
    let mergedData = { ...receiptData };
    
    // 注入证件信息
    if (idCardData) {
      if (idCardData.name) mergedData.customer_name = idCardData.name;
      if (idCardData.age) mergedData.customer_age = idCardData.age;
      if (idCardData.nationality) mergedData.customer_nationality = idCardData.nationality;
    }

    // 确保有金额和币种
    if (!mergedData.amount || !mergedData.currency) {
      // 尝试再次从文本解析（如果有文本消息在 batchMessages 中）
      // ...这里简化，直接返回提示
      return "⚠️ 识别到的信息不完整（缺少金额或币种）。已尝试关联，但数据不足。";
    }

    // 格式转换
    const finalData = {
      deposit_amount: mergedData.amount,
      currency: mergedData.currency,
      customer_name: mergedData.customer_name,
      receiving_account_name: mergedData.receiving_account_name || mergedData.recipient_name,
      receiving_account_number: mergedData.receiving_account_number || mergedData.account_number,
      bank_name: mergedData.bank_name,
      deposit_date: mergedData.transfer_date || mergedData.date,
      // 默认值
      maintenance_days: 15,
      commission_percentage: 13.5,
      exchange_rate: 0.96
    };
    
    // 5. 创建交易
    const transaction = await createTransaction(
      base44,
      finalData,
      chatId,
      batchMessages[batchMessages.length - 1].message_id, // 使用最后一条消息ID
      idCardUrl,
      receiptUrl
    );

    // 6. 更新消息状态为 processed
    for (const msg of batchMessages) {
       // 更新状态 (需确认 update 方法是否存在和权限)
       try {
         await base44.asServiceRole.entities.TelegramMessage.update(msg.id, { status: 'processed' });
       } catch (e) {
         console.error('更新消息状态失败:', e);
       }
    }

    // 7. 构建回复
    let reply = `✅ <b>批量处理完成</b>\n\n`;
    if (idCardData && receiptData) {
      reply += `🔗 <b>已自动关联证件与水单</b>\n`;
      reply += `   证件: ${idCardData.name} (${idCardData.age || '?'}岁)\n`;
      reply += `   水单: ${finalData.deposit_amount} ${finalData.currency}\n\n`;
    } else if (idCardData) {
      reply += `⚠️ 仅识别到证件信息，未找到水单金额，无法创建完整交易。\n`;
      return reply; // 没水单不创建交易? createTransaction 会失败或者缺字段。上方已校验。
    } else {
      reply += `⚠️ 未识别到证件，仅依据水单创建。\n\n`;
    }

    reply += `📝 编号: <code>${transaction.transaction_number}</code>\n`;
    reply += `💵 金额: ${transaction.deposit_amount.toLocaleString()} ${transaction.currency}\n`;
    if (finalData.customer_name) reply += `👤 客户: ${finalData.customer_name}\n`;
    if (finalData.customer_age >= 70) reply += `⚠️ <b>高龄客户提醒</b> (${finalData.customer_age}岁)\n`;

    return reply;

  } catch (error) {
    console.error("批量处理异常:", error);
    return `❌ 批量处理失败: ${error.message}`;
  }
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
    const mediaGroupId = message.media_group_id || null;

    console.log('📨 消息来自:', userName);
    console.log('📝 消息文本:', messageText);
    if (mediaGroupId) console.log('📦 Media Group ID:', mediaGroupId);
    
    // ============ 指令处理 ============
    if (messageText.startsWith('/process_batch')) {
      const resultMsg = await processBatch(base44, chatId);
      await sendTelegramMessage(chatId, resultMsg, messageId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (messageText.startsWith('/reanalyze')) {
      // 逻辑: 提取目标 message_id (用户可能回复某条消息，或者输入ID)
      let targetMessageId = null;
      if (message.reply_to_message) {
        targetMessageId = String(message.reply_to_message.message_id);
      } else {
        const parts = messageText.split(' ');
        if (parts.length > 1) targetMessageId = parts[1];
      }

      if (targetMessageId) {
        await sendTelegramMessage(chatId, `🔄 正在重新分析消息 ${targetMessageId}...`, messageId);
        // 查找消息记录
        const msgs = await base44.asServiceRole.entities.TelegramMessage.list();
        const targetMsg = msgs.find(m => m.message_id === targetMessageId && m.chat_id === String(chatId));
        
        if (targetMsg && targetMsg.file_urls && targetMsg.file_urls.length > 0) {
           // 简单的重分析：当作单条处理
           // 为简化，直接调用 processBatch 但只限定这一条? 或者复用 analyzeImageContent
           // 这里简单演示对第一张图的重分析
           const url = targetMsg.file_urls[0];
           const analysis = await analyzeImageContent(base44, url);
           if (analysis && analysis.data) {
             await sendTelegramMessage(chatId, `✅ <b>重新分析结果</b>\n<pre>${JSON.stringify(analysis.data, null, 2)}</pre>`, messageId);
           } else {
             await sendTelegramMessage(chatId, `❌ 重新分析失败，未识别到内容`, messageId);
           }
        } else {
           await sendTelegramMessage(chatId, `❌ 未找到该消息记录或该消息无文件`, messageId);
        }
      } else {
        await sendTelegramMessage(chatId, `⚠️ 请回复一条带有图片的消息并发送 /reanalyze，或输入 /reanalyze [message_id]`, messageId);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 收集所有图片和文档
    const photos = [];
    const allFileUrls = []; // 收集所有文件链接
    
    if (message.photo && message.photo.length > 0) {
      photos.push(message.photo[message.photo.length - 1].file_id);
    }
    
    // 1. 处理图片
    let idCardPhotoUrl = '';
    let transferReceiptUrl = '';
    let transferData = null;
    let extractedCustomerName = '';
    let extractedAge = null;
    let extractedNationality = '';

    for (let i = 0; i < photos.length; i++) {
      try {
        const photoId = photos[i];
        const imageBlob = await downloadTelegramFile(photoId);
        
        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
          file: imageBlob
        });
        const imageUrl = uploadResult.file_url;
        allFileUrls.push(imageUrl);
        
        // 智能分析图片内容 (区分证件或水单)
        const analysis = await analyzeImageContent(base44, imageUrl);
        
        if (analysis && analysis.data) {
          const type = analysis.data.image_type;
          console.log(`🖼️ 图片识别为: ${type}`);
          
          if (type === 'id_card') {
            idCardPhotoUrl = imageUrl;
            if (analysis.data.name) extractedCustomerName = analysis.data.name;
            if (analysis.data.birth_date) {
              // 计算年龄
              const birthYear = parseInt(analysis.data.birth_date.substring(0, 4));
              if (!isNaN(birthYear)) {
                extractedAge = new Date().getFullYear() - birthYear;
              }
            }
            if (analysis.data.nationality) extractedNationality = analysis.data.nationality;
          } else if (type === 'transfer_receipt') {
            transferReceiptUrl = imageUrl;
            // 如果已经有transferData，可能保留第一个或合并，这里简单保留
            if (!transferData) {
               transferData = { imageUrl, data: analysis.data };
            }
          } else {
             // 默认为水单处理，防止漏判
             if (!transferData) {
               transferData = { imageUrl, data: analysis.data };
               transferReceiptUrl = imageUrl;
             }
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

        // 尝试作为水单分析
        const mimeType = message.document.mime_type || '';
        if (!transferData) {
           console.log('🤖 尝试分析文档内容...');
           const analysis = await analyzeDocument(base44, docUrl);
           if (analysis) {
             transferData = analysis;
             if (!transferReceiptUrl) transferReceiptUrl = docUrl;
           }
        }
      } catch (error) {
        console.error('❌ 文档处理失败:', error);
      }
    }

    // 3. 保存消息记录 (双向同步基础)
    try {
      let category = 'other';
      let tags = [];
      
      if (messageText) {
        if (messageText.includes('汇款') || messageText.includes('转账') || messageText.includes('水单')) {
          category = 'transaction';
          tags.push('transaction');
        }
        if (messageText.includes('你好') || messageText.includes('在吗')) {
          category = 'inquiry';
          tags.push('greeting');
        }
      }
      if (allFileUrls.length > 0) {
        tags.push('has_attachment');
        if (message.document) tags.push('document');
        if (photos.length > 0) tags.push('photo');
      }

      // 准备分析结果数据
      let analysisData = null;
      if (transferData && transferData.data) {
        analysisData = transferData.data;
      } else if (idCardPhotoUrl) {
         // 重新构建证件的 analysis data
         analysisData = {
           image_type: 'id_card',
           name: extractedCustomerName,
           birth_date: extractedAge ? (new Date().getFullYear() - extractedAge).toString() : null, // 估算年份
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
        tags: tags,
        category: category,
        status: 'processed', // 自动处理
        analysis_result: analysisData
      });
      console.log('💾 消息已存档');
    } catch (error) {
      console.error('❌ 消息存档失败:', error);
    }

    // 4. 检查是否需要继续处理为交易
    // 如果是 Media Group 的一部分，跳过自动处理，等待 /process_batch
    if (mediaGroupId) {
       console.log('⏳ 收到 Media Group 消息，跳过自动处理，等待指令。');
       // 可选：发送提示 (为了不刷屏，这里不发，或者只对第一条发? 很难判断第一条)
       return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 必须有图片或文本
    // 必须有图片或文本
    if (photos.length === 0 && !messageText && !message.document) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    // 检测是否是水单信息
    const keywords = ['汇款', '转账', '币种', '金额', '账户', '银行', 'IBAN', '查收', '收款', '维护期'];
    const hasKeywords = keywords.some(k => messageText.toLowerCase().includes(k.toLowerCase()));
    
    // 只有在明确是水单（有关键字 或 已识别出转账数据）时才继续处理为交易
    // 如果只是普通聊天消息，则只保存消息记录即可
    if (!hasKeywords && !transferData) {
       console.log('ℹ️ 仅存档消息，非交易指令');
       return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 如果是水单，发送处理中提示
    await sendTelegramMessage(chatId, '🔄 正在处理水单信息...', messageId);
    
    // 解析文本 (优先使用正则，如果关键信息缺失，尝试LLM分析)
    let textData = parseWaterSlip(messageText);
    
    // 如果正则解析缺少关键信息且有足够文本长度，尝试LLM分析文本
    // 注：新的parseWaterSlip已经涵盖了大部分字段解析，这里保留LLM作为兜底

    if ((!textData.deposit_amount || !textData.currency) && messageText.length > 10) {
      console.log('🤔 正则解析不完整，尝试LLM分析文本...');
      const llmTextData = await analyzeText(base44, messageText);
      if (llmTextData) {
        console.log('🤖 LLM文本分析结果:', llmTextData);
        // 合并LLM结果 (LLM结果优先于正则，因为更智能)
        textData = { ...textData, ...llmTextData };
      }
    }

    console.log('📝 最终文本数据:', textData);
    
    // 合并数据
    const mergedData = mergeData(transferData, textData);
    
    // 尝试寻找关联的证件信息 (当前消息提取的 或 历史消息关联的)
    let linkedIdCardUrl = idCardPhotoUrl;

    // 1. 优先使用当前消息提取的证件信息
    if (extractedCustomerName) {
      mergedData.customer_name = extractedCustomerName;
    }
    if (extractedAge) {
      mergedData.customer_age = extractedAge;
    }
    if (extractedNationality) {
      mergedData.customer_nationality = extractedNationality;
    }

    // 2. 如果当前消息没有证件信息，尝试查找同组(Media Group)或最近的证件消息
    if (!extractedCustomerName && !extractedAge) {
       try {
         // 获取最近的10条消息
         const recentMsgs = await base44.asServiceRole.entities.TelegramMessage.list(); // 默认按时间倒序
         
         // 查找逻辑:
         // A. 如果有 mediaGroupId，找同组的 type='id_card'
         // B. 如果没有，找同 chat_id 且时间在最近 5 分钟内的 type='id_card'
         
         const targetIdCardMsg = recentMsgs.find(m => {
           if (m.chat_id !== String(chatId)) return false;
           if (!m.analysis_result || m.analysis_result.image_type !== 'id_card') return false;
           
           // A. Media Group 匹配
           if (mediaGroupId && m.media_group_id === mediaGroupId) return true;
           
           // B. 时间匹配 (忽略同一次请求的自己，虽然 list 可能还没包含自己或者刚存入)
           // 简单起见，只要是最近一条证件即可 (假设最近的证件就是匹配的)
           // 为防止关联到很久以前的，可以加个数量限制或时间判断，这里简化为最近一条
           return true; 
         });

         if (targetIdCardMsg && targetIdCardMsg.analysis_result) {
            console.log('🔗 自动关联到历史证件消息:', targetIdCardMsg.message_id);
            const idData = targetIdCardMsg.analysis_result;
            
            if (idData.name) mergedData.customer_name = idData.name;
            // 处理年龄
            if (idData.birth_date) {
               const birthYear = parseInt(idData.birth_date.substring(0, 4));
               if (!isNaN(birthYear)) {
                 mergedData.customer_age = new Date().getFullYear() - birthYear;
               }
            } else if (idData.age) {
               mergedData.customer_age = idData.age;
            }
            if (idData.nationality) mergedData.customer_nationality = idData.nationality;
            
            // 关联证件图片URL
            if (targetIdCardMsg.file_urls && targetIdCardMsg.file_urls.length > 0) {
               linkedIdCardUrl = targetIdCardMsg.file_urls[0];
            }
         }
       } catch (e) {
         console.error('查找关联证件失败:', e);
       }
    }
    
    console.log('📊 合并后数据:', mergedData);
    
    // 验证必要字段
    if (!mergedData.deposit_amount || !mergedData.currency) {
      await sendTelegramMessage(
        chatId,
        '❌ <b>信息不完整</b>\n\n缺少必要信息（金额或币种）\n\n请确保：\n1. 转账单图片/文档清晰\n2. 或在文本中提供金额和币种\n3. 或检查图片是否模糊',
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
        linkedIdCardUrl, 
        transferReceiptUrl
      );
      
      // 生成成功消息
      let successMsg = `✅ <b>水单录入成功，请核对信息</b>\n\n`;
      successMsg += `📝 编号: <code>${transaction.transaction_number}</code>\n`;
      successMsg += `💵 查收金额: ${transaction.deposit_amount.toLocaleString()} ${transaction.currency}\n`;
      successMsg += `🔢 汇款笔数: ${transaction.remittance_count || 1}笔\n`;
      successMsg += `👤 汇款人: ${transaction.customer_name}`;
      if (transaction.customer_age) {
        successMsg += ` (${transaction.customer_age}岁)`;
        if (transaction.customer_age >= 70) {
          successMsg += ` ⚠️⚠️⚠️ <b>高龄客户提醒</b> ⚠️⚠️⚠️`;
        }
      }
      if (transaction.customer_nationality) successMsg += ` [${transaction.customer_nationality}]`;
      successMsg += `\n`;
      successMsg += `🏢 收款账户名: ${transaction.receiving_account_name}\n`;
      successMsg += `💳 收款账号: ${transaction.receiving_account_number}\n`;
      successMsg += `💱 汇率: ${transaction.exchange_rate}\n`;
      successMsg += `📊 点位: ${transaction.commission_percentage}% (${transaction.calculation_mode || '进算'})\n`;
      successMsg += `📆 汇款日期: ${transaction.deposit_date}\n`;
      successMsg += `⏳ 维护期: ${transaction.maintenance_days}天 (到期: ${transaction.maintenance_end_date})\n\n`;
      successMsg += `✨ 如有误请在后台修改`;
      
      await sendTelegramMessage(chatId, successMsg, messageId);
      console.log('✅ 交易创建完成');
      
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