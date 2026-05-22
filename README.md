# TeleRealm CDN

TeleRealm is a lightweight CDN-style file service built on top of Telegram Bot API storage. You can upload files, generate secure shareable links, manage upload records, and use either protected APIs or path-based public integration.

The current layout is split into two clear folders:

- `api/` for server-side routing, auth, bot/chat/file storage, and Telegram integration
- `ui/` for the Drive-style web workspace

## Overview

This version includes:

- Dedicated upload workspace page
- Public API integration pages and docs
- CRUD record APIs for uploaded files
- Secure download links via encrypted drive key
- Docker-ready deployment setup

## Attribution And Rights

Original project foundation and core idea:

- Lai Chi Thinh (ThinhPhoenix) - FPT University

Current version note:

- Additional features, API flows, and UI pages were extended and rewired in this iteration.

## Main Features

- User register/login with session tokens
- Connect Telegram bot tokens and load chats
- Select a chat to browse its file storage
- CRUD file records per chat
- Secure download route via /drive/:key
- Google Drive-style UI in the `ui/` folder

## Route Map

### Public Routes

- GET /
- GET /ping
- GET /drive/:key

### API Routes

- POST /api/auth/register
- POST /api/auth/login
- GET /api/me
- GET /api/bots
- POST /api/bots
- POST /api/bots/:botID/sync
- GET /api/bots/:botID/chats
- POST /api/bots/:botID/chats/:chatID/select
- GET /api/bots/:botID/chats/:chatID/files
- POST /api/bots/:botID/chats/:chatID/files
- GET /api/files/:id
- PATCH /api/files/:id
- DELETE /api/files/:id

### Frontend

- `ui/index.html`
- `ui/style.css`
- `ui/app.js`

## Quick Start (Local)

### Prerequisites

- Go 1.23+
- Telegram bot token from BotFather

### Run

```bash
go mod download
go run main.go
```

Server default: http://localhost:7777

The UI is available at `/`, and all authenticated storage operations go through `/api/*`.

## Quick Start (Docker)

### Build and run with compose

```bash
docker compose build
docker compose up -d
```

### Stop

```bash
docker compose down
```

## HTTPS Deployment

The production domain must be served over HTTPS. Browser APIs such as
`crypto.randomUUID()` are only guaranteed in secure contexts, so serving the app
over plain HTTP can break injected or third-party scripts.

### Nginx + Let's Encrypt

The included `telerealm.conf` proxies HTTPS traffic to the Go app on
`127.0.0.1:7777` and redirects HTTP to HTTPS.

1. Point DNS for `telerealm.gitlabserver.id.vn` and
   `www.telerealm.gitlabserver.id.vn` to the server.
2. Start the app:

```bash
docker compose up -d --build
```

3. Install Nginx and Certbot, then request the certificate before enabling the
   HTTPS site:

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone \
  -d telerealm.gitlabserver.id.vn \
  -d www.telerealm.gitlabserver.id.vn
sudo systemctl start nginx
```

4. Enable the Nginx site and reload:

```bash
sudo cp telerealm.conf /etc/nginx/sites-available/telerealm.conf
sudo ln -sf /etc/nginx/sites-available/telerealm.conf /etc/nginx/sites-enabled/telerealm.conf
sudo nginx -t
sudo systemctl reload nginx
```

For renewal with the standalone Certbot method, use hooks so port 80 is free
while Certbot validates the domain:

```bash
sudo certbot renew --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
```

If Cloudflare is in front of the server, use SSL/TLS mode `Full (strict)` and
keep the origin certificate valid. Do not use Flexible SSL, because the browser
may appear HTTPS while the origin remains misconfigured.

### Browser Extension Check

Errors from files named `content.js` or `read.js` usually come from browser
extensions or an in-app browser, not from this repository. Re-test in a clean
browser profile, incognito window with extensions disabled, or another browser
to confirm.

## Example API Calls

### Protected upload

```bash
curl -X POST \
  -H "Authorization: Bearer <bot_token>" \
  -F "chat_id=<chat_id>" \
  -F "document=@/path/to/file.png" \
  http://localhost:7777/send
```

### Public scoped upload

```bash
curl -X POST \
  -F "document=@/path/to/file.png" \
  http://localhost:7777/link/<bot_token>/<chat_id>
```

### Public scoped list

```bash
curl http://localhost:7777/link/<bot_token>/<chat_id>
```

## Security Notes

- Do not expose bot tokens in untrusted frontend contexts.
- Path-based public API includes bot token in URL, so prefer protected API in production.
- Local browser storage on upload page is for convenience only.
- Rotate bot token immediately if leaked.

## Contributing

Contributions are welcome through pull requests.
