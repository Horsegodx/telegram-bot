require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

const WEB_APP_URL = 'https://telegram-mini-app-nu-jet.vercel.app';

console.log('🤖 Bot started');

/* =========================
   /start — приветствие + кнопка каталога
   ========================= */
bot.onText(/\/start/, (msg) => {
  const { id, username, first_name } = msg.from;

  // сохраняем пользователя
  try {
    db.prepare(`
      INSERT OR IGNORE INTO users (telegram_id, username, first_name)
      VALUES (?, ?, ?)
    `).run(id, username || null, first_name || null);
  } catch (err) {
    console.error('DB error:', err);
  }

  const message = `Добрый день 👋

Вы зашли в официальный каталог
коммерческих помещений
от Евгения Иванова 🏢

Нажмите кнопку ниже, чтобы открыть каталог ⬇️`;

  bot.sendMessage(id, message, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📂 Открыть каталог',
            web_app: {
              url: WEB_APP_URL
            }
          }
        ]
      ]
    }
  });
});

/* =========================
   /rep — рассылка с КНОПКОЙ НА ССЫЛКУ
   ========================= */
bot.onText(/\/rep([\s\S]+)/, async (msg, match) => {
  const adminId = Number(process.env.ADMIN_ID);

  if (msg.from.id !== adminId) {
    return bot.sendMessage(msg.chat.id, '⛔ У вас нет прав на рассылку');
  }

  const fullText = match[1].trim();

  if (!fullText) {
    return bot.sendMessage(msg.chat.id, '❗ Добавь текст рассылки');
  }

  // 🔍 ищем ссылку в тексте
  const urlMatch = fullText.match(/https?:\/\/\S+/);

  if (!urlMatch) {
    return bot.sendMessage(
      msg.chat.id,
      '⚠️ В тексте должна быть ссылка (она пойдёт в кнопку)'
    );
  }

  const url = urlMatch[0];

  // 🧹 убираем ссылку из текста сообщения
  const cleanText = fullText.replace(url, '').trim();

  const users = db.prepare(`
    SELECT telegram_id FROM users
  `).all();

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegram_id, cleanText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '👀 Посмотреть',
                url: url
              }
            ]
          ]
        }
      });
      success++;
    } catch (e) {
      failed++;
    }
  }

  bot.sendMessage(
    msg.chat.id,
    `📤 Рассылка завершена\n✅ Отправлено: ${success}\n❌ Ошибок: ${failed}`
  );
});
