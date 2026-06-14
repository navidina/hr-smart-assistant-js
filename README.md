# دستیار هوشمند منابع انسانی رایان هم‌افزا

چت‌بات سازمانی منابع انسانی که به‌صورت کامل روی **Cloudflare Pages** میزبانی می‌شود:

- **فرانت‌اند**: فایل‌های استاتیک (`index.html`, `login.html`, `profile.html`, `vendor/`).
- **بک‌اند**: توابع TypeScript در `functions/` روی Cloudflare Workers.
- **پایگاه‌داده**: Cloudflare **D1** (کارمندان، کاربران، مکالمات).
- **چت هوش مصنوعی**: اتصال به **AvalAI** (سازگار با OpenAI) به‌همراه یک لایهٔ **RAG واژگانی سبک** روی اسناد سازمان (`know.docx` / `knowledge.docx` → `lib/knowledge.json`).
- **ورود**: فعلاً نام کاربری/رمز عبور هاردکدشده برای دمو (پیش‌فرض `admin` / `rayan@1404`).

## ساختار
```
functions/        # اندپوینت‌های API (Pages Functions)
lib/              # ماژول‌های مشترک TypeScript (jwt, jalali, db, retrieval, ...)
tools/            # اسکریپت‌های محلی: ایمپورت اکسل به D1 و ساخت پایگاه دانش
vendor/           # کتابخانه‌های UI آفلاین
schema.sql        # اسکیمای D1
wrangler.toml     # پیکربندی Cloudflare Pages + بایندینگ‌ها و متغیرها
```

## استقرار و راه‌اندازی
راهنمای کامل گام‌به‌گام در **[CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)** آمده است. خلاصه:

```bash
npm install
npx wrangler login
npx wrangler d1 create smartassistant      # database_id را در wrangler.toml بگذارید
npm run db:init:remote
npx wrangler pages secret put JWT_SECRET
npx wrangler pages secret put AVALAI_API_KEY
npm run deploy
```

برای پرشدن پروفایل/داشبورد با دادهٔ واقعی، کارمندان را از `plist.xlsx` ایمپورت کنید
(`npm run employees:build-sql && npm run employees:load:remote`).
