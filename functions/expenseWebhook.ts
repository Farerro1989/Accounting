import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BOT_TOKEN = Deno.env.get("EXPENSE_BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");
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

async function analyzeExpenseReceipt(base44, imageBlob) {
  try {
    console.log('🔍 开始分析消费小票...');
    
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
      file: imageBlob
    });
    
    const imageUrl = uploadResult.file_url;
    console.log('📎 图片URL:', imageUrl);
    
    const expenseData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `请仔细分析这张消费小票/账单截图，提取以下关键信息。

【必须提取的信息】
1. 消费金额 (amount) - 纯数字，不包含货币符号，例如：50.00、100.50
2. 币种 (currency) - 货币代码，例如：EUR、USD、MYR、GBP、SGD等
3. 消费标题/商家名称 (title) - 商家名称或消费简述
4. 消费数量 (quantity) - 数字，如果小票上显示购买数量则提取，否则默认为1

【尽量提取的信息】
5. 消费日期 (expense_date) - 格式：YYYY-MM-DD
6. 消费分类 (category) - 如：餐饮、交通、购物、娱乐、住宿、其他
7. 支付方式 (payment_method) - 如：现金、银行卡、支付宝、微信、信用卡
8. 详细说明 (description) - 消费的详细描述或备注

【注意事项】
- 金额必须准确无误
- 币种要使用标准的3字母代码（如EUR、USD、MYR）
- 如果图片中有多个金额，选择"总计"或"实付金额"
- 数量默认为1，除非明确显示购买了多个
- 如果某项信息无法确定，返回null或合理的默认值
- 不要猜测或捏造信息

请返回JSON格式的数据。`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: "object",
        properties: {
          amount: { 
            type: "number",
            description: "消费金额（纯数字）"
          },
          quantity: {
            type: "number",
            description: "消费数量"
          },
          currency: { 
            type: "string",
            description: "币种代码（EUR/USD/MYR等）"
          },
          title: { 
            type: "string",
            description: "商家名称或消费标题"
          },
          expense_date: { 
            type: "string",
            description: "消费日期 YYYY-MM-DD"
          },
          category: { 
            type: "string",
            description: "消费分类"
          },
          payment_method: { 
            type: "string",
            description: "支付方式"
          },
          description: { 
            type: "string",
            description: "详细说明"
          }
        },
        required: ["amount", "currency", "title"]
      }
    });
    
    console.log('✅ 小票识别结果:', expenseData);
    return { imageUrl, data: expenseData };
    
  } catch (error) {
    console.error('❌ 小票分析失败:', error);
    return null;
  }
}

// ============= 文本解析函数 =============

function parseExpenseText(text) {
  if (!text) return {};
  
  const data = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 标题/商家
    if (/(标题|商家|店名)/i.test(trimmed)) {
      const match = trimmed.match(/(?:标题|商家|店名)[：:：]\s*(.+)/i);
      if (match) data.title = match[1].trim();
    }
    
    // 数量
    else if (/(数量)/i.test(trimmed)) {
      const match = trimmed.match(/(?:数量)[：:：]\s*(\d+)/i);
      if (match) {
        const qty = parseInt(match[1]);
        if (!isNaN(qty) && qty > 0) {
          data.quantity = qty;
        }
      }
    }
    
    // 金额
    else if (/(金额|价格|总计|实付|单价)/i.test(trimmed)) {
      const match = trimmed.match(/(?:金额|价格|总计|实付|单价)[：:：]\s*([\d,.\s]+)/i);
      if (match) {
        const amountStr = match[1].replace(/[,\s]/g, '');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
          data.amount = amount;
        }
      }
    }
    
    // 币种
    else if (/(币种|货币)/i.test(trimmed)) {
      const match = trimmed.match(/(?:币种|货币)[：:：]\s*([A-Z]{3}|[\u4e00-\u9fa5]+)/i);
      if (match) {
        const curr = match[1].toUpperCase();
        const currencyMap = {
          'EUR': 'EUR欧元', '欧': 'EUR欧元',
          'USD': 'USD美元', '美': 'USD美元',
          'MYR': 'MYR马币', '马': 'MYR马币'
        };
        
        for (const [key, value] of Object.entries(currencyMap)) {
          if (curr.includes(key)) {
            data.currency = value;
            break;
          }
        }
      }
    }
    
    // 日期
    else if (/(日期|时间)/i.test(trimmed)) {
      const match = trimmed.match(/(?:日期|时间)[：:：]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      if (match) {
        try {
          const dateStr = match[1].replace(/\//g, '-');
          const parts = dateStr.split('-');
          data.expense_date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } catch (e) {
          console.error('日期解析失败:', e);
        }
      }
    }
    
    // 分类
    else if (/分类/i.test(trimmed)) {
      const match = trimmed.match(/分类[：:：]\s*(.+)/i);
      if (match) data.category = match[1].trim();
    }
    
    // 支付方式
    else if (/支付/i.test(trimmed)) {
      const match = trimmed.match(/支付[：:：]\s*(.+)/i);
      if (match) data.payment_method = match[1].trim();
    }
  }
  
  return data;
}

// ============= 创建开销记录函数 =============

async function createExpense(base44, data, chatId, messageId, receiptUrl) {
  try {
    const quantity = data.quantity || 1; // Default quantity to 1 if not provided
    
    // 获取汇率并转换为USDT
    let exchangeRate = 1.0;
    let usdtAmount = data.amount; // data.amount is assumed to be the total amount
    
    if (data.currency) {
      try {
        const rateResponse = await base44.asServiceRole.functions.invoke('getExpenseExchangeRate', {
          currency: data.currency
        });
        
        if (rateResponse.data && rateResponse.data.rate) {
          exchangeRate = rateResponse.data.rate;
          const baseUsdt = data.amount * exchangeRate; // Calculate based on total amount
          usdtAmount = baseUsdt * 1.01; // 加1%
        }
      } catch (error) {
        console.error('获取汇率失败，使用默认值:', error);
      }
    }
    
    const expense = {
      title: data.title || '未知消费',
      quantity: quantity, // Add quantity to the expense object
      amount: data.amount,
      currency: data.currency || 'USD美元',
      exchange_rate: exchangeRate,
      usdt_amount: usdtAmount,
      category: data.category || '其他',
      expense_date: data.expense_date || new Date().toISOString().split('T')[0],
      payment_method: data.payment_method || '其他',
      description: data.description || `来自Telegram群组\nChat ID: ${chatId}\nMessage ID: ${messageId}${receiptUrl ? `\n小票: ${receiptUrl}` : ''}`,
      source: 'telegram',
      telegram_chat_id: String(chatId),
      telegram_message_id: String(messageId),
      receipt_url: receiptUrl || ''
    };
    
    return await base44.asServiceRole.entities.Expense.create(expense);
  } catch (error) {
    console.error('创建开销记录失败:', error);
    throw error;
  }
}

// ============= 主处理函数 =============

Deno.serve(async (req) => {
  console.log('\n=== 新的Telegram开销消息 ===');
  
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
    
    // 收集图片
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
    
    // 检测是否是消费信息
    const keywords = ['消费', '花费', '支付', '购买', '金额', '价格', '总计', '实付'];
    const hasKeywords = keywords.some(k => messageText.toLowerCase().includes(k.toLowerCase()));
    
    if (photos.length === 0 && !hasKeywords) {
      console.log('⚠️ 不是消费信息');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    console.log('✅ 检测到消费信息');
    await sendTelegramMessage(chatId, '🔄 正在处理消费记录...\n分析小票和计算金额...', messageId);
    
    // 解析文本
    const textData = parseExpenseText(messageText);
    console.log('📝 文本数据:', textData);
    
    // 处理图片
    let receiptUrl = '';
    let imageData = null;
    
    if (photos.length > 0) {
      try {
        const photoId = photos[0];
        const imageBlob = await downloadTelegramFile(photoId);
        
        // 分析小票
        console.log('💳 分析消费小票...');
        const analysis = await analyzeExpenseReceipt(base44, imageBlob);
        if (analysis) {
          receiptUrl = analysis.imageUrl;
          imageData = analysis.data;
        }
      } catch (error) {
        console.error('❌ 图片处理失败:', error);
      }
    }
    
    // 合并数据（优先使用图片识别的数据）
    const mergedData = {
      ...textData,
      ...(imageData || {})
    };
    
    console.log('📊 合并后数据:', mergedData);
    
    // 验证必要字段
    if (!mergedData.amount || !mergedData.title) {
      await sendTelegramMessage(
        chatId,
        '❌ <b>信息不完整</b>\n\n缺少必要信息（金额或标题）\n\n请确保：\n1. 小票图片清晰\n2. 或在文本中提供金额和商家信息',
        messageId
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    // 创建开销记录
    try {
      const expense = await createExpense(base44, mergedData, chatId, messageId, receiptUrl);
      
      // 生成成功消息
      let successMsg = `✅ <b>消费记录成功</b>\n\n`;
      successMsg += `━━━━━━━━━━━━━━━━━━\n`;
      successMsg += `📋 <b>消费信息</b>\n`;
      successMsg += `━━━━━━━━━━━━━━━━━━\n\n`;
      
      successMsg += `🏪 商家/标题: ${expense.title}\n`;
      if (expense.quantity > 1) {
        successMsg += `🔢 数量: ${expense.quantity}\n`;
      }
      successMsg += `💰 原始金额: ${expense.amount.toLocaleString()} ${expense.currency?.substring(0, 3)}`;
      if (expense.quantity > 1) {
        successMsg += ` (单价 × ${expense.quantity})`;
      }
      successMsg += `\n💵 汇率: ${expense.exchange_rate.toFixed(4)}\n`;
      successMsg += `💎 USDT金额: ${expense.usdt_amount.toFixed(2)} USDT\n\n`;
      
      if (expense.category && expense.category !== '其他') {
        successMsg += `📁 分类: ${expense.category}\n`;
      }
      if (expense.payment_method && expense.payment_method !== '其他') {
        successMsg += `💳 支付方式: ${expense.payment_method}\n`;
      }
      successMsg += `📅 消费日期: ${expense.expense_date}\n`;
      
      if (receiptUrl) {
        successMsg += `✓ 小票已保存\n`;
      }
      
      successMsg += `\n━━━━━━━━━━━━━━━━━━\n\n`;
      successMsg += `🆔 记录ID: <code>${expense.id}</code>\n`;
      successMsg += `⏰ ${new Date().toLocaleString('zh-CN')}\n\n`;
      successMsg += `✨ 已保存到系统`;
      
      await sendTelegramMessage(chatId, successMsg, messageId);
      console.log('✅ 处理完成');
      
    } catch (error) {
      console.error('❌ 创建开销记录失败:', error);
      await sendTelegramMessage(
        chatId,
        `❌ <b>记录失败</b>\n\n${error.message}\n\n请联系管理员`,
        messageId
      );
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
    
  } catch (error) {
    console.error('❌ 处理失败:', error);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});