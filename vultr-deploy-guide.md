# Vultr Docker Deployment Guide (with Cloudflare Tunnels)

This guide covers deploying the LINE Notify Bot onto a Linux server (like Vultr) alongside exising apps like Odoo, without conflicting with their Nginx ports, using Cloudflare Tunnels.

## 1. Connect to the Server
SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

## 2. Clone the Repository
Clone the repository using a GitHub Personal Access Token (PAT). Replace `YOUR_TOKEN_HERE` with your `ghp_...` token.
```bash
git clone https://kriswen:YOUR_TOKEN_HERE@github.com/kriswen/LINE-app.git
cd LINE-app/LINE-Notify
```

## 3. Configure Environment Variables
Create the `.env` file where your secrets are stored, because Git ignores them.
```bash
nano .env
```
Paste your configuration exactly:
```env
CHANNEL_ACCESS_TOKEN="your_token_here_with_no_spaces"
CHANNEL_SECRET="your_secret_here"
GROUP_ID="your_group_id_here"
CALENDAR_URL="your_calendar_url_here"
ADMIN_PASSWORD="your_password"
DASHBOARD_URL="https://your_cloudflare_tunnel.trycloudflare.com"
```
Save (`Ctrl+O`, `Enter`) and Exit (`Ctrl+X`).

## 4. Build and Run the Docker Container
Build the image (which now safely pulls your `.env` flags if you configured it right, or passes them in via command line). Ensure Docker auto-restarts the bot if the server crashes.

```bash
# Build the image
sudo docker build -t line-bot .

# Run the image on Port 4000 (to avoid conflict with Odoo on Port 3000)
# using the `.env` file and auto-restart flags
sudo docker run -d --name my-line-bot --restart unless-stopped --env-file .env -p 4000:3000 line-bot
```

*Wait for it to say `injecting env (5)` when you check `sudo docker logs my-line-bot`.*

## 5. Install Cloudflare Tunnel (cloudflared)
Since Nginx is taken by Odoo, we use Cloudflare tunnels to generate a free HTTPS URL to bridge the Docker container to the internet and LINE perfectly.

```bash
wget -qO- https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 | sudo tee /usr/local/bin/cloudflared >/dev/null
sudo chmod +x /usr/local/bin/cloudflared
```

## 6. Run the Tunnel 24/7
To keep the tunnel online forever even if you close your laptop, start it in the background using `nohup` on boot via `cron`, or a tmux window:

**Quick Method (Tmux):**
```bash
sudo apt install tmux -y
tmux new -s tunnel
cloudflared tunnel --url http://localhost:4000
```
*(Look for your `https://something.trycloudflare.com` URL in the output, then press `Ctrl+B`, release, then press `D` to detach and leave it running in the background).*

## 7. Connect to LINE!
Take the Cloudflare URL generated above, and paste it into the **Webhook URL** field in your [LINE Developers Console](https://developers.line.biz/).

Click **Verify**! Your bot is live!
