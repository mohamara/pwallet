# Deploy — pwall.dfmstock.com

## معماری (بدون تداخل Caddy)

```
Internet → Caddy اصلی سرور (80/443) → 127.0.0.1:3080 → Docker (nginx + PWallet)
```

- **Docker فقط اپ** را اجرا می‌کند.
- **پورت 80/443 اشغال نمی‌شود** — فقط `127.0.0.1:3080`.
- **Caddy جداگانه در Docker اجرا نمی‌شود** — snippet به Caddy موجود سرور اضافه می‌شود.

## 1. Build و اجرا

```bash
cd /path/to/pwallet
docker compose up -d --build
curl -sI http://127.0.0.1:3080/
```

## 2. اتصال به Caddy سرور

### روش A — import در Caddyfile

```caddyfile
import /path/to/pwallet/deploy/caddy/pwall.dfmstock.com.caddy
```

### روش B — نصب snippet

```bash
sudo bash deploy/caddy/install.sh
# پیش‌فرض: /etc/caddy/Caddyfile.d/pwall.dfmstock.com.caddy
```

مطمئن شوید Caddyfile اصلی snippetها را import می‌کند:

```caddyfile
import /etc/caddy/Caddyfile.d/*.caddy
```

### Reload (نه restart جدید)

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 3. DNS

رکورد `A` یا `CNAME` برای `pwall.dfmstock.com` به IP سرور.

## 4. اگر Caddy خودش داخل Docker است

از override شبکه مشترک استفاده کنید (بدون publish پورت روی host):

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.caddy-network.yml up -d --build
```

snippet مخصوص Docker:

```bash
# deploy/caddy/pwall.dfmstock.com.docker.caddy
import /path/to/pwallet/deploy/caddy/pwall.dfmstock.com.docker.caddy
```

در snippet: `reverse_proxy pwallet:80` (به‌جای 127.0.0.1:3080)

اگر Caddy روی host است ولی container پورت publish دارد، همان `pwall.dfmstock.com.caddy` با `127.0.0.1:3080` کافی است.

## 5. به‌روزرسانی

```bash
git pull
docker compose up -d --build
```
