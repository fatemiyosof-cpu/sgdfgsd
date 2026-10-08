# ARcodm Subscription Panel

ساختار پروژه عمداً بدون `public/` است:

- `AR.html` پنل اصلی
- `server.js` سرور Express
- `package.json` وابستگی‌ها
- `Dockerfile` برای Deploy
- `render.yaml` برای Render
- `data/` محل ذخیره Subscriptionها

مسیرها:
- `/` پنل
- `/health` تست سلامت
- `POST /api/subscriptions` ساخت/به‌روزرسانی ساب
- `/api/subscriptions/:id` اطلاعات ساب
- `/sub/:id` محتوای واقعی Subscription

برای Render، فایل‌ها را در ریشه Repository قرار بده و Build/Start را طبق render.yaml اجرا کن.
