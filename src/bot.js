require("dotenv").config();
const line = require("@line/bot-sdk");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { getUpcomingCalendarReminders } = require("./calendar");

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken
});

const subsPath = path.join(__dirname, "..", "subs.json");

function getSubscribers() {
    let subs = [];
    if (fs.existsSync(subsPath)) {
        try {
            const data = fs.readFileSync(subsPath, "utf8");
            subs = JSON.parse(data);
        } catch (err) {
            console.error("Error reading subs.json:", err);
        }
    }

    // Inject GROUP_ID from environment if specified
    if (process.env.GROUP_ID && !subs.includes(process.env.GROUP_ID)) {
        subs.push(process.env.GROUP_ID);
    }

    return subs;
}

function saveSubscriber(id) {
    const subs = new Set(getSubscribers());
    if (!subs.has(id)) {
        subs.add(id);
        fs.writeFileSync(subsPath, JSON.stringify(Array.from(subs), null, 2));
        console.log(`Saved new subscriber ID: ${id}`);
    }
}

const botRouter = express.Router();

botRouter.post("/webhook", line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
        .then(() => res.json({}))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

async function handleEvent(event) {
    let targetId = event.source.groupId || event.source.roomId || event.source.userId;

    if (event.type === "join" || event.type === "follow") {
        console.log(`Bot added to chat: ${targetId}`);
        saveSubscriber(targetId);

        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
                type: "text",
                text: "Hello! I am your Medicine Reminder Bot. I will send scheduled reminders to this chat at 9 AM and 9 PM everyday."
            }]
        });
    }

    if (event.type !== "message" || event.message.type !== "text") {
        return Promise.resolve(null);
    }

    const userText = event.message.text.toLowerCase().trim();

    if (userText === "register") {
        saveSubscriber(targetId);
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
                type: "text",
                text: "This chat has been registered to receive medicine reminders!"
            }]
        });
    }

    if (userText === "今日天氣") {
        try {
            const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=25.0478&longitude=121.5319&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=1";
            
            let weatherData = null;
            let attempts = 0;
            
            while (attempts < 3 && !weatherData) {
              try {
                const weatherResp = await fetch(weatherUrl, { headers: { "User-Agent": "LINE-Bot/1.0" } });
                if (!weatherResp.ok) throw new Error(`HTTP Error: ${weatherResp.status}`);
                weatherData = await weatherResp.json();
              } catch (e) {
                attempts++;
                if (attempts < 3) await new Promise(res => setTimeout(res, 2000));
              }
            }

            if (weatherData && weatherData.daily) {
                const high = weatherData.daily.temperature_2m_max[0];
                const low = weatherData.daily.temperature_2m_min[0];
                const avgTemp = ((high + low) / 2).toFixed(1);
                const rainChance = weatherData.daily.precipitation_probability_max[0];
                return client.replyMessage({
                    replyToken: event.replyToken,
                    messages: [{ type: "text", text: `☀️ 台北今日氣象\n平均溫度：${avgTemp}°C\n降雨機率：${rainChance}%` }]
                });
            } else {
                return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "無法獲取天氣資訊 (API無回應)。" }] });
            }
        } catch (err) {
            console.error("Failed to fetch weather:", err);
            return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "無法獲取天氣資訊。" }] });
        }
    }

    if (userText === "近期行程" || userText === "next events") {
        try {
            const calendarText = await getUpcomingCalendarReminders(5, true, false);
            const msg = calendarText ? calendarText.trim() : "最近5天內沒有即將到來的行程。";
            return client.replyMessage({
                replyToken: event.replyToken,
                messages: [{ type: "text", text: msg }]
            });
        } catch (err) {
            console.error("Failed to fetch calendar:", err);
            return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "無法獲取行事曆資訊。" }] });
        }
    }

    if (userText === "設定" || userText === "settings") {
        const dashboardUrl = process.env.DASHBOARD_URL || "設定連結尚未配置 (No URL configured)";
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: "text", text: `請點擊以下連結開啟設定儀表板：\n${dashboardUrl}` }]
        });
    }

    return Promise.resolve(null);
}

// Function to push messages to all registered chats
async function pushMessageToAll(messagePayload) {
    const subs = getSubscribers();
    if (subs.length === 0) {
        console.log("No registered chats to send reminders to.");
        return;
    }

    // Convert to an array of message objects
    let messages = [];
    if (Array.isArray(messagePayload)) {
        // LINE allows a maximum of 5 messages per push request
        messages = messagePayload.slice(0, 5).map(text => ({ type: "text", text }));
    } else {
        messages = [{ type: "text", text: messagePayload }];
    }

    for (const id of subs) {
        try {
            await client.pushMessage({
                to: id,
                messages: messages
            });
            console.log(`Successfully sent bundle to ${id}`);
        } catch (err) {
            console.error(`Failed to send bundle to ${id}:`, err.message);
        }
    }
}

module.exports = { botRouter, pushMessageToAll };
