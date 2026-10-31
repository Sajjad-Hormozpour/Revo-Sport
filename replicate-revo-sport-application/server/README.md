# Revo Sport API

Node.js 18 or newer is required. Build the frontend, then run:

```sh
npm run build
node server/index.mjs
```

The launcher retrieves the unmodified API from the same pinned upstream commit as the frontend and starts it. The first launch needs network access. The upstream service uses a JSON database and media/backups directories under `DATA_DIR` (default: `server/data`).

Upstream environment settings include `PORT`, `DATA_DIR`, `ADMIN_EMAIL`, `TRUST_PROXY`, `RESET_WEBHOOK_URL`, `KAVENEGAR_API_KEY`, `KAVENEGAR_TEMPLATE`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_SECRET`, `OTP_DEV_MODE`, `CORS_ORIGIN`, and `DIST_DIR`.