# @bossi/db

מיגרציות, בידוד דיירים ושכבת השאילתות.

## שני נתיבי גישה, ורק שניים

```ts
// כל בקשה של האפליקציה. רץ תחת bossi_app עם דייר מוגדר.
await withTenant(tenantId, async (tx) => {
  const customers = await listCustomers(tx);   // בלי where tenant_id — המסד מסנן
  await publishEvent(tx, { type: 'documents.filed', customerId });
});

// פעולות שאינן שייכות לדייר. כל שימוש הוא החלטה מודעת.
await withPlatform(async (tx) => { /* מיגרציות, יצירת דייר */ });
```

**אין נתיב שלישי.** גישה ישירה ל-pool מחוץ ל-`client.ts` עוקפת את הבידוד.

## איך הבידוד מוחזק

| שכבה | מה היא מונעת |
|---|---|
| `bossi_app` בלי BYPASSRLS | האפליקציה לא יכולה לעקוף מדיניות |
| `current_tenant()` מחזיר NULL כשלא הוגדר | בקשה בלי דייר רואה אפס שורות — **כשל סגור** |
| `force row level security` | בעל הסכמה כפוף למדיניות. בלי זה הבידוד הוא לכאורה בלבד |
| `set_config(..., true)` עם פרמטר | המזהה לא משורשר ל-SQL, ונעלם ב-COMMIT |
| FK מורכב עם `tenant_id` | בדיקת FK מתעלמת מ-RLS — ראה [ADR-005](../../docs/06-decisions.md) |
| `events`: SELECT ו-INSERT בלבד | append-only כהרשאה, לא כמוסכמה |
| ל-`tenants` אין הרשאת כתיבה | דייר לא יכול ליצור או לשנות דיירים |

## בדיקות

`isolation.test.ts` **מנסה לשבור** את הבידוד: קריאה חוצה, כתיבה בשם דייר אחר,
עדכון ומחיקה של שורות זרות, הצבעות FK חוצות דיירים, דליפת GUC בין בקשות,
והזרקה דרך מזהה הדייר.

`rls-coverage.test.ts` סורק את **כל** הטבלאות שקיימות בפועל ונכשל על אחת שאין
עליה RLS, FORCE, מדיניות או `tenant_id`. טבלה חדשה בספרינט 9 לא יכולה להישכח.

```bash
DATABASE_URL="postgres://…" pnpm vitest run packages/db
```

## מיגרציות

קדימה בלבד. שם קובץ קובע סדר, ו-checksum מונע שינוי של מיגרציה שכבר הורצה.
אין `down` — גלגול לאחור נעשה במיגרציה חדשה.

## Postgres מקומי

```bash
initdb -D /var/tmp/bossi-pgdata -U postgres --auth=trust
pg_ctl -D /var/tmp/bossi-pgdata -o "-p 55432" start
createdb -p 55432 -U postgres bossi_dev && createdb -p 55432 -U postgres bossi_test
export DATABASE_URL="postgres://postgres@127.0.0.1:55432/bossi_dev"
pnpm db:seed
```

`pgvector` נדרש רק מספרינט 6 (`chunks`). Neon כולל אותו.
