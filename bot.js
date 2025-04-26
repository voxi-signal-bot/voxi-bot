const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Настройки бота
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'; // Вставьте ваш токен бота
const CHANNEL_ID = '@YourChannel'; // ID вашего Telegram-канала
const MINI_APP_URL = 'https://your-mini-app-url'; // URL вашего Mini App
const APP_URL = 'https://your-railway-app-url'; // URL приложения на Railway
const POSTBACK_SECRET = 'your_1win_secret'; // Секретный ключ для постбэков
const REFERRAL_BASE_LINK = 'https://1wgxql.com/v3/aggressive-casino?p=qmgo&promocode=VIP662';

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const db = new sqlite3.Database('users.db');

// Настройка базы данных
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    language TEXT,
    subscribed INTEGER DEFAULT 0,
    registered INTEGER DEFAULT 0,
    deposited INTEGER DEFAULT 0
  )`);
});

// Middleware для обработки JSON и URL-encoded данных
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/miniapp', express.static('miniapp')); // Обслуживание Mini App

// Webhook для Telegram
app.post('/webhook', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.sendStatus(500);
  }
});

// Обработка постбэков от 1win
app.get('/postback', (req, res) => {
  console.log('Received postback:', req.query);
  const { event_id, sub1: user_id, amount, signature } = req.query;

  if (!user_id) {
    console.error('Missing user_id in postback');
    return res.status(400).send('Missing user_id');
  }

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
    const message = getMessage('registration_success', getUserLanguage(user_id));
    bot.telegram.sendMessage(user_id, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: getMessage('deposit_button', getUserLanguage(user_id)), url: `${REFERRAL_BASE_LINK}&sub1=${user_id}` }]
        ]
      }
    }).catch(err => console.error('Error sending registration message:', err));
  } else if (event_id === 'deposit') {
    const depositAmount = parseFloat(amount);
    if (depositAmount >= 10) {
      db.run(`UPDATE users SET deposited = 1 WHERE user_id = ?`, [user_id], (err) => {
        if (err) console.error('DB error on deposit:', err);
      });
      const message = getMessage('select_game', getUserLanguage(user_id));
      bot.telegram.sendMessage(user_id, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: getMessage('aviator_button', getUserLanguage(user_id)), callback_data: 'game_aviator' }],
            [{ text: getMessage('luckyjet_button', getUserLanguage(user_id)), callback_data: 'game_luckyjet' }],
            [{ text: getMessage('mines_button', getUserLanguage(user_id)), callback_data: 'game_mines' }]
          ]
        }
      }).catch(err => console.error('Error sending deposit message:', err));
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

// Получение языка пользователя
function getUserLanguage(user_id) {
  let language = 'ru';
  db.get(`SELECT language FROM users WHERE user_id = ?`, [user_id], (err, row) => {
    if (err) console.error('DB error on language fetch:', err);
    if (row) language = row.language;
  });
  return language;
}

// Сообщения на разных языках
const messages = {
  ru: {
    welcome: 'Добро пожаловать, Voxy_Soft! Для использования бота - подпишись на наш канал 🤝',
    subscribe_button: 'Подписка на канал',
    check_subscription: 'Проверить',
    main_menu: 'Главное меню:',
    registration_button: 'Регистрация',
    instruction_button: 'Инструкция',
    select_language_button: 'Выбрать язык',
    help_button: 'Help',
    get_signal_button: 'Получить сигнал',
    registration_error: '⚠️ Ошибка: Регистрация не пройдена! ✦ При регистрации обязательно вводите промокод - VIP662 ● После завершения регистрации, Вам автоматически придет уведомление в бота.',
    register_button: 'Зарегистрироваться',
    back_to_menu: 'Вернуться в главное меню',
    instruction: `🤖 Бот основан и обучен на кластерной нейронной сети OpenAI!
⚜️ Для обучения бота было сыграно 🎰 30,000 игр.
В настоящее время пользователи бота успешно генерируют 15-25% от своего 💸 капитала ежедневно!
Бот все еще проходит проверки и исправления! Точность бота составляет 92%!
Чтобы достичь максимальной прибыли, следуйте этой инструкции:
🟢 1. Зарегистрируйтесь в букмекерской конторе [1WIN](${REFERRAL_BASE_LINK}&sub1={user_id})
[Если не открывается, воспользуйтесь VPN (Швеция). В Play Market/App Store есть много бесплатных сервисов, например: Vpnify, Planet VPN, Hotspot VPN и т.д.!]
❗️ Без регистрации и промокода доступ к сигналам не будет открыт ❗️
🟢 2. Пополните баланс своего счета.
🟢 3. Перейдите в раздел игр 1win и выберите игру.
🟢 4. Установите количество ловушек на три. Это важно!
🟢 5. Запросите сигнал у бота и ставьте ставки в соответствии с сигналами от бота.
🟢 6. В случае неудачного сигнала рекомендуем удвоить (x²) вашу ставку, чтобы полностью покрыть убыток с помощью следующего сигнала.`,
    registration_success: 'Поздравляем с успешной регистрацией! 🥳\n🌐 Шаг 2 - Внеси первый депозит.\n✦ Чем больше депозит, тем больше УРОВЕНЬ в боте, а чем больше уровень в боте, тем большее количество сигналов с высокой вероятностью проходимости ты будешь получать.\n● После пополнения первого депозита, Вам автоматически придет уведомление в бота.',
    deposit_button: 'Внести депозит',
    select_game: 'Выберите игру:',
    aviator_button: 'AVIATOR',
    luckyjet_button: 'LUCKY JET',
    mines_button: 'MINES',
    luckyjet_welcome: `Добро пожаловать в VOXI SIGNAL LUCKY JET
LUCKY JET - это игра, в которой вы должны сделать ставку на увеличивающийся коэффициент перед тем, как ракетка улетит.
Чем дольше вы ждете, тем больше можете выиграть, но если ракетка улетит до того, как вы заберете ставку, вы потеряете.
Наш бот может помочь определить оптимальный момент для ставки!`,
    get_signal: 'ПОЛУЧИТЬ СИГНАЛ'
  },
  en: {
    welcome: 'Welcome, Voxy_Soft! To use the bot, subscribe to our channel 🤝',
    subscribe_button: 'Subscribe to channel',
    check_subscription: 'Check',
    main_menu: 'Main menu:',
    registration_button: 'Registration',
    instruction_button: 'Instruction',
    select_language_button: 'Select language',
    help_button: 'Help',
    get_signal_button: 'Get signal',
    registration_error: '⚠️ Error: Registration not completed! ✦ Be sure to enter the promo code - VIP662 ● You will receive a notification in the bot after registration.',
    register_button: 'Register',
    back_to_menu: 'Back to main menu',
    instruction: `🤖 The bot is built and trained on OpenAI's cluster neural network!
⚜️ 30,000 games 🎰 were played to train the bot.
Currently, bot users successfully generate 15-25% of their 💸 capital daily!
The bot is still undergoing checks and fixes! The bot's accuracy is 92%!
To achieve maximum profit, follow this instruction:
🟢 1. Register at the [1WIN](${REFERRAL_BASE_LINK}&sub1={user_id}) bookmaker
[If it doesn't open, use a VPN (Sweden). There are many free services in Play Market/App Store, e.g., Vpnify, Planet VPN, Hotspot VPN, etc.!]
❗️ Without registration and promo code, access to signals will not be granted ❗️
🟢 2. Fund your account balance.
🟢 3. Go to the 1win games section and select a game.
🟢 4. Set the number of traps to three. This is important!
🟢 5. Request a signal from the bot and place bets according to the bot's signals.
🟢 6. In case of an unsuccessful signal, we recommend doubling (x²) your bet to fully cover the loss with the next signal.`,
    registration_success: 'Congratulations on successful registration! 🥳\n🌐 Step 2 - Make your first deposit.\n✦ The larger the deposit, the higher the LEVEL in the bot, and the higher the level, the more high-probability signals you will receive.\n● You will receive a notification in the bot after the first deposit.',
    deposit_button: 'Make deposit',
    select_game: 'Select game:',
    aviator_button: 'AVIATOR',
    luckyjet_button: 'LUCKY JET',
    mines_button: 'MINES',
    luckyjet_welcome: `Welcome to VOXI SIGNAL LUCKY JET
LUCKY JET is a game where you must bet on an increasing multiplier before the rocket flies away.
The longer you wait, the more you can win, but if the rocket flies away before you cash out, you lose.
Our bot can help determine the optimal moment to bet!`,
    get_signal: 'GET SIGNAL'
  },
  // Добавить переводы для hi, pt, es, uz, az, tr
};

// Функция для получения сообщения на нужном языке
function getMessage(key, lang, user_id = '') {
  let message = messages[lang]?.[key] || messages.ru[key];
  if (user_id) message = message.replace('{user_id}', user_id);
  return message;
}

// Проверка подписки
async function checkSubscription(ctx) {
  try {
    const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.chat.id);
    return ['member', 'administrator', 'creator'].includes(chatMember.status);
  } catch (err) {
    console.error('Error checking subscription:', err);
    return false;
  }
}

// Команда /start
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], (err, row) => {
    if (err) {
      console.error('DB error on user check:', err);
      return;
    }
    if (!row) {
      db.run(`INSERT INTO users (user_id) VALUES (?)`, [chatId], (err) => {
        if (err) console.error('DB error on user insert:', err);
      });
      ctx.reply('Выберите язык / Select language:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Русский 🇷🇺', callback_data: 'lang_ru' }, { text: 'English 🇬🇧', callback_data: 'lang_en' }],
            [{ text: 'हिन्दी 🇮🇳', callback_data: 'lang_hi' }, { text: 'Português 🇧🇷', callback_data: 'lang_pt' }],
            [{ text: 'Español 🇪🇸', callback_data: 'lang_es' }, { text: 'Oʻzbek 🇺🇿', callback_data: 'lang_uz' }],
            [{ text: 'Azərbaycan 🇦🇿', callback_data: 'lang_az' }, { text: 'Türkçe 🇹🇷', callback_data: 'lang_tr' }]
          ]
        }
      }).catch(err => console.error('Error sending language selection:', err));
    } else {
      sendWelcomeMessage(ctx, row.language);
    }
  });
});

// Обработка callback-запросов
bot.on('callback_query', async (ctx) => {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  if (data.startsWith('lang_')) {
    const lang = data.split('_')[1];
    db.run(`UPDATE users SET language = ? WHERE user_id = ?`, [lang, chatId], (err) => {
      if (err) console.error('DB error on language update:', err);
    });
    await sendWelcomeMessage(ctx, lang);
  } else if (data === 'check_subscription') {
    const isSubscribed = await checkSubscription(ctx);
    if (isSubscribed) {
      db.run(`UPDATE users SET subscribed = 1 WHERE user_id = ?`, [chatId], (err) => {
        if (err) console.error('DB error on subscription update:', err);
      });
      await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
      await sendMainMenu(ctx, getUserLanguage(chatId));
    } else {
      ctx.answerCbQuery('Пожалуйста, подпишитесь на канал!', true).catch(err => console.error('Error answering callback:', err));
    }
  } else if (data === 'main_menu') {
    await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
    await sendMainMenu(ctx, getUserLanguage(chatId));
  } else if (data === 'registration') {
    await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
    const lang = getUserLanguage(chatId);
    ctx.reply(getMessage('registration_error', lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: getMessage('register_button', lang), url: `${REFERRAL_BASE_LINK}&sub1=${chatId}` }],
          [{ text: getMessage('back_to_menu', lang), callback_data: 'main_menu' }]
        ]
      }
    }).catch(err => console.error('Error sending registration error:', err));
  } else if (data === 'instruction') {
    await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
    const lang = getUserLanguage(chatId);
    ctx.reply(getMessage('instruction', lang, chatId), {
      reply_markup: {
        inline_keyboard: [
          [{ text: getMessage('back_to_menu', lang), callback_data: 'main_menu' }]
        ]
      }
    }).catch(err => console.error('Error sending instruction:', err));
  } else if (data === 'select_language') {
    await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
    ctx.reply('Выберите язык / Select language:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Русский 🇷🇺', callback_data: 'lang_ru' }, { text: 'English 🇬🇧', callback_data: 'lang_en' }],
          [{ text: 'हिन्दी 🇮🇳', callback_data: 'lang_hi' }, { text: 'Português 🇧🇷', callback_data: 'lang_pt' }],
          [{ text: 'Español 🇪🇸', callback_data: 'lang_es' }, { text: 'Oʻzbek 🇺🇿', callback_data: 'lang_uz' }],
          [{ text: 'Azərbaycan 🇦🇿', callback_data: 'lang_az' }, { text: 'Türkçe 🇹🇷', callback_data: 'lang_tr' }]
        ]
      }
    }).catch(err => console.error('Error sending language selection:', err));
  } else if (data === 'help') {
    ctx.reply('Свяжитесь с поддержкой:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Support', url: 'https://t.me/Soft1win1' }]
        ]
      }
    }).catch(err => console.error('Error sending help:', err));
  } else if (data === 'get_signal') {
    db.get(`SELECT * FROM users WHERE user_id = ?`, [chatId], async (err, row) => {
      if (err) {
        console.error('DB error on signal check:', err);
        return;
      }
      const lang = getUserLanguage(chatId);
      if (!row.registered) {
        await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
        ctx.reply(getMessage('registration_error', lang), {
          reply_markup: {
            inline_keyboard: [
              [{ text: getMessage('register_button', lang), url: `${REFERRAL_BASE_LINK}&sub1=${chatId}` }],
              [{ text: getMessage('back_to_menu', lang), callback_data: 'main_menu' }]
            ]
          }
        }).catch(err => console.error('Error sending registration error:', err));
      } else if (!row.deposited) {
        await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
        ctx.reply(getMessage('registration_success', lang), {
          reply_markup: {
            inline_keyboard: [
              [{ text: getMessage('deposit_button', lang), url: `${REFERRAL_BASE_LINK}&sub1=${chatId}` }],
              [{ text: getMessage('back_to_menu', lang), callback_data: 'main_menu' }]
            ]
          }
        }).catch(err => console.error('Error sending deposit prompt:', err));
      } else {
        await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
        ctx.reply(getMessage('select_game', lang), {
          reply_markup: {
            inline_keyboard: [
              [{ text: getMessage('aviator_button', lang), callback_data: 'game_aviator' }],
              [{ text: getMessage('luckyjet_button', lang), callback_data: 'game_luckyjet' }],
              [{ text: getMessage('mines_button', lang), callback_data: 'game_mines' }]
            ]
          }
        }).catch(err => console.error('Error sending game selection:', err));
      }
    });
  } else if (data === 'game_luckyjet') {
    await ctx.deleteMessage().catch(err => console.error('Error deleting message:', err));
    const lang = getUserLanguage(chatId);
    ctx.reply(getMessage('luckyjet_welcome', lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: getMessage('get_signal', lang), url: MINI_APP_URL }]
        ]
      }
    }).catch(err => console.error('Error sending Lucky Jet message:', err));
  }
  ctx.answerCbQuery().catch(err => console.error('Error answering callback:', err));
});

// Приветственное сообщение
async function sendWelcomeMessage(ctx, lang) {
  const chatId = ctx.chat.id;
  db.get(`SELECT subscribed FROM users WHERE user_id = ?`, [chatId], async (err, row) => {
    if (err) {
      console.error('DB error on subscription check:', err);
      return;
    }
    if (row.subscribed) {
      await sendMainMenu(ctx, lang);
    } else {
      ctx.reply(getMessage('welcome', lang), {
        reply_markup: {
          inline_keyboard: [
            [{ text: getMessage('subscribe_button', lang), url: `https://t.me${CHANNEL_ID}` }],
            [{ text: getMessage('check_subscription', lang), callback_data: 'check_subscription' }]
          ]
        }
      }).catch(err => console.error('Error sending welcome message:', err));
    }
  });
}

// Главное меню
async function sendMainMenu(ctx, lang) {
  ctx.reply(getMessage('main_menu', lang), {
    reply_markup: {
      inline_keyboard: [
        [{ text: getMessage('registration_button', lang), callback_data: 'registration' }],
        [{ text: getMessage('instruction_button', lang), callback_data: 'instruction' }],
        [{ text: getMessage('select_language_button', lang), callback_data: 'select_language' }],
        [{ text: getMessage('help_button', lang), callback_data: 'help' }],
        [{ text: getMessage('get_signal_button', lang), callback_data: 'get_signal' }]
      ]
    }
  }).catch(err => console.error('Error sending main menu:', err));
}

// Запуск сервера
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await bot.telegram.setWebhook(`${APP_URL}/webhook`);
    console.log('Webhook set successfully');
  } catch (err) {
    console.error('Error setting webhook:', err);
  }
});