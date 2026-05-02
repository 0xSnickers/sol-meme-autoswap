import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(os.homedir(), '.env'), override: false });
dotenv.config({ override: false });

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = process.env.TG_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function maskChatId(value) {
  const text = String(value);
  if (text.length <= 4) {
    return text;
  }
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

async function getRecentChats() {
  const json = await fetchJson(
    `https://api.telegram.org/bot${token}/getUpdates`
  );

  if (!json.ok) {
    throw new Error(json.description || 'getUpdates failed');
  }

  const chats = new Map();
  for (const item of json.result || []) {
    const message = item.message || item.edited_message || null;
    if (!message?.chat?.id) {
      continue;
    }

    const id = String(message.chat.id);
    if (chats.has(id)) {
      continue;
    }

    chats.set(id, {
      id,
      type: message.chat.type || 'unknown',
      title:
        message.chat.title ||
        [message.chat.first_name, message.chat.last_name]
          .filter(Boolean)
          .join(' ') ||
        message.chat.username ||
        'unknown',
    });
  }

  return [...chats.values()];
}

async function sendTestMessage() {
  const payload = {
    chat_id: chatId,
    text:
      'GMGN Trading Radar Telegram 测试消息\n\n如果你收到这条消息，说明 Bot Token 和 Chat ID 配置都已生效。',
  };

  const json = await fetchJson(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!json.ok) {
    throw new Error(json.description || 'sendMessage failed');
  }

  console.log(`测试消息已发送到 chat_id=${maskChatId(chatId)}`);
}

async function main() {
  if (!token) {
    console.error('缺少 TELEGRAM_BOT_TOKEN，请先在 .env 中配置。');
    process.exit(1);
  }

  if (!chatId) {
    console.log('未配置 TG_CHAT_ID 或 TELEGRAM_CHAT_ID。');
    console.log('正在尝试通过 Telegram getUpdates 发现最近会话...\n');

    const chats = await getRecentChats();
    if (chats.length === 0) {
      console.log('没有发现任何会话。');
      console.log('请先在 Telegram 中打开你的 Bot，发送一条消息或 /start，然后重新运行本命令。');
      process.exit(1);
    }

    console.log('发现以下最近会话，请选择一个 chat_id 写入 .env:');
    for (const chat of chats) {
      console.log(`- ${chat.id} | ${chat.type} | ${chat.title}`);
    }
    console.log('\n示例:');
    console.log('TG_CHAT_ID=上面输出的chat_id');
    process.exit(0);
  }

  await sendTestMessage();
}

main().catch((error) => {
  console.error(`Telegram 测试失败: ${error.message}`);
  process.exit(1);
});
