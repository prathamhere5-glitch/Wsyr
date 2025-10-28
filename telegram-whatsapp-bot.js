const { Client, LocalAuth } = require("whatsapp-web.js");
const TelegramBot = require("node-telegram-bot-api");
const QRCode = require("qrcode");
const express = require("express");
const fs = require("fs");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8111876690:AAETmnCuSI71NXKiCI2VpgtoQiTq5sVliDw";
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let linkedAccounts = [];
let isMessagingActive = false;
let globalDelay = 2000;

// Telegram start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "➕ Add Account (QR)", callback_data: "add_qr" },
          { text: "🔢 Add Account (Pair Code)", callback_data: "add_pair" },
        ],
        [
          { text: "📜 List Accounts", callback_data: "list_accounts" },
          { text: "🚀 Start Messaging", callback_data: "start_messaging" },
        ],
        [
          { text: "⏸ Stop Messaging", callback_data: "stop_messaging" },
          { text: "⏰ Schedule Message", callback_data: "schedule_msg" },
        ],
      ],
    },
  };
  bot.sendMessage(chatId, "🤖 WhatsApp Bot Controller", buttons);
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "add_qr") {
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: `session_${Date.now()}` }),
    });

    client.on("qr", async (qr) => {
      const qrImg = await QRCode.toBuffer(qr);
      bot.sendPhoto(chatId, qrImg, { caption: "📱 Scan this QR to link your WhatsApp account." });
    });

    client.on("ready", () => {
      linkedAccounts.push(client);
      bot.sendMessage(chatId, `✅ Account linked successfully! Total linked: ${linkedAccounts.length}`);
    });

    client.initialize();
  }

  else if (data === "add_pair") {
    const client = new Client({ authStrategy: new LocalAuth({ clientId: `pair_${Date.now()}` }) });
    client.initialize();

    client.once("ready", () => {
      linkedAccounts.push(client);
      bot.sendMessage(chatId, "✅ Pairing complete!");
    });

    client.requestPairingCode("YOUR_PHONE_NUMBER").then((code) => {
      bot.sendMessage(chatId, `📟 Pairing Code: \`${code}\``, { parse_mode: "Markdown" });
    });
  }

  else if (data === "list_accounts") {
    const count = linkedAccounts.length;
    bot.sendMessage(chatId, `🔗 Linked Accounts: ${count}`);
  }

  else if (data === "start_messaging") {
    if (linkedAccounts.length < 2) {
      bot.sendMessage(chatId, "⚠️ Link at least two WhatsApp accounts first.");
      return;
    }
    isMessagingActive = true;
    bot.sendMessage(chatId, "🚀 Messaging started!");
  }

  else if (data === "stop_messaging") {
    isMessagingActive = false;
    bot.sendMessage(chatId, "⏸ Messaging stopped.");
  }

  else if (data === "schedule_msg") {
    bot.sendMessage(chatId, "⏰ Send format: /schedule <seconds> <message>");
  }
});

bot.onText(/\/schedule (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const [delay, ...rest] = match[1].split(" ");
  const message = rest.join(" ");
  if (!isMessagingActive || linkedAccounts.length < 2) {
    bot.sendMessage(chatId, "⚠️ Cannot schedule yet. Link at least two accounts and start messaging.");
    return;
  }

  bot.sendMessage(chatId, `🕐 Message scheduled in ${delay}s: "${message}"`);
  setTimeout(() => {
    linkedAccounts.forEach((client) => {
      const chat = client.getChats().then((chats) => {
        if (chats.length > 0) client.sendMessage(chats[0].id._serialized, message);
      });
    });
  }, delay * 1000);
});
