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

## 4. Caddy داخل Docker است (مثل `accounter_caddy`)

شبکه `caddy` به‌صورت پیش‌فرض **وجود ندارد**. نام واقعی شبکه را از container بگیرید.

### روش A — ساده (بدون شبکه مشترک) ✅ پیشنهادی

```bash
docker compose up -d --build
```

در Caddyfile پروژه accounter:

```caddyfile
import /path/to/pwallet/deploy/caddy/pwall.dfmstock.com.docker-host.caddy
```

در `docker-compose` مربوط به **accounter_caddy** حتماً:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

سپس Caddy را reload کنید.

### روش B — شبکه مشترک Docker

```bash
bash deploy/up-with-caddy.sh
# یا: CADDY_CONTAINER=accounter_caddy bash deploy/up-with-caddy.sh
```

اسکریپت شبکه `accounter_caddy` را پیدا می‌کند (معمولاً `accounter_default`).

در Caddyfile accounter:

```caddyfile
import /path/to/pwallet/deploy/caddy/pwall.dfmstock.com.docker.caddy
```

(`reverse_proxy pwallet:80`)

### پیدا کردن نام شبکه دستی

```bash
docker inspect accounter_caddy --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

## 5. به‌روزرسانی

```bash
git pull
docker compose up -d --build
```
