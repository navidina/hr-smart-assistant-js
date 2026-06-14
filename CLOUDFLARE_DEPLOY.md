# استقرار روی Cloudflare Pages (فرانت‌اند + بک‌اند TypeScript)

این پروژه برای میزبانی کامل روی **Cloudflare Pages** آماده شده است:

- **فرانت‌اند**: فایل‌های استاتیک ریشهٔ مخزن (`index.html`, `login.html`, `profile.html`, `vendor/`, ...).
- **بک‌اند**: توابع TypeScript در پوشهٔ `functions/` (روی Cloudflare Workers اجرا می‌شوند) — جایگزین بک‌اند پایتون.
- **ورود (دمو)**: نام کاربری/رمز عبور هاردکدشده (فعلاً برای دمو؛ فرایند OTP غیرفعال است).
- **پایگاه‌داده** (کارمندان، کاربران، مکالمات): **D1** (SQLite کلاودفلر).
- **چت هوش مصنوعی**: اتصال به **AvalAI** (سازگار با OpenAI).
- **نشست (Session)**: به‌جای کوکی سشن Flask از **JWT داخل کوکی HttpOnly** استفاده می‌شود؛ فرانت‌اند بدون تغییر کار می‌کند چون API هم‌مبدأ است.

> ⚠️ بک‌اند پایتون قبلی به‌طور کامل حذف شده و کل سرویس اکنون روی Cloudflare اجرا می‌شود.

---

## پیش‌نیازها
- Node.js نسخهٔ ۱۸ یا بالاتر.
- یک حساب Cloudflare.
- نصب وابستگی‌ها و ورود به حساب:
  ```bash
  npm install
  npx wrangler login
  ```

---

## گام ۱: ساخت پایگاه‌داده D1
```bash
npx wrangler d1 create smartassistant
```
`database_id` چاپ‌شده را در `wrangler.toml` بخش `[[d1_databases]]` جای‌گذاری کنید.
(برای دمو نیازی به KV نیست؛ ورود با نام کاربری/رمز انجام می‌شود.)

## گام ۲: ساخت جداول (Schema)
```bash
npm run db:init:remote      # اجرای schema.sql روی D1 ابری
```
(برای تست محلی: `npm run db:init` که روی نسخهٔ local اجرا می‌شود.)

## گام ۳: بارگذاری کارمندان از plist.xlsx (اختیاری ولی توصیه‌شده)
برای اینکه صفحهٔ پروفایل و داشبورد با دادهٔ واقعی پر شوند، فایل `plist.xlsx` را در ریشه بگذارید و:
```bash
npm run employees:build-sql       # plist.xlsx -> seed-employees.sql
npm run employees:load:remote     # بارگذاری در D1 ابری
```
اسکریپت ستون‌های فارسی (کد پرسنلی، نام، …) را خودکار تشخیص می‌کند. نشست دمو به‌صورت پیش‌فرض به **اولین کارمند** جدول وصل می‌شود (یا به `DEMO_EMPLOYEE_CODE` اگر تنظیم شود). اگر این جدول خالی باشد، ورود همچنان کار می‌کند و یک هویت «کاربر دمو» ساخته می‌شود.

## گام ۴: تنظیم Secretها
```bash
npx wrangler pages secret put JWT_SECRET            # یک رشتهٔ تصادفی بلند
npx wrangler pages secret put AVALAI_API_KEY        # کلید AvalAI
```

## گام ۵: متغیرهای عمومی (در `wrangler.toml [vars]`)
- `AVALAI_MODEL`: مدل AvalAI (پیش‌فرض `gpt-4o-mini`؛ هر مدل سازگار با OpenAI که در پنل AvalAI دارید).
- `DEMO_USERNAME` / `DEMO_PASSWORD`: نام کاربری و رمز ورود دمو (پیش‌فرض `admin` / `rayan@1404`). حتماً برای دمو واقعی عوضشان کنید.
- `DEMO_EMPLOYEE_CODE` (اختیاری): کد کارمندی که نشست دمو به آن وصل شود.

## گام ۶: استقرار
```bash
npm run deploy
# یا مستقیم:
npx wrangler pages deploy
```
بار اول اگر پروژهٔ Pages وجود نداشته باشد، wrangler می‌سازدش. آدرس نهایی `https://<project>.pages.dev` خواهد بود.

> روش جایگزین: در داشبورد Cloudflare می‌توانید مخزن Git را به Pages وصل کنید. در این حالت Build command را خالی بگذارید و Build output directory را `.` (ریشه) قرار دهید؛ بایندینگ D1 و Secretها را هم از بخش Settings تنظیم کنید.

---

## ورود دمو
- نام کاربری/رمز پیش‌فرض: **`admin`** / **`rayan@1404`** (از `wrangler.toml` قابل تغییر).
- صفحهٔ ورود (`login.html`) فقط همین دو فیلد را دارد؛ فرایند OTP حذف شده است.

---

## اجرای محلی (اختیاری)
```bash
cp .dev.vars.example .dev.vars   # و مقادیر را پر کنید
npm run db:init                  # ساخت جداول روی D1 محلی
# (برای داده محلی: wrangler d1 execute smartassistant --local --file=./seed-employees.sql)
npm run dev                      # http://localhost:8788
```
در حالت محلی کوکی بدون فلگ Secure ست می‌شود تا روی http هم کار کند.

---

## RAG سبک (دانش پروژه)
چت یک لایهٔ بازیابی ساده دارد: متن `know.docx` و `knowledge.docx` هنگام build به `lib/knowledge.json` تبدیل می‌شود و در زمان اجرا، چند تکهٔ مرتبط با پرسش (بازیابی واژگانی) به پرامپت AvalAI تزریق می‌شود تا پاسخ‌ها بر پایهٔ سیاست‌های واقعی سازمان باشند و منابع هم در پاسخ برگردند.

- فایل `lib/knowledge.json` از قبل ساخته و کامیت شده، پس بدون کار اضافه کار می‌کند.
- هر وقت اسناد docx را تغییر دادید، دوباره بسازید:
  ```bash
  npm run knowledge:build
  ```
  (نیازمند وجود `know.docx`/`knowledge.docx` در ریشهٔ پروژه است.)

## نکات و محدودیت‌ها
- **نوع RAG**: بازیابی **واژگانی (کلیدواژه‌ای)** است، نه معنایی. برای دادهٔ کم و فارسی کاملاً کافی است. اگر بعداً خواستید جست‌وجوی معنایی دقیق‌تر داشته باشید، می‌توان با **Cloudflare Vectorize** ارتقا داد.
- **داشبورد**: شمارش‌معکوس‌ها (حقوق، پاداش، تولد، سالگرد، وام) و فید مناسبت‌ها با تقویم جلالی به‌صورت بومی در TypeScript پیاده شده‌اند و از روی داده‌های جدول `employees` محاسبه می‌شوند.
- **به‌روزرسانی کارمندان**: هر بار که `plist.xlsx` تغییر کرد، گام ۳ را دوباره اجرا کنید (`INSERT OR REPLACE` رکوردها را به‌روزرسانی می‌کند).
- **دامنهٔ اختصاصی**: از بخش Custom domains در پروژهٔ Pages قابل افزودن است.

## نگاشت مسیرهای API (همگی هم‌مبدأ با فرانت)
| مسیر | متد | فایل |
|------|-----|------|
| `/api/auth/login` | POST | `functions/api/auth/login.ts` |
| `/api/auth/session` | GET | `functions/api/auth/session.ts` |
| `/api/auth/profile` | GET | `functions/api/auth/profile.ts` |
| `/api/auth/logout` | POST | `functions/api/auth/logout.ts` |
| `/api/auth/conversations` | GET | `functions/api/auth/conversations.ts` |
| `/api/auth/countdown-dates` | GET | `functions/api/auth/countdown-dates.ts` |
| `/api/auth/celebrations` | GET | `functions/api/auth/celebrations.ts` |
| `/api/auth/org-positions` | POST | `functions/api/auth/org-positions.ts` |
| `/ask` | POST | `functions/ask.ts` |
| `/status` | GET | `functions/status.ts` |
