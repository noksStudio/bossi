# 09 — משתני סביבה

תבנית מוכנה להעתקה: [`.env.example`](../.env.example).
לפיתוח מקומי — `.env.local`. לייצור — Vercel → Settings → Environment Variables.

**כלל:** כל מפתח מוגדר בנפרד ל-Production ול-Preview. Preview לעולם לא נוגע במסד
הייצור, בחשבון הסליקה האמיתי או במספר ה-WhatsApp האמיתי.

---

## נדרש עכשיו (ספרינט 1)

| משתנה | מאיפה | הערות |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | — | `https://bossi.co.il` בייצור; ב-Preview השתמשו ב-`VERCEL_URL` |
| `DATABASE_URL` | [Neon](https://neon.tech) → Connection string (Pooled) | **חייב pgvector.** Neon מומלץ: ענף DB נפרד לכל Preview |
| `DATABASE_URL_UNPOOLED` | Neon → Direct connection | מיגרציות בלבד — PgBouncer שובר `CREATE INDEX CONCURRENTLY` |

**הקמת Neon:** פרויקט חדש → אזור `eu-central-1` (פרנקפורט, קרוב ל-`fra1` של Vercel) →
`CREATE EXTENSION vector; CREATE EXTENSION pg_trgm;`

---

## ספרינט 2 — אימות

| משתנה | מאיפה |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_STAFF_COOKIE` | ברירת מחדל `bossi_staff` |

`AUTH_PORTAL_COOKIE` נכנס רק בספרינט 13 — ומוגדר **בנפרד** בכוונה. שני עולמות זהות,
שני עוגיות, שני middleware (CLAUDE.md כלל 2).

---

## ספרינט 4 — אחסון

| משתנה | מאיפה |
|---|---|
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage API Tokens |
| `R2_BUCKET` | שם הדלי |

**R2 ולא S3:** אין דמי יציאה (egress), וזה משמעותי כשמגישים מסמכים ללקוחות בפורטל.
תואם S3 API — מחליפים ל-AWS בשינוי endpoint אם צריך.

⚠️ הדלי **פרטי**. גישה רק ב-signed URL קצר-מועד. אין `R2_PUBLIC_BASE` בכוונה.

---

## ספרינט 5 — מייל נכנס ויוצא

| משתנה | מאיפה |
|---|---|
| `RESEND_API_KEY` | [Resend](https://resend.com) → API Keys |
| `MAIL_FROM` | דומיין מאומת ב-Resend (SPF + DKIM) |
| `INBOUND_EMAIL_DOMAIN` | תת-דומיין ייעודי, למשל `in.bossi.co.il` |
| `INBOUND_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 32` — מגן על `/api/cron/*` |

**זה הפיצ'ר עם יחס המאמץ/ערך הכי טוב במערכת.** כל דייר מקבל
`docs+<slug>@in.bossi.co.il`, מעביר לשם מיילים עם קבצים, וזהו.

**DNS:** רשומת MX על תת-הדומיין → הספק. לא על הדומיין הראשי, כדי לא לשבור מייל רגיל.

---

## ספרינט 7–8 — כסף

| משתנה | הערות |
|---|---|
| `INVOICING_PROVIDER` + `MORNING_API_KEY` / `MORNING_API_SECRET` | **Bossi לא מנפיקה חשבוניות.** חוק החשבוניות והקצאת המספרים מרשות המסים הם עולם רגולטורי שלם — מאצילים |
| `PAYMENTS_PROVIDER` + `CARDCOM_*` | סליקה שבה **הלקוחות של בעל העסק** משלמים לו |

לינק תשלום בכל תזכורת מקצר DSO יותר מכל נוסח. זו הסיבה שהסליקה נכנסת יחד עם הגבייה
ולא אחריה.

---

## ספרינט 10 — WhatsApp

| משתנה | הערות |
|---|---|
| `WHATSAPP_PROVIDER` · `WHATSAPP_API_KEY` · `WHATSAPP_PHONE_NUMBER_ID` | 360dialog או Twilio |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | לאימות ה-webhook הנכנס |

⚠️ **שלוש מגבלות שמשפיעות על התכנון, לא רק על הקוד:** תבניות טעונות אישור מראש
של Meta (ימים); מחוץ לחלון 24 שעות מותר לשלוח רק תבנית מאושרת; התמחור הוא לפי שיחה
ולא לפי הודעה — ולכן נכנס למודל העלות ללקוח.

---

## ספרינט 11 — OCR ו-AI

| משתנה | הערות |
|---|---|
| `OCR_PROVIDER` + פרטי הספק | **לא לבחור לפני בדיקת גל 0** — 30 מסמכים אמיתיים בעברית דרך 2–3 ספקים |
| `ANTHROPIC_API_KEY` | סיווג, חילוץ, סוכן חיפוש |
| `EMBEDDINGS_PROVIDER` + מפתח | איכות בעברית משתנה מאוד — לבדוק אמפירית עם recall@5 |

Tesseract בעברית חלש. המועמדים הריאליים הם Google Document AI ו-Azure Document
Intelligence.

---

## ספרינט 12 — מנויי Bossi

| משתנה | הערות |
|---|---|
| `BILLING_PROVIDER` · `BOSSI_BILLING_TERMINAL` · `BOSSI_BILLING_API_KEY` | הגבייה **שלנו** מבעל העסק |

**נפרד לחלוטין מ-`PAYMENTS_*`.** שני עולמות כספיים שלא נפגשים בשום טבלה ובשום מפתח.
ערבוב ביניהם הוא באג שמחייב לקוח בכסף של מישהו אחר.

---

## אופציונלי

| משתנה | מתי |
|---|---|
| `SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_DSN` | מומלץ מהרגע שיש משתמש אמיתי ראשון |
| `BOSSI_DEFAULT_PLAN` | חבילת ברירת מחדל לדייר חדש |
| `BOSSI_SEED_DEMO` | נתוני דמו. **`false` בייצור, תמיד** |

---

## הגדרות Vercel

הפרויקט מחובר. שדות שצריך לוודא ב-Settings:

| שדה | ערך |
|---|---|
| Framework | Next.js |
| Root Directory | **שורש הריפו** — `vercel.json` מטפל במונורפו |
| Build Command | מ-`vercel.json`: `pnpm --filter @bossi/web build` |
| Node.js Version | 22.x |
| Region | `fra1` — קרוב לישראל ולמסד ב-eu-central |

`vercel.json` כבר מגדיר את חמש משימות ה-cron. הן מוגנות ב-`CRON_SECRET`, אז ללא
המשתנה הזה הן יחזירו 401 (וזו ההתנהגות הנכונה).

---

## היגיינת סודות

- **אף מפתח לא נכנס ל-git.** `.env.local` ב-`.gitignore`; רק `.env.example` נשמר.
- **סיבוב מפתחות אחרי כל עזיבה** של מי שהייתה לו גישה.
- **`NEXT_PUBLIC_*` נחשף לדפדפן.** מפתח שדולף לשם נחשב פרוץ. אין שם סודות.
- **מפתחות נפרדים ל-Preview.** מפתח ייצור בסביבת Preview = מייל אמיתי ללקוח אמיתי
  מבדיקה של בוקר.

---

## משימות מתוזמנות במסלול Hobby

Vercel Hobby מגביל ל-**cron יומי אחד לכל היותר לכל נתיב**. `vercel.json` מוגדר
בהתאם — שלוש משימות יומיות בלבד:

| נתיב | שעה (UTC) | תפקיד |
|---|---|---|
| `/api/cron/daily-scan` | 04:00 | תוקף מסמכים, שחיקת ריטיינר, חידושים, איחורים, צבירת מדידה |
| `/api/cron/dunning` | 06:00 | סבב סולם דחיפה |
| `/api/cron/morning-digest` | 04:00 | דייג'סט הבוקר |

### מה שהיה אמור לרוץ תכופות — ולמה זה בכלל לא צריך cron

**קליטת מסמכים לא נסקרת כל חמש דקות. היא נדחפת.** ספק המייל הנכנס שולח webhook
ל-`/api/inbound/email` ברגע שמייל מגיע — מה שגם מהיר יותר (שניות במקום דקות) וגם
זול יותר. הפולינג המקורי היה תכנון פחות טוב, לא רק חריגה ממסלול.

אותו דבר לגבי סליקה, WhatsApp וסנכרון ERP: כולם דוחפים אלינו.

**צבירת המדידה** מתבצעת פעמיים: כתיבה מיידית ל-`usage_events` בזמן הצריכה,
וצבירה יומית ל-`usage_rollups`. מסך "החבילה שלי" קורא את שניהם ומציג מצב עדכני —
בלי צורך בצבירה שעתית.

### אם בכל זאת יידרש תזמון תכוף

שלוש דרכים, לפי הסדר:

1. **Vercel Pro** — 20 $/חודש, cron בכל תדירות. הכי פשוט.
2. **GitHub Actions** — `schedule` בכל תדירות, קורא ל-endpoint עם `CRON_SECRET`.
   חינם, ומספיק לכל מה שנצטרך בשנה הראשונה.
3. **Upstash QStash / cron-job.org** — מתזמן חיצוני שקורא לאותם endpoints.

הנתיבים עצמם אדישים למי שקרא להם: הם מאומתים ב-`CRON_SECRET` ואידמפוטנטיים,
ולכן מעבר בין השלוש הוא שינוי הגדרה ולא שינוי קוד.
