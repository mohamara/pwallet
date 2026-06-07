# Deploy

## اجرا

```bash
docker compose up -d --build
curl -I http://127.0.0.1:3080/
```

اپ روی `127.0.0.1:3080` در دسترس است. reverse proxy روی سرور جداگانه تنظیم شده.

## به‌روزرسانی

```bash
git pull
docker compose up -d --build
```
