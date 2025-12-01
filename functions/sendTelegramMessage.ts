import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export async function sendTelegramMessage(req) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const base44 = createClientFromRequest(req);
        const { chat_id, text, reply_to_message_id, bot_type = 'settlement' } = await req.json();

        if (!chat_id || !text) {
            return new Response('Missing chat_id or text', { status: 400 });
        }

        // Determine which bot token to use
        const tokenEnvVar = bot_type === 'expense' ? 'EXPENSE_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN';
        const botToken = Deno.env.get(tokenEnvVar);

        if (!botToken) {
            return new Response(`Bot token not configured: ${tokenEnvVar}`, { status: 500 });
        }

        // Send to Telegram
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = {
            chat_id,
            text,
            parse_mode: 'HTML'
        };

        if (reply_to_message_id) {
            payload.reply_to_message_id = reply_to_message_id;
        }

        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!result.ok) {
            throw new Error(`Telegram API Error: ${result.description}`);
        }

        // Save outgoing message to database
        const user = await base44.auth.me();
        await base44.asServiceRole.entities.TelegramMessage.create({
            chat_id: String(chat_id),
            message_id: String(result.result.message_id),
            sender_name: user ? user.full_name : 'System Admin',
            content: text,
            direction: 'outgoing',
            file_type: 'text',
            status: 'read',
            tags: ['manual_reply'],
            category: 'other'
        });

        return new Response(JSON.stringify({ success: true, result: result.result }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Send Message Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

Deno.serve(sendTelegramMessage);