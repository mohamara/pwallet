# Deploy

## اجرا (تست محلی)

```bash
docker compose up -d --build
curl -I http://127.0.0.1:3080/
```

## استقرار با Caddy داخل Docker (accounter_caddy)

`127.0.0.1:3080` در Caddyfile **کار نمی‌کند** — Caddy داخل container است و localhost خودش را می‌بیند، نه host.

### 1. شبکه Caddy را پیدا کنید

```bash
docker inspect accounter_caddy --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

معمولاً چیزی شبیه `accounter_default` است.

### 2. pwallet را به همان شبکه وصل کنید

```bash
CADDY_NETWORK=accounter_default docker compose -f docker-compose.yml -f deploy/docker-compose.network.yml up -d --build
```

### 3. Caddyfile را عوض کنید

```caddyfile
# ❌ اشتباه (برای Caddy داخل Docker):
# reverse_proxy 127.0.0.1:3080

# ✅ درست:
pwall.dfmstock.com {
	encode gzip zstd
	reverse_proxy pwallet:80
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "no-referrer"
		-Server
	}
}
```

### 4. Caddy را reload کنید

```bash
docker exec accounter_caddy caddy reload --config /etc/caddy/Caddyfile
# یا روش reload پروژه accounter خودتان
```

## جایگزین (بدون شبکه مشترک)

اگر نمی‌خواهید شبکه مشترک بزنید، در Caddyfile:

```caddyfile
reverse_proxy host.docker.internal:3080
```

و در compose مربوط به `accounter_caddy`:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## به‌روزرسانی

```bash
git pull
docker compose -f docker-compose.yml -f deploy/docker-compose.network.yml up -d --build
```
