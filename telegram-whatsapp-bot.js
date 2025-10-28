// telegram-whatsapp-bot.js
const TelegramBot = require("node-telegram-bot-api");
const qrcode = require("qrcode-terminal");
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");

// === CONFIG ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8111876690:AAETmnCuSI71NXKiCI2VpgtoQiTq5sVliDw";
const PORT = process.env.PORT || 3000;

// === INIT EXPRESS ===
const app = express();
app.get("/", (req, res) => res.send("🚀 Telegram-WhatsApp Bot is Running!"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// === INIT TELEGRAM BOT ===
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// === STATE ===
let clients = {}; // { chatId: WhatsAppClient }
let linkedAccounts = {}; // { chatId: { phone: sessionName } }
let isMessagingActive = false;

// === MENU BUTTONS ===
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "➕ Add Account", callback_data: "add_account" },
        { text: "🔗 Linked Accounts", callback_data: "list_accounts" }
      ],
      [
        { text: "▶️ Start Messaging", callback_data: "start_messaging" },
        { text: "⏹ Stop Messaging", callback_data: "stop_messaging" }
      ],
      [
        { text: "⏰ Schedule Message", callback_data: "schedule_message" },
        { text: "⚙️ Set Delay", callback_data: "set_delay" }
      ]
    ]
  }
};

// === HELPERS ===
function sendPoliteMessage(chatId, message) {
  bot.sendMessage(chatId, `🤖 ${message}`);
}

function initWhatsAppClient(chatId, clientId) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  clients[chatId] = client;

  client.on("qr", (qr) => {
    console.log("QR RECEIVED");
    qrcode.generate(qr, { small: true });
    sendPoliteMessage(chatId, "Scan the QR code shown in your terminal ✅");
  });

  client.on("ready", () => {
    console.log(`✅ WhatsApp client ready for ${chatId}`);
    linkedAccounts[chatId] = linkedAccounts[chatId] || {};
    linkedAccounts[chatId][clientId] = "session_active";
    sendPoliteMessage(chatId, "WhatsApp account linked successfully! 🎉");
  });

  client.on("disconnected", () => {
    sendPoliteMessage(chatId, "⚠️ WhatsApp disconnected. Restarting...");
    client.initialize();
  });

  client.initialize();
}

// === TELEGRAM BOT COMMANDS ===
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendPoliteMessage(chatId, "Welcome! Choose an option below:");
  bot.sendMessage(chatId, "Main Menu:", mainMenu);
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "add_account") {
    const addMenu = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📱 Login via QR", callback_data: "qr_code" },
            { text: "🔑 Pair via Code", callback_data: "pairing_code" }
          ],
          [{ text: "⬅️ Back", callback_data: "back_main" }]
        ]
      }
    };
    bot.sendMessage(chatId, "Choose a login method:", addMenu);
  } 
  else if (data === "qr_code") {
    sendPoliteMessage(chatId, "Generating QR... please wait ⏳");
    initWhatsAppClient(chatId, `qr_${chatId}`);
  } 
  else if (data === "pairing_code") {
    sendPoliteMessage(chatId, "Pairing via code is currently unavailable on this deployment. Use QR login instead.");
  } 
  else if (data === "list_accounts") {
    const accounts = linkedAccounts[chatId];
    if (!accounts || Object.keys(accounts).length === 0) {
      sendPoliteMessage(chatId, "No WhatsApp accounts linked yet ❌");
    } else {
      const list = Object.keys(accounts).map((acc, i) => `${i + 1}. ${acc}`).join("\n");
      sendPoliteMessage(chatId, `📋 Linked Accounts:\n${list}`);
    }
  } 
  else if (data === "start_messaging") {
    if (Object.keys(clients).length === 0) {
      sendPoliteMessage(chatId, "No linked accounts. Add one first using ➕ Add Account.");
      return;
    }
    isMessagingActive = true;
    sendPoliteMessage(chatId, "✅ Messaging started between linked accounts.");
  } 
  else if (data === "stop_messaging") {
    isMessagingActive = false;
    sendPoliteMessage(chatId, "🛑 Messaging stopped.");
  } 
  else if (data === "schedule_message") {
    sendPoliteMessage(chatId, "⏰ Scheduling feature coming soon!");
  } 
  else if (data === "set_delay") {
    sendPoliteMessage(chatId, "⌛ Delay setting coming soon!");
  } 
  else if (data === "back_main") {
    bot.sendMessage(chatId, "Main Menu:", mainMenu);
  }
});

// === TELEGRAM MESSAGE HANDLER ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (isMessagingActive && clients[chatId]) {
    const client = clients[chatId];
    sendPoliteMessage(chatId, `📨 Message sent via WhatsApp: "${text}"`);
    // Future: route messages between linked accounts here
  }
});
