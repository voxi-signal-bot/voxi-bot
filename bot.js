const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Настройки бота
const TOKEN = '7658852315:AAF_Fq5SyHWZcrVKNTXs6iaexQCg1DNgnGQ'; // Ваш токен бота
const MINI_APP_URL = 'https://your-mini-app-domain.com'; // URL вашего Mini App (замените после деплоя Mini App)
const REFERRAL_BASE_LINK = 'https://1wgxql.com/v3/aggressive-casino?p=qmgo'; // Ваша реферальная ссылка 1win
const POSTBACK_SECRET = 'YOUR_1WIN_SECRET'; // Секретный ключ для подписи постбэков (если предоставлен 1win, иначе оставьте пустым)

const bot = new TelegramBot(TOKEN, { polling: false });
const app = express();
const db = new sqlite3.Database('users.db'); // Используем SQLite с файлом для постоянного хранения

// Настройка базы данных
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    language TEXT,
    registered INTEGER DEFAULT 0,
    deposited INTEGER DEFAULT 0
  )`);
});

// Middleware для обработки JSON и URL-encoded данных
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Webhook для Telegram
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Обработка постбэков от 1win
app.get('/postback', (req, res) => {
  console.log('Received postback:', req.query); // Логи для отладки

  const { event_id, sub1: user_id, amount, signature } = req.query;

  if (!user_id) {
    console.error('Missing user_id in postback');
    return res.status(400).send('Missing user_id');
  }

  // Проверка подписи (если 1win предоставляет подпись)
  if (POSTBACK_SECRET && signature) {
    if (!verifySignature(req.query, POSTBACK_SECRET)) {
      console.error('Invalid signature in postback');
      return res.status(403).send('Invalid signature');
    }
  }

  if (event_id === 'registration') {
    db.run(`UPDATE users SET registered = 1 WHERE user_id = ?`, [user_id], (err) => {
      if (err) console.error('DB error on registration:', err);
    });
    bot.sendMessage(user_id, `✅ Вы успешно зарегистрировались! ✅\nТеперь вам нужно пополнить баланс на аккаунт.\n🔸 Пополните на 10$ (1000руб)\nПосле пополнения бот автоматически выдаст доступ к сигналам!`).catch(err => {
      console.error('Error sending registration message:', err);
    });
  } else if (event_id === 'deposit') {
    const depositAmount = parseFloat(amount);
    if (depositAmount >= 10) { // Проверка на минимальную сумму депозита (10$)
      db.run(`UPDATE users SET deposited = 1 WHERE user_id = ?`, [user_id], (err) => {
        if (err) console.error('DB error on deposit:', err);
      });
      bot.sendMessage(user_id, `Добро пожаловать в VOXI SIGNAL!\nСпасибо за пополнение, теперь прочитайте инструкцию и выбирайте игру в которой хотите получать Сигналы`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ВЫБОР ИГРЫ', callback_data: 'select_game' }],
            [{ text: 'ИНСТРУКЦИЯ', callback_data: 'instruction' }]
          ]
        }
      }).catch(err => {
        console.error('Error sending deposit message:', err);
      });
    } else {
      bot.sendMessage(user_id, `❌ Сумма пополнения недостаточна!\nПожалуйста, пополните баланс на 10$ (1000руб) или больше.`).catch(err => {
        console.error('Error sending insufficient deposit message:', err);
      });
    }
  }
  res.sendStatus(200);
});

// Функция для проверки подписи постбэка
function verifySignature(query, secret) {
  const receivedSignature = query.signature;
  const data = Object.keys(query)
    .filter(k => k !== 'signature')
    .sort()
    .map(k => `${k}=${query[k]}`)
    .join('&');
  const computedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return receivedSignature === computedSignature;
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Проверяем, есть ли пользователь в базе
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
    if (err) {
      console.error('DB error on user check:', err);
      return;
    }
    if (!row) {
      db.run(`INSERT INTO users (user_id) VALUES (?)`, [chatId], (err) => {
        if (err) console.error('DB error on user insert:', err);
      });
      bot.sendMessage(chatId, 'Выберите язык:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Русский', callback_data: 'lang_ru' }],
            [{ text: 'Português', callback_data: 'lang_pt' }]
          ]
        }
      }).catch(err => {
        console.error('Error sending language selection message:', err);
      });
    } else {
      sendWelcomeMessage(chatId, row.language);
    }
  });
});

// Обработка callback-запросов
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('lang_')) {
    const lang = data === 'lang_ru' ? 'ru' : 'pt';
    db.run(`UPDATE users SET language = ? WHERE user_id = ?`, [lang, chatId], (err) => {
      if (err) console.error('DB error on language update:', err);
    });
    sendWelcomeMessage(chatId, lang);
  } else if (data === 'get_signal') {
    db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
      if (err) {
        console.error('DB error on signal check:', err);
        return;
      }
      if (!row.registered) {
        const referralLink = `${REFERRAL_BASE_LINK}&sub1=${chatId}`; // Добавляем Telegram ID в sub1
        bot.sendMessage(chatId, `Создай учетную запись.\n✦ Для работы с нашим ботом необходимо зарегистрировать НОВЫЙ аккаунт.\n✦ По завершении регистрации, Вам автоматически придет уведомление в бота.\n✦ После чего Вы получите полный доступ к сигналам!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'РЕГИСТРАЦИЯ', url: referralLink }]
            ]
          }
        }).catch(err => {
          console.error('Error sending registration prompt:', err);
        });
      } else if (!row.deposited) {
        bot.sendMessage(chatId, `✅ Вы успешно зарегистрировались! ✅\nТеперь вам нужно пополнить баланс на аккаунт.\n🔸 Пополните на 10$ (1000руб)\nПосле пополнения бот автоматически выдаст доступ к сигналам!`).catch(err => {
          console.error('Error sending deposit prompt:', err);
        });
      } else {
        bot.sendMessage(chatId, `Добро пожаловать в VOXI SIGNAL!\nСпасибо за пополнение, теперь прочитайте инструкцию и выбирайте игру в которой хотите получать Сигналы`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'ВЫБОР ИГРЫ', callback_data: 'select_game' }],
              [{ text: 'ИНСТРУКЦИЯ', callback_data: 'instruction' }]
            ]
          }
        }).catch(err => {
          console.error('Error sending game selection prompt:', err);
        });
      }
    });
  } else if (data === 'select_game') {
    bot.sendMessage(chatId, 'Выберите игру:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'AVIATOR', callback_data: 'game_aviator' }],
          [{ text: 'LUCKY JET', callback_data: 'game_luckyjet' }],
          [{ text: 'MINES', callback_data: 'game_mines' }]
        ]
      }
    }).catch(err => {
      console.error('Error sending game selection message:', err);
    });
  } else if (data === 'game_luckyjet') {
    bot.sendMessage(chatId, `Добро пожаловать в VOXI SIGNAL LUCKY JET\nLUCKY JET - это игра, в которой вы должны сделать ставку на увеличивающийся коэффициент перед тем, как ракетка улетит.\nЧем дольше вы ждете, тем больше можете выиграть, но если ракетка улетит до того, как вы заберете ставку, вы потеряете.\nНаш бот может помочь определить оптимальный момент для ставки!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ПОЛУЧИТЬ СИГНАЛ', url: MINI_APP_URL }]
        ]
      }
    }).catch(err => {
      console.error('Error sending Lucky Jet message:', err);
    });
  } else if (data === 'instruction') {
    bot.sendMessage(chatId, 'Инструкция: [Вставьте текст инструкции]').catch(err => {
      console.error('Error sending instruction message:', err);
    });
  }
});

// Приветственное сообщение
function sendWelcomeMessage(chatId, lang) {
  const message = lang === 'ru' ?
    'Добро пожаловать в VOXI SIGNAL! НАШ БОТ 🤖 с помощью нейросети взламывает игры букмекерской конторы 1win. Он может предугадывать с вероятностью 89%.' :
    'Bem-vindo ao VOXI SIGNAL! NOSSO BOT 🤖 usa uma rede neural para hackear jogos da casa de apostas 1win. Ele pode prever com 89% de probabilidade.';
  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'ru' ? '✅ПОЛУЧИТЬ СИГНАЛ✅' : '✅OBTER SINAL✅', callback_data: 'get_signal' }]
      ]
    }
  }).catch(err => {
    console.error('Error sending welcome message:', err);
  });
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Настройте webhook после деплоя
  bot.setWebHook('https://your-server.com/webhook').then(() => {
    console.log('Webhook set successfully');
  }).catch(err => {
    console.error('Error setting webhook:', err);
  });
});