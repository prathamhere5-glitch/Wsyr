const TelegramBot = require("node-telegram-bot-api");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();

// Your Telegram bot token
const TELEGRAM_TOKEN = "8111876690:AAETmnCuSI71NXKiCI2VpgtoQiTq5sVliDw";
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Global variables
let linkedAccounts = {};
let delays = {};
let drivers = {};
let clients = {};

// Predefined random messages
const randomMessages = [
  "Hello! How are you? 😊",
  "Just checking in! Hope you're well. 🌟",
  "Random thought: Life is beautiful! 💖",
  "Sending a virtual hug! 🤗"
];

// Helper: Send polite message
function sendPoliteMessage(chatId, text, options = {}) {
  bot.sendMessage(chatId, "🙋‍♂️ " + text, options);
}

// Helper: Get random message count
function getRandomMessageCount() {
  return Math.floor(Math.random() * 4) + 1;
}

// Helper: Send random messages
async function sendRandomMessages(chatId) {
  if (!linkedAccounts[chatId] ||
      Object.keys(linkedAccounts[chatId]).length < 2) {
    sendPoliteMessage(chatId,
      "Sorry, you need at least 2 linked accounts to send messages. 😔");
    return;
  }
  const accounts = Object.keys(linkedAccounts[chatId]);
  const sender = accounts[0];
  const receivers = accounts.slice(1);
  const messageCount = getRandomMessageCount();
  for (let i = 0; i < messageCount; i++) {
    const randomMsg = randomMessages[
      Math.floor(Math.random() * randomMessages.length)
    ];
    for (const receiver of receivers) {
      try {
        await clients[chatId].sendMessage(receiver + "@c.us", randomMsg);
      } catch (error) {
        console.error("Error sending: " + error);
      }
    }
  }
  sendPoliteMessage(chatId, "Sent " + messageCount + " random messages! 📤");
}

// Main menu: All buttons primary, grid layout
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🚀 Start", callback_data: "start" },
        { text: "⏱️ Delay", callback_data: "delay" }
      ],
      [
        { text: "📋 List Linked Accounts", callback_data: "list_accounts" },
        { text: "📊 Bot Status", callback_data: "bot_status" }
      ],
      [
        { text: "👨‍💻 Bot Developer", callback_data: "bot_developer" },
        { text: "🛑 Stop", callback_data: "stop" }
      ],
      [{ text: "➕ Add Accounts", callback_data: "add_accounts" }]
    ]
  }
};

// Add accounts submenu
const addMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "📱 QR Code", callback_data: "qr_code" },
        { text: "🔢 Pairing Code", callback_data: "pairing_code" }
      ],
      [{ text: "⬅️ Back", callback_data: "back" }]
    ]
  }
};

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendPoliteMessage(chatId, "Welcome! Choose an option.", mainMenu);
});

// Callback queries
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "start") {
    if (delays[chatId] && linkedAccounts[chatId] &&
        Object.keys(linkedAccounts[chatId]).length >= 2) {
      delays[chatId].active = true;
      setInterval(() => {
        if (delays[chatId]?.active) sendRandomMessages(chatId);
      }, delays[chatId].minutes * 60000);
      sendPoliteMessage(chatId, "Messaging started!");
    } else {
      sendPoliteMessage(chatId,
        "Set a delay and link at least 2 accounts first.");
    }
  } else if (data === "delay") {
    sendPoliteMessage(chatId, "Enter delay in minutes (1-60).");
    bot.once("message", (msg) => {
      const minutes = parseInt(msg.text);
      if (isNaN(minutes) || minutes < 1 || minutes > 60) {
        sendPoliteMessage(chatId, "Invalid input. Try again.");
        return;
      }
      delays[chatId] = { minutes, active: false };
      sendPoliteMessage(chatId,
        "Delay set to " + minutes + " minutes! Press Start to begin messaging.");
    });
  } else if (data === "list_accounts") {
    const accounts = linkedAccounts[chatId] || {};
    const list = Object.keys(accounts).map((phone) =>
      "📱 " + phone).join("\n");
    sendPoliteMessage(chatId, "Linked accounts:\n" + (list || "None."));
  } else if (data === "bot_status") {
    const status = delays[chatId]?.active ? "Active (Messaging)" : "Idle";
    sendPoliteMessage(chatId, "Status: " + status + ".");
  } else if (data === "bot_developer") {
    sendPoliteMessage(chatId, "Bot Developer: @indiawsagent");
  } else if (data === "stop") {
    delays[chatId] = { ...delays[chatId], active: false };
    if (drivers[chatId]) {
      await drivers[chatId].quit();
    }
    sendPoliteMessage(chatId, "Messaging stopped.");
  } else if (data === "add_accounts") {
    sendPoliteMessage(chatId, "How would you like to add an account?", addMenu);
  } else if (data === "qr_code") {
    try {
      const options = new chrome.Options();
      options.addArguments("--no-sandbox", "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", "--disable-gpu", "--headless");
      const driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();
      drivers[chatId] = driver;
      await driver.get("https://web.whatsapp.com");
      await driver.wait(until.elementLocated(By.css("canvas")), 30000);
      const qrData = await driver.executeScript(() => {
        const canvas = document.querySelector("canvas");
        return canvas ? canvas.toDataURL() : null;
      });
      if (qrData) {
        qrcode.generate(qrData.split(",")[1], { small: true });
        sendPoliteMessage(chatId,
          "Scan the QR code in your terminal. Reply 'done' when linked.");
        bot.once("message", async (msg) => {
          if (msg.text.toLowerCase() === "done") {
            linkedAccounts[chatId] = linkedAccounts[chatId] || {};
            linkedAccounts[chatId]["qr_account"] = "session";
            await driver.quit();
            sendPoliteMessage(chatId, "Account linked successfully!");
          }
        });
      } else {
        throw new Error("QR canvas not found");
      }
    } catch (error) {
      console.error("QR Error: " + error);
      sendPoliteMessage(chatId, "Error generating QR code. Please try again.");
    }
  } else if (data === "pairing_code") {
    sendPoliteMessage(chatId,
      "Enter your phone number with country code (e.g., +1234567890).");
    bot.once("message", async (msg) => {
      const phone = msg.text;
      try {
        const options = new chrome.Options();
        options.addArguments("--no-sandbox", "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", "--disable-gpu", "--headless");
        const driver = await new Builder()
          .forBrowser("chrome")
          .setChromeOptions(options)
          .build();
        drivers[chatId] = driver;
        await driver.get("https://web.whatsapp.com");
        await driver.wait(until.elementLocated(By.css("input[type='text']")), 30000);
        const inputElement = await driver.findElement(By.css("input[type='text']"));
        await inputElement.sendKeys(phone);
        const buttonElement = await driver.findElement(By.css("button"));
        await buttonElement.click();
        await driver.wait(until.elementLocated(By.css(".pairing-code")), 30000);
        const pairingCode = await driver.executeScript(() => {
          const el = document.querySelector(".pairing-code");
          return el ? el.innerText : null;
        });
        if (pairingCode) {
          sendPoliteMessage(chatId,
            "Pairing code: " + pairingCode +
            ". Enter it on your phone. Reply 'linked' when done.");
          bot.once("message", async (msg) => {
            if (msg.text.toLowerCase() === "linked") {
              linkedAccounts[chatId] = linkedAccounts[chatId] || {};
              linkedAccounts[chatId][phone] = "session";
              await driver.quit();
              sendPoliteMessage(chatId, "Account linked successfully!");
            }
          });
        } else {
          throw new Error("Pairing code not found");
        }
      } catch (error) {
        console.error("Pairing Error: " + error);
        sendPoliteMessage(chatId, "Error with pairing code. Please try again.");
      }
    });
  } else if (data === "back") {
    sendPoliteMessage(chatId, "Back to main menu.", mainMenu);
  }
});

// WhatsApp client init (placeholder)
function initWhatsAppClient(chatId, phone) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: chatId + "_" + phone })
  });
  clients[chatId] = client;
  client.on("ready", () => console.log("Ready for " + phone));
  client.initialize();
}

// Port listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running on port " + PORT);
});async function sendRandomMessages(chatId) {
  if (!linkedAccounts[chatId] || Object.keys(linkedAccounts[chatId]).length < 2) {
    sendPoliteMessage(chatId, "Sorry, you need at least 2 linked accounts to send messages. 😔");
    return;
  }

  const accounts = Object.keys(linkedAccounts[chatId]);
  const sender = accounts[0]; // Use first as sender
  const receivers = accounts.slice(1);

  const messageCount = getRandomMessageCount();
  for (let i = 0; i < messageCount; i++) {
    const randomMsg = randomMessages[Math.floor(Math.random() * randomMessages.length)];
    for (const receiver of receivers) {
      try {
        await clients[chatId].sendMessage(`${receiver}@c.us`, randomMsg);
      } catch (error) {
        console.error(`Error sending message: ${error}`);
      }
    }
  }
  sendPoliteMessage(chatId, `Sent ${messageCount} random messages to linked accounts! 📤`);
}

// Main menu keyboard
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🚀 Start', callback_data: 'start' }],
      [{ text: '➕ Add Accounts', callback_data: 'add_accounts' }],
      [{ text: '⏱️ Delay', callback_data: 'delay' }],
      [{ text: '📋 List Linked Accounts', callback_data: 'list_accounts' }],
      [{ text: '📊 Bot Status', callback_data: 'bot_status' }],
      [{ text: '👨‍💻 Bot Developer', callback_data: 'bot_developer' }],
      [{ text: '🛑 Stop', callback_data: 'stop' }]
    ]
  }
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendPoliteMessage(chatId, "Welcome to the WhatsApp Automation Bot! Please choose an option below. 😊", mainMenu);
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'start') {
    sendPoliteMessage(chatId, "Bot started! Ready to automate. 🚀", mainMenu);
  } else if (data === 'add_accounts') {
    const addMenu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 QR Code', callback_data: 'qr_code' }],
          [{ text: '🔢 Pairing Code', callback_data: 'pairing_code' }],
          [{ text: '⬅️ Back', callback_data: 'back' }]
        ]
      }
    };
    sendPoliteMessage(chatId, "How would you like to add an account? 📲", addMenu);
  } else if (data === 'qr_code') {
    // Launch Puppeteer for QR code
    try {
      const browser = await puppeteer.launch({ headless: false });
      browsers[chatId] = browser;
      const page = await browser.newPage();
      await page.goto('https://web.whatsapp.com');
      await page.waitForSelector('canvas', { timeout: 60000 });
      const qrData = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return canvas.toDataURL();
      });
      qrcode.generate(qrData.split(',')[1], { small: true });
      sendPoliteMessage(chatId, "Scan the QR code in your terminal or via an image. Once linked, reply 'done'. ✅");
      // Wait for user confirmation
      bot.once('message', (msg) => {
        if (msg.text.toLowerCase() === 'done') {
          linkedAccounts[chatId] = linkedAccounts[chatId] || {};
          linkedAccounts[chatId]['qr_account'] = 'session'; // Placeholder
          browser.close();
          sendPoliteMessage(chatId, "Account linked successfully! 🎉", mainMenu);
        }
      });
    } catch (error) {
      sendPoliteMessage(chatId, "Error generating QR code. Please try again. 😞");
    }
  } else if (data === 'pairing_code') {
    sendPoliteMessage(chatId, "Please enter your phone number with country code (e.g., +1234567890). 📞");
    bot.once('message', async (msg) => {
      const phone = msg.text;
      try {
        const browser = await puppeteer.launch({ headless: false });
        browsers[chatId] = browser;
        const page = await browser.newPage();
        await page.goto('https://web.whatsapp.com');
        // Simulate pairing code request (WhatsApp Web pairing)
        await page.waitForSelector('input[type="text"]', { timeout: 60000 });
        await page.type('input[type="text"]', phone);
        await page.click('button'); // Assuming pairing button
        // Extract pairing code (this is simplified; in reality, parse the DOM)
        const pairingCode = await page.evaluate(() => {
          return document.querySelector('.pairing-code').innerText; // Placeholder selector
        });
        sendPoliteMessage(chatId, `Your pairing code is: ${pairingCode}. Enter it on your phone. 🔐`);
        // Wait for confirmation
        bot.once('message', (msg) => {
          if (msg.text.toLowerCase() === 'linked') {
            linkedAccounts[chatId] = linkedAccounts[chatId] || {};
            linkedAccounts[chatId][phone] = 'session';
            browser.close();
            sendPoliteMessage(chatId, "Account linked successfully! 🎉", mainMenu);
          }
        });
      } catch (error) {
        sendPoliteMessage(chatId, "Error with pairing code. Please try again. 😞");
      }
    });
  } else if (data === 'delay') {
    sendPoliteMessage(chatId, "Enter the delay in minutes for sending random messages (1-60). ⏰");
    bot.once('message', (msg) => {
      const minutes = parseInt(msg.text);
      if (isNaN(minutes) || minutes < 1 || minutes > 60) {
        sendPoliteMessage(chatId, "Invalid input. Please enter a number between 1-60. 😕", mainMenu);
        return;
      }
      delays[chatId] = { minutes, active: true };
      setInterval(() => {
        if (delays[chatId]?.active) sendRandomMessages(chatId);
      }, minutes * 60000);
      sendPoliteMessage(chatId, `Delay set to ${minutes} minutes! Messages will be sent randomly. ⏳`, mainMenu);
    });
  } else if (data === 'list_accounts') {
    const accounts = linkedAccounts[chatId] || {};
    const count = Object.keys(accounts).length;
    const list = Object.keys(accounts).map(phone => `📱 ${phone}`).join('\n');
    sendPoliteMessage(chatId, `You have ${count} linked accounts:\n${list || 'None yet.'} 📋`, mainMenu);
  } else if (data === 'bot_status') {
    const status = delays[chatId]?.active ? 'Active with delay' : 'Idle';
    sendPoliteMessage(chatId, `Bot status: ${status}. Ready to assist! 📊`, mainMenu);
  } else if (data === 'bot_developer') {
    sendPoliteMessage(chatId, "Developed by [Your Name/Team]. For support, contact us! 👨‍💻", mainMenu);
  } else if (data === 'stop') {
    delays[chatId] = { ...delays[chatId], active: false };
    if (browsers[chatId]) browsers[chatId].close();
    sendPoliteMessage(chatId, "Bot stopped. Thank you for using! 🛑", mainMenu);
  } else if (data === 'back') {
    sendPoliteMessage(chatId, "Back to main menu. 😊", mainMenu);
  }
});

// Initialize WhatsApp clients for linked accounts
function initWhatsAppClient(chatId, phone) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `${chatId}_${phone}` })
  });
  clients[chatId] = client;
  client.on('ready', () => {
    console.log(`WhatsApp client ready for ${phone}`);
  });
  client.initialize();
}

// On bot start, load existing sessions
fs.readdir('./sessions', (err, files) => {
  if (!err) {
    files.forEach(file => {
      // Load sessions (simplified)
    });
  }
});
