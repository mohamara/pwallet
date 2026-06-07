# Deploy

## اجرا

```bash
docker compose up -d --build
curl -I http://127.0.0.1:3080/
docker ps --filter name=pwallet
```

## خطای 502 — connection refused به 127.0.0.1:3080

**علت:** Caddy شما داخل Docker است (`accounter_caddy`). برای Caddy، `127.0.0.1` یعنی **داخل خود container**، نه سرور host.

**راه‌حل در Caddyfile سرور** (یکی از این‌ها):

```caddyfile
# پیشنهادی — نیاز به extra_hosts در compose مربوط به Caddy:
#   extra_hosts:
#     - "host.docker.internal:host-gateway"
reverse_proxy host.docker.internal:3080
```

یا:

```caddyfile
reverse_proxy 172.17.0.1:3080
```

`127.0.0.1:3080` فقط وقتی کار می‌کند که Caddy **روی host** (systemd) اجرا شود، نه داخل Docker.

همچنین مطمئن شوید pwallet بالا است:

```bash
docker compose ps
docker compose up -d --build
```

## به‌روزرسانی

```bash
git pull
docker compose up -d --build
```
