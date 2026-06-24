# Deploying AgentBus on your own VPS

You already have the repo cloned on your VPS at `~/Agentbus`. This guide
covers running it as a long-lived service.

## One-shot install

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Install dependencies (already done if you ran scripts/install.sh)
cd ~/Agentbus
pnpm -r build

# Quick test that everything works
pnpm -r test
pnpm smoke
```

## Run in the foreground (testing)

```bash
node scripts/demo-two-agents.mjs --port=8787 --inject
```

Press **Ctrl+C** to stop. Useful for debugging.

## Run in the background

```bash
# nohup + redirect
nohup node scripts/demo-two-agents.mjs --port=8787 > /var/log/agentbus.log 2>&1 &

# check it's alive
ps aux | grep demo-two-agents
curl -s http://localhost:8787/api/state | head

# tail the log
tail -f /var/log/agentbus.log
```

## systemd service (recommended for production)

Create `/etc/systemd/system/agentbus.service`:

```ini
[Unit]
Description=AgentBus — AI Trading Agent Message Bus
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Agentbus
ExecStart=/usr/bin/node /root/Agentbus/scripts/demo-two-agents.mjs --port=8787
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Optional env vars (override with `systemctl edit agentbus`):
Environment=NODE_ENV=production
Environment=AGENTBUS_MODE=paper
# Uncomment and set to enable the LLM classifier:
#Environment=BITGET_QWEN_API_KEY=sk-...
#Environment=OPENAI_API_KEY=sk-...

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable agentbus       # start on boot
sudo systemctl start agentbus        # start now
sudo systemctl status agentbus       # check it's running
journalctl -u agentbus -f            # follow logs
```

## Open the firewall port

The dashboard lives on port 8787. Make it reachable:

```bash
# UFW (Ubuntu/Debian):
sudo ufw allow 8787/tcp

# firewalld (CentOS/RHEL):
sudo firewall-cmd --permanent --add-port=8787/tcp
sudo firewall-cmd --reload

# iptables (raw):
sudo iptables -A INPUT -p tcp --dport 8787 -j ACCEPT
```

Then open `http://YOUR_VPS_IP:8787` in any browser.

## Optional: nginx in front (for HTTPS)

If you have a domain pointing at your VPS, use nginx + Let's Encrypt for
TLS. Create `/etc/nginx/sites-available/agentbus`:

```nginx
server {
    listen 80;
    server_name agentbus.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/agentbus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Add HTTPS:
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d agentbus.yourdomain.com
```

## Persist the JSONL audit log

The default log path is `examples/two-agent-demo/session.jsonl` inside
the repo. With systemd + a long-running service, the file grows as
trades happen. To save it externally:

```bash
# Option A — symlink to a fixed location outside the repo:
sudo mkdir -p /var/log/agentbus
sudo chown root:root /var/log/agentbus
ln -sf /var/log/agentbus/session.jsonl /root/Agentbus/examples/two-agent-demo/session.jsonl

# Option B — change the systemd unit to use --log=/var/log/agentbus/session.jsonl
# Then back it up nightly:
cat > /etc/cron.daily/agentbus-backup <<'EOF'
#!/bin/sh
cp /var/log/agentbus/session.jsonl /var/backups/agentbus-$(date +%F).jsonl
find /var/backups -name 'agentbus-*.jsonl' -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/agentbus-backup
```

## Multi-machine bus (Redis transport)

If you want to run the dashboard on one VPS and the executor on another,
they need to share the bus. The simplest way is Redis:

```bash
# Install Redis:
sudo apt install redis-server
sudo systemctl enable --now redis-server

# In the systemd unit on BOTH machines, add:
Environment=REDIS_URL=redis://YOUR_REDIS_IP:6379
```

ioredis is already in `devDependencies` so `pnpm install` pulls it.
No code changes needed.

## Updating to a new version

```bash
cd ~/Agentbus
git pull origin main
pnpm install --frozen-lockfile
pnpm -r build
sudo systemctl restart agentbus
```

Watch the journal to confirm clean restart:

```bash
journalctl -u agentbus -n 50 --no-pager
```

## Uninstalling

```bash
sudo systemctl stop agentbus
sudo systemctl disable agentbus
sudo rm /etc/systemd/system/agentbus.service
sudo rm /etc/nginx/sites-enabled/agentbus
sudo rm /etc/cron.daily/agentbus-backup
```

The repo at `~/Agentbus` and the systemd log in `/var/log/agentbus/` are
yours to keep or delete.
