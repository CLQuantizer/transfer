# transfer

Private file transfer app hosted at [https://transfer.gongxifacai.win/](https://transfer.gongxifacai.win/).

Protected by [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (Zero Trust). There is no in-app login — Access handles auth at the edge before requests reach the Worker.

## CLI

```bash
# from this repo
pnpm transfer --help
# or link globally
pnpm link --global
transfer --help
```

### Login

**Option A — cloudflared (best when switching devices):**

```bash
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
transfer login --cloudflared
# same as: cloudflared access login https://transfer.gongxifacai.win
```

**Option B — Access Service Token** (portable across devices if you save the secret):

```bash
transfer login
# paste Client ID + Client Secret from Zero Trust → Access → Service Auth
```

Or set env vars:

```bash
export CF_ACCESS_CLIENT_ID="xxxxxxxx.access"
export CF_ACCESS_CLIENT_SECRET="yyyyyyyyyyyy"
```

### Commands

```bash
transfer list
transfer upload ./file.zip
transfer upload ./file.zip --expires 24
transfer download <key-or-shortKey>
transfer download <key> -o ./saved.zip
transfer delete <key>
transfer logout
```

**Note:** `download` is one-time — the server deletes the file after a successful download (same as the web UI).

### Manual curl (same APIs)

```bash
TOKEN=$(cloudflared access token -app=https://transfer.gongxifacai.win)

# list
curl -H "CF-Access-Token: $TOKEN" https://transfer.gongxifacai.win/private/files

# upload
curl -X POST https://transfer.gongxifacai.win/private/upload \
  -H "CF-Access-Token: $TOKEN" \
  -F "file=@./file.zip"

# download
curl -L -H "CF-Access-Token: $TOKEN" \
  -o file.zip \
  https://transfer.gongxifacai.win/private/download/<key>
```

## Authentication details

### Browser

Open https://transfer.gongxifacai.win/ and sign in through the Cloudflare Access login page.

### Service Token setup

1. Zero Trust → **Access** → **Service Auth** → **Create Service Token**
2. Copy **Client ID** and **Client Secret** (secret shown once — store in a password manager)
3. Allow that token in the Access **application policy** for `transfer.gongxifacai.win`

## Developing

```bash
pnpm install
pnpm dev -- --open
```

## Building

```bash
pnpm build
pnpm preview
```

Deployed to Cloudflare Workers via `@sveltejs/adapter-cloudflare` (see `wrangler.jsonc`).
