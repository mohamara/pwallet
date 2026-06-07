# PWallet

کیف پول خصوصی وب — با وارد کردن عبارت ۲۴ (یا ۱۲) کلمه‌ای BIP39، هم روی شبکه‌های EVM و هم TRON (TRC) کار می‌کند.

## ویژگی‌ها

- باز کردن کیف پول با mnemonic (BIP39)
- استخراج آدرس EVM با مسیر `m/44'/60'/0'/0/0`
- استخراج آدرس TRON با مسیر `m/44'/195'/0'/0/0`
- پشتیبانی از Ethereum، BSC، Polygon و TRON
- **USDT به‌صورت پیش‌فرض روی همه شبکه‌ها**
- **افزودن توکن دلخواه** (ERC-20 / TRC-20) با آدرس قرارداد
- مشاهده موجودی، ارسال و دریافت (ارز بومی + توکن)
- پردازش کلیدها فقط در مرورگر (بدون ارسال به سرور)

## اجرا

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up -d --build
```

اپ روی `http://127.0.0.1:3080` اجرا می‌شود. جزئیات: [deploy/README.md](deploy/README.md)

## امنیت

### آنچه پیاده‌سازی شده

| موضوع | وضعیت |
|-------|--------|
| پردازش mnemonic فقط در مرورگر | ✅ |
| **عدم ذخیره mnemonic** پس از باز شدن | ✅ |
| کلید خصوصی خارج از React state (ماژول امن) | ✅ |
| UI فقط آدرس عمومی — بدون نمایش private key | ✅ |
| قفل خودکار پس از ۱۵ دقیقه بی‌فعالیتی | ✅ |
| پاک‌سازی session هنگام قفل | ✅ |
| اعتبارسنجی آدرس و مبلغ قبل از ارسال | ✅ |
| فیلتر پیام خطا (بدون نشت کلید/mnemonic) | ✅ |
| localStorage فقط برای لیست توکن‌های سفارشی | ✅ |
| sanitize داده‌های localStorage | ✅ |
| هشدار در صورت نبود HTTPS | ✅ |
| جلوگیری از autocomplete/password manager روی seed | ✅ |
| هشدار قبل از بستن تب (wallet باز) | ✅ |

### توصیه‌های استفاده

- عبارت بازیابی را با کسی به اشتراک نگذارید
- فقط روی **HTTPS** یا **localhost** استفاده کنید
- روی دستگاه شخصی و بدون بدافزار باشید
- پس از استفاده، **قفل کردن** یا بستن تب را فراموش نکنید
- این یک کیف پول non-custodial است — بازیابی seed بر عهده شماست

### استقرار production

روی سرور، هدرهای امنیتی را فعال کنید:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https:; ...
Referrer-Policy: no-referrer
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### محدودیت‌های ذاتی مرورگر

- JavaScript نمی‌تواند حافظه را به‌طور کامل پاک کند (رشته‌ها immutable هستند)
- افزونه‌های مخرب مرورگر می‌توانند DOM را بخوانند
- برای مقادیر بالا، از hardware wallet استفاده کنید

## فناوری

- React + TypeScript + Vite
- ethers.js (EVM)
- TronWeb (TRON)
- @scure/bip39 / @scure/bip32 (استخراج کلید)
