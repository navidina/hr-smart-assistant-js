# دستیار هوشمند منابع انسانی رایان هم‌افزا

چت‌بات سازمانی منابع انسانی با یک بک‌اند ساده‌ی **Node.js** که روی هر هاست معمولی اجرا می‌شود:

- **فرانت‌اند**: فایل‌های استاتیک (`index.html`, `login.html`, `profile.html`, `vendor/`) که همان سرور سرو می‌کند.
- **بک‌اند**: یک سرور **Express** در `server.js` با اندپوینت‌های `/ask`، `/status` و `/api/auth/*`.
- **پایگاه‌داده**: **SQLite** (فایل محلی `data/smartassistant.db`) برای کارمندان، کاربران و مکالمات.
- **چت هوش مصنوعی**: اتصال به **AvalAI** (سازگار با OpenAI) به‌همراه یک لایهٔ **RAG واژگانی سبک** روی اسناد سازمان (`know.docx` / `knowledge.docx` → `lib/knowledge.json`).
- **ورود**: نام کاربری/رمز عبور برای دمو (پیش‌فرض `admin` / `rayan@1404`).

## ساختار
```
server.js         # سرور Express (سرو فایل‌های استاتیک + API)
server/           # ماژول‌های بک‌اند (db, auth, avalai, jalali, retrieval, hr)
lib/knowledge.json# پایگاه دانش برای RAG
tools/            # اسکریپت‌های محلی: ایمپورت اکسل و ساخت پایگاه دانش
vendor/           # کتابخانه‌های UI آفلاین (tailwind, chart.js, marked, fontawesome)
schema.sql        # اسکیمای SQLite (هنگام اولین اجرا خودکار ساخته می‌شود)
.env.example      # نمونهٔ تنظیمات محیطی
```

## راه‌اندازی محلی
```bash
npm install
cp .env.example .env          # سپس AVALAI_API_KEY و JWT_SECRET را پر کنید
npm start                     # روی http://localhost:3000
```

برای ساخت یک `JWT_SECRET` تصادفی:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## بارگذاری کارمندان (اختیاری)
برای پرشدن پروفایل/داشبورد و معرفی افراد به دستیار، کارمندان را از `plist.xlsx` ایمپورت کنید:
```bash
npm run employees:build-sql   # plist.xlsx -> seed-employees.sql
npm run employees:load        # seed-employees.sql -> data/smartassistant.db
```

## متغیرهای محیطی
| متغیر | توضیح |
| --- | --- |
| `PORT` | پورت سرور (پیش‌فرض `3000`) |
| `AVALAI_API_KEY` | **الزامی** برای کارکردن دستیار |
| `AVALAI_BASE_URL` | آدرس AvalAI (پیش‌فرض `https://api.avalai.ir/v1`) |
| `AVALAI_MODEL` | مدل (پیش‌فرض `gpt-4o-mini`) |
| `JWT_SECRET` | کلید امضای کوکی نشست (در پروداکشن حتماً ست شود) |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | اعتبارنامهٔ ورود دمو |
| `DEMO_EMPLOYEE_CODE` | اتصال نشست دمو به کد کارمند مشخص (اختیاری) |
| `DATABASE_PATH` | مسیر فایل SQLite (پیش‌فرض `./data/smartassistant.db`) |

## استقرار روی یک هاست ساده
هر سروری که Node.js (نسخهٔ ۱۸ به بالا) داشته باشد کافی است:

```bash
git clone <repo> && cd hr-smart-assistant-js
npm install --omit=dev
cp .env.example .env   # مقادیر را پر کنید
npm start
```

برای اجرای دائمی، یک process manager مثل **pm2** یا یک سرویس **systemd** بگذارید و در صورت نیاز پشت **Nginx** (reverse proxy روی HTTPS) قرار دهید. چون کوکی نشست هنگام درخواست HTTPS با فلگ `Secure` ست می‌شود، اگر پشت پراکسی هستید مطمئن شوید هدر `X-Forwarded-Proto` ارسال می‌شود.
