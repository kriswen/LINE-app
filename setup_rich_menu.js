require("dotenv").config();
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

const clientBlob = new line.messagingApi.MessagingApiBlobClient({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

async function main() {
    console.log("Creating new Rich Menu...");
    const richMenuToCreate = {
        size: { width: 2500, height: 1000 },
        selected: true,
        name: "Main Menu",
        chatBarText: "Menu",
        areas: [
            { // Left Third: Check Weather
                bounds: { x: 0, y: 0, width: 833, height: 1000 },
                action: { type: "message", text: "今日天氣" }
            },
            { // Middle Third: Next Events
                bounds: { x: 834, y: 0, width: 833, height: 1000 },
                action: { type: "message", text: "近期行程" }
            },
            { // Right Third: Settings
                bounds: { x: 1667, y: 0, width: 833, height: 1000 },
                action: { type: "message", text: "設定" }
            }
        ]
    };

    try {
        // 1. Create the rich menu structure
        const richMenuId = await client.createRichMenu(richMenuToCreate).then(res => res.richMenuId);
        console.log("Created Rich Menu ID:", richMenuId);

        // 2. Upload the image to the rich menu
        console.log("Uploading rich_menu_cropped.jpg...");
        const imagePath = path.join(__dirname, "rich_menu_cropped.jpg");
        const buffer = fs.readFileSync(imagePath);
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        await clientBlob.setRichMenuImage(richMenuId, blob);
        console.log("Image uploaded successfully.");

        // 3. Set as default rich menu for everyone
        console.log("Setting as default menu...");
        await client.setDefaultRichMenu(richMenuId);
        console.log("✅ Success! The Rich Menu should now appear in the LINE group.");

    } catch (err) {
        console.error("Failed to setup rich menu:", err);
    }
}

main();
