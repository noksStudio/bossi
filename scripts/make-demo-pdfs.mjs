/**
 * מייצר את מסמכי הדמו כ-PDF אמיתיים.
 *
 * דרך Chromium ולא דרך ספריית PDF: עברית ו-RTL עובדים מהקופסה, כולל
 * כיווניות מעורבת עם מספרים ואנגלית. מריצים פעם אחת, והתוצאה נשמרת ב-git.
 *
 *   node scripts/make-demo-pdfs.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = new URL('../apps/web/public/demo/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const css = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: 'Heebo','Noto Sans Hebrew','DejaVu Sans',sans-serif;
         direction: rtl; color:#16232f; background:#fff; }
  .page { width:210mm; min-height:297mm; padding:22mm 20mm; }
  .head { display:flex; justify-content:space-between; align-items:flex-start;
          border-bottom:2px solid #16232f; padding-bottom:10px; margin-bottom:22px; }
  .org { font-size:19px; font-weight:700; }
  .org small { display:block; font-size:11px; font-weight:400; color:#6d7f91; margin-top:3px; }
  .meta { text-align:left; font-size:11px; color:#4d6070; line-height:1.7; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:#6d7f91; font-size:12px; margin-bottom:20px; }
  h2 { font-size:13px; margin:20px 0 7px; }
  p, li { font-size:12px; line-height:1.85; margin:0 0 8px; }
  table { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; }
  th { background:#f4f0e9; text-align:right; padding:7px 9px; font-weight:600; border:1px solid #e9e3d8; }
  td { padding:7px 9px; border:1px solid #e9e3d8; }
  td.num, th.num { text-align:left; font-variant-numeric: tabular-nums; }
  .total { font-weight:700; background:#faf8f4; }
  .sign { display:flex; gap:40px; margin-top:42px; }
  .sign div { flex:1; border-top:1px solid #9aa8b6; padding-top:6px; font-size:11px; color:#4d6070; }
  .stamp { margin-top:26px; display:inline-block; border:2px solid #bf5f26; color:#bf5f26;
           padding:7px 16px; border-radius:4px; font-size:12px; font-weight:600; transform:rotate(-3deg); }
  .foot { margin-top:32px; border-top:1px solid #e9e3d8; padding-top:9px; font-size:10px; color:#9aa8b6; }
`;

const header = (org, sub, meta) => `
  <div class="head">
    <div class="org">${org}<small>${sub}</small></div>
    <div class="meta">${meta}</div>
  </div>`;

const foot = '<div class="foot">מסמך לדוגמה שנוצר עבור הדגמת Bossi. אינו מהווה מסמך משפטי או חשבונאי.</div>';

const rows = (items) => items.map(([d, q, p, t]) =>
  `<tr><td>${d}</td><td class="num">${q}</td><td class="num">${p}</td><td class="num">${t}</td></tr>`).join('');

const DOCS = {
  'contract.pdf': `
    ${header('לביא ושות׳ — משרד עורכי דין', 'ח״פ 514872910 · תל אביב', 'תאריך: 12.03.2024<br>מס׳ הסכם: 2024-118')}
    <h1>הסכם למתן שירותים</h1>
    <p class="sub">בין: לביא ושות׳ (״נותן השירות״) · לבין: ד. כהן עיצוב בע״מ, ח״פ 515993027 (״הלקוח״)</p>
    <h2>1. מהות ההתקשרות</h2>
    <p>נותן השירות יעניק ללקוח שירותי ייעוץ וליווי משפטי שוטף, בהיקף של עד 12 שעות בחודש קלנדרי.</p>
    <h2>2. תמורה</h2>
    <p>הלקוח ישלם סך של 3,500 ₪ בתוספת מע״מ לחודש. שעות מעבר למכסה יחויבו בתעריף של 420 ₪ לשעה.</p>
    <h2>3. תקופת ההתקשרות</h2>
    <p>ההסכם ייכנס לתוקף ביום 1.4.2024 ויעמוד בתוקפו לתקופה של 12 חודשים, ויתחדש מאליו לתקופות נוספות בנות 12 חודשים.</p>
    <h2>4. הפסקת ההתקשרות</h2>
    <p><strong>8.2</strong> כל צד רשאי להביא הסכם זה לידי סיום בהודעה מוקדמת בכתב של 60 יום, מבלי שתחול על הצד המסיים חבות כלשהי, ובלבד שיושלמו התחייבויות שנטלו קודם למועד ההודעה.</p>
    <h2>5. סודיות</h2>
    <p>כל צד מתחייב לשמור בסודיות מוחלטת כל מידע עסקי שהגיע אליו במסגרת ההתקשרות, ללא הגבלת זמן.</p>
    <div class="sign"><div>חתימת נותן השירות</div><div>חתימת הלקוח</div></div>
    <span class="stamp">נחתם 12.03.2024</span>${foot}`,

  'quote.pdf': `
    ${header('לביא ושות׳ — משרד עורכי דין', 'ח״פ 514872910', 'תאריך: 04.06.2026<br>מס׳ הצעה: 1284<br>בתוקף ל-30 יום')}
    <h1>הצעת מחיר</h1>
    <p class="sub">לכבוד: מעבדות תבל בע״מ · ח״פ 512883004</p>
    <table>
      <thead><tr><th>תיאור</th><th class="num">כמות</th><th class="num">מחיר</th><th class="num">סה״כ</th></tr></thead>
      <tbody>
        ${rows([['ליווי משפטי — סבב מימון', '1', '18,000', '18,000'],
                ['בדיקת נאותות מסמכים', '12 ש׳', '420', '5,040'],
                ['רישום סימן מסחר', '2', '2,900', '5,800']])}
        <tr class="total"><td colspan="3">סה״כ לפני מע״מ</td><td class="num">28,840</td></tr>
        <tr><td colspan="3">מע״מ 18%</td><td class="num">5,191</td></tr>
        <tr class="total"><td colspan="3">סה״כ לתשלום</td><td class="num">34,031</td></tr>
      </tbody>
    </table>
    <h2>תנאי תשלום</h2><p>שוטף + 60. ההצעה כפופה לחתימת הסכם התקשרות.</p>${foot}`,

  'invoice.pdf': `
    ${header('לביא ושות׳ — משרד עורכי דין', 'עוסק מורשה 514872910', 'תאריך: 01.08.2026<br>מס׳ חשבונית: 2291<br>מועד תשלום: 31.08.2026')}
    <h1>חשבונית מס</h1>
    <p class="sub">לכבוד: ד. כהן עיצוב בע״מ · ח״פ 515993027</p>
    <table>
      <thead><tr><th>תיאור</th><th class="num">כמות</th><th class="num">מחיר</th><th class="num">סה״כ</th></tr></thead>
      <tbody>
        ${rows([['ריטיינר חודשי — אוגוסט 2026', '1', '3,500', '3,500'],
                ['שעות מעבר למכסה', '4.5', '420', '1,890']])}
        <tr class="total"><td colspan="3">סה״כ לפני מע״מ</td><td class="num">5,390</td></tr>
        <tr><td colspan="3">מע״מ 18%</td><td class="num">970</td></tr>
        <tr class="total"><td colspan="3">סה״כ לתשלום</td><td class="num">6,360</td></tr>
      </tbody>
    </table>
    <p>תנאי תשלום: שוטף + 30. פיגור בתשלום יישא ריבית פיגורים כחוק.</p>${foot}`,

  'receipt.pdf': `
    ${header('לביא ושות׳ — משרד עורכי דין', 'עוסק מורשה 514872910', 'תאריך: 12.08.2026<br>מס׳ קבלה: 884')}
    <h1>קבלה</h1>
    <p class="sub">התקבל מאת: ד. כהן עיצוב בע״מ</p>
    <table>
      <thead><tr><th>אמצעי</th><th>פרטים</th><th class="num">סכום</th></tr></thead>
      <tbody><tr><td>העברה בנקאית</td><td>בנק לאומי, אסמכתא 4471982</td><td class="num">6,360</td></tr>
      <tr class="total"><td colspan="2">סה״כ שהתקבל</td><td class="num">6,360 ₪</td></tr></tbody>
    </table>
    <p>הקבלה מתייחסת לחשבונית מס מספר 2291.</p><span class="stamp">שולם במלואו</span>${foot}`,

  'delivery-note.pdf': `
    ${header('תבור אספקה טכנית', 'ח״פ 512440817 · אזור תעשייה קיסריה', 'תאריך: 05.09.2026<br>תעודת משלוח: 4482<br>הזמנה: 8841')}
    <h1>תעודת משלוח</h1>
    <p class="sub">לכבוד: מוסך הצפון (2011) בע״מ · ח״פ 514330117</p>
    <table>
      <thead><tr><th>מק״ט</th><th>תיאור</th><th class="num">הוזמן</th><th class="num">סופק</th></tr></thead>
      <tbody>
        ${rows([['BR-M8-40', 'בורג ראש משושה M8×40 — מגולוון', '500', '500'],
                ['NT-M8', 'אום M8 — נירוסטה 316', '500', '500'],
                ['WS-M8', 'דסקית שטוחה M8', '1,000', '800'],
                ['GR-125', 'דיסק השחזה 125 מ״מ', '24', '24']])}
      </tbody>
    </table>
    <p><strong>הערה:</strong> יתרת 200 יח׳ דסקיות תסופק במשלוח הבא (הזמנה בהמתנה).</p>
    <div class="sign"><div>חתימת השליח</div><div>חתימת המקבל + חותמת</div></div>
    <span class="stamp">נמסר 05.09.2026</span>${foot}`,

  'tax-exemption.pdf': `
    ${header('רשות המסים בישראל', 'פקיד שומה תל אביב 4', 'הונפק: 01.01.2026<br>בתוקף עד: 31.12.2026')}
    <h1>אישור על ניכוי מס במקור</h1>
    <p class="sub">לכל המעוניין</p>
    <table>
      <tbody>
        <tr><th style="width:38%">שם העוסק</th><td>ד. כהן עיצוב בע״מ</td></tr>
        <tr><th>מספר תיק ניכויים</th><td>515993027</td></tr>
        <tr><th>שיעור הניכוי</th><td><strong>פטור מלא — 0%</strong></td></tr>
        <tr><th>תוקף האישור</th><td>01.01.2026 עד 31.12.2026</td></tr>
        <tr><th>ניהול ספרים</th><td>מנהל ספרים כדין</td></tr>
      </tbody>
    </table>
    <p>אישור זה תקף עד למועד הנקוב לעיל בלבד. לאחר מועד זה על המשלם לנכות מס במקור בשיעור הקבוע בדין, אלא אם הומצא אישור חדש.</p>
    <span class="stamp">תקף עד 31.12.2026</span>${foot}`,

  'insurance.pdf': `
    ${header('מנורה מבטחים ביטוח בע״מ', 'סוכנות: א. רוזן ביטוחים', 'הונפק: 15.01.2026<br>בתוקף עד: 14.01.2027<br>פוליסה: 77-441982')}
    <h1>אישור קיום ביטוחים</h1>
    <p class="sub">מבוטח: מעבדות תבל תעשיות בע״מ · ח״פ 512883004</p>
    <table>
      <thead><tr><th>סוג הכיסוי</th><th class="num">גבול אחריות</th><th>תקופה</th></tr></thead>
      <tbody>
        <tr><td>אחריות כלפי צד שלישי</td><td class="num">4,000,000 ₪</td><td>15.01.26 – 14.01.27</td></tr>
        <tr><td>חבות מעבידים</td><td class="num">20,000,000 ₪</td><td>15.01.26 – 14.01.27</td></tr>
        <tr><td>אחריות מקצועית</td><td class="num">2,000,000 ₪</td><td>15.01.26 – 14.01.27</td></tr>
      </tbody>
    </table>
    <p>הפוליסות כוללות סעיף ויתור על זכות השיבוב כלפי מזמין השירות, ולא תבוטלנה אלא בהודעה מוקדמת של 60 יום.</p>${foot}`,

  'bank-guarantee.pdf': `
    ${header('בנק לאומי לישראל בע״מ', 'סניף 800 — עסקים', 'תאריך: 20.02.2026<br>ערבות מס׳: BG-2026-4471<br>פקיעה: 19.08.2027')}
    <h1>כתב ערבות בנקאית אוטונומית</h1>
    <p class="sub">לבקשת: י. פרידמן מתכות ובניו בע״מ · לטובת: תבור אספקה טכנית</p>
    <p>אנו ערבים בזה כלפיכם לסילוק כל סכום עד לסך של <strong>150,000 ₪</strong> (מאה וחמישים אלף שקלים חדשים).</p>
    <p>סכום הערבות יהיה צמוד למדד המחירים לצרכן, כאשר מדד הבסיס הוא מדד חודש ינואר 2026.</p>
    <p>אנו נשלם לכם כל סכום עד לסכום הערבות, תוך 7 ימים ממועד קבלת דרישתכם הראשונה בכתב, מבלי שתידרשו לנמק את דרישתכם.</p>
    <p><strong>ערבות זו תעמוד בתוקפה עד ליום 19.08.2027 ולאחר מועד זה תהיה בטלה ומבוטלת.</strong></p>
    <div class="sign"><div>חתימת מורשה חתימה</div><div>חותמת הסניף</div></div>${foot}`,

  'meeting-notes.pdf': `
    ${header('לביא ושות׳ — משרד עורכי דין', 'סיכום פנימי', 'תאריך: 28.08.2026<br>משתתפים: 3')}
    <h1>סיכום פגישת סטטוס</h1>
    <p class="sub">לקוח: טכנוסופט פתרונות תוכנה בע״מ · נוכחים: נעה לביא, איתי גרוס, רות מזרחי</p>
    <h2>נדון</h2>
    <ul>
      <li>הסכם ההפצה מול המפיץ בגרמניה — נותרו שתי הערות פתוחות בסעיף השיפוי.</li>
      <li>הלקוח מבקש להרחיב את הליווי גם לרישום פטנט. מחוץ להיקף הריטיינר הנוכחי.</li>
      <li>סבב הגיוס נדחה לרבעון הבא; אין דחיפות בבדיקת הנאותות.</li>
    </ul>
    <h2>הוחלט</h2>
    <table>
      <thead><tr><th>משימה</th><th>אחראי</th><th>יעד</th></tr></thead>
      <tbody>
        <tr><td>טיוטה מתוקנת לסעיף השיפוי</td><td>נעה</td><td>04.09.2026</td></tr>
        <tr><td>הצעת מחיר נפרדת לרישום פטנט</td><td>רות</td><td>07.09.2026</td></tr>
        <tr><td>אישור התקציב מצד הלקוח</td><td>איתי</td><td>10.09.2026</td></tr>
      </tbody>
    </table>
    <p><strong>לתשומת לב:</strong> ההרחבה לפטנטים אינה כלולה בריטיינר. יש לעגן בכתב לפני תחילת עבודה.</p>${foot}`,

  'correspondence.pdf': `
    ${header('תכתובת מייל', 'הודפס מתוך תיבת הדואר', 'הודפס: 03.09.2026')}
    <h1>התכתבות בנושא תנאי תשלום</h1>
    <table>
      <tbody>
        <tr><th style="width:20%">מאת</th><td>ניסים חדד &lt;nissim@bragim-haifa.co.il&gt;</td></tr>
        <tr><th>אל</th><td>לילך אדרי &lt;orders@demo-tavor.co.il&gt;</td></tr>
        <tr><th>נושא</th><td>בקשה להארכת תנאי תשלום</td></tr>
        <tr><th>תאריך</th><td>02.09.2026, 09:14</td></tr>
      </tbody>
    </table>
    <p>שלום לילך,</p>
    <p>בהמשך לשיחתנו — נשמח לעבור לשוטף + 60 החל מהרבעון הבא. ההיקף אצלנו גדל משמעותית ואנחנו מזמינים כמעט שבועית.</p>
    <p>מבחינתנו אין בעיה להעמיד ערבות אם נדרש.</p>
    <p>תודה, ניסים</p>
    <hr style="border:0;border-top:1px solid #e9e3d8;margin:18px 0">
    <p><strong>מענה — 02.09.2026, 16:40</strong></p>
    <p>היי ניסים, קיבלנו. נבדוק מול הנהלת חשבונות ונחזור עד סוף השבוע. בכל מקרה נצטרך אישור ניכוי מס מעודכן לשנה הנוכחית.</p>${foot}`,
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage();
// המסמכים עצמאיים לחלוטין — כל בקשה יוצאת נחסמת, כדי שהייצור יהיה
// דטרמיניסטי ולא יתלה ברשת.
await page.route('**', (route) => route.abort());
for (const [file, body] of Object.entries(DOCS)) {
  await page.setContent(
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
     <style>${css}</style></head><body><div class="page">${body}</div></body></html>`,
    { waitUntil: 'load' },
  );
  await page.pdf({ path: OUT + file, format: 'A4', printBackground: true });
  console.log('  ✓', file);
}
await b.close();
