import { SiteHeader } from '@/components/site/header';
import { CustomerCard } from '@/components/site/customer-card';
import { DashboardPreview } from '@/components/site/dashboard-preview';
import { SearchPreview } from '@/components/site/search-preview';
import { Pricing } from '@/components/site/pricing';
import { BossiWordmark } from '@/components/brand/logo';

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Dashboard />
        <Retrieval />
        <Modules />
        <Money />
        <PricingSection />
        <Trust />
        <Cta />
      </main>
      <Footer />
    </>
  );
}

/* ───────────────────────────────────────────────────────────── Hero */

function Hero() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div>
          <p className="mb-5 text-[0.8rem] font-medium tracking-wide text-muted">מערכת הפעלה לעסק</p>
          <h1 className="text-[2.35rem] leading-[1.15] sm:text-[3rem] lg:text-[3.3rem]">
            כל מה שאתה יודע
            <br />
            על הלקוחות שלך —
            <br />
            <span style={{ color: 'var(--accent)' }}>במקום אחד.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-secondary">
            Bossi אוספת את המסמכים, אנשי הקשר וההיסטוריה של כל לקוח לתמונה אחת,
            ומסך אחד שמראה לך מה קורה. בלי לחפש, בלי לשאול מי יודע.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#pricing"
              className="rounded-md px-5 py-3 text-[0.95rem] font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              להתחיל מ־497 ₪ לחודש
            </a>
            <a href="#how" className="rounded-md border border-strong px-5 py-3 text-[0.95rem] font-medium">
              לראות איך זה עובד
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-hairline pt-7">
            {[
              { k: 'ריכוז', v: 'הכול נכנס לבד' },
              { k: 'שליפה', v: 'תשובה עם מקור' },
              { k: 'סדר', v: 'מסך שמארגן' },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-xs text-muted">{s.k}</dt>
                <dd className="mt-0.5 text-[0.95rem] font-medium">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <CustomerCard />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Problem */

const QUOTES = [
  {
    q: 'המידע על הלקוח מפוזר בין וואטסאפ, מייל, דרייב, ואצבע אחת בראש שלי.',
    who: 'בעל סוכנות דיגיטל, 9 עובדים',
    cost: 'כל יום מחדש',
  },
  {
    q: 'לקח לי ארבעים דקות למצוא את ההצעה שהוא אישר. בסוף ויתרתי והתקשרתי לשאול.',
    who: 'עורך דין, משרד בוטיק',
    cost: '40 דק׳',
  },
  {
    q: 'מישהי במשרד יודעת איפה זה. אני לא.',
    who: 'מנהל תפעול, יבואן מוצרי חשמל',
    cost: 'תלוי באדם אחד',
  },
  {
    q: 'עובד עזב, וחצי מהידע על הלקוחות שלו הלך איתו.',
    who: 'בעלת משרד רואי חשבון',
    cost: 'לא ניתן לשחזור',
  },
  {
    q: 'שאלו אותי מה מצב הלקוח. לא ידעתי מאיפה להתחיל לענות.',
    who: 'בעל מפעל קטן',
    cost: 'אין תמונה',
  },
];

function Problem() {
  return (
    <section id="problem" className="border-b border-hairline bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">
            המידע קיים. הוא פשוט לא במקום אחד.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            אף בעל עסק לא אומר &laquo;אין לי CRM&raquo;. הוא אומר משפטים כאלה — וכולם
            אותה בעיה: הידע קיים בעסק, אבל אי אפשר להגיע אליו.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {QUOTES.map((item, i) => (
            <figure
              key={item.q}
              className={`flex flex-col rounded-lg border border-hairline bg-raised p-5 ${
                i === 0 ? 'lg:col-span-2' : ''
              }`}
            >
              <blockquote
                className={`leading-relaxed ${i === 0 ? 'text-[1.15rem]' : 'text-[0.98rem]'}`}
                style={i === 0 ? { fontFamily: 'var(--font-display)' } : undefined}
              >
                &ldquo;{item.q}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3 text-xs">
                <span className="text-muted">{item.who}</span>
                <span className="shrink-0 font-medium text-secondary">{item.cost}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── How */

const CHAIN = [
  { t: 'המידע נכנס', k: 'ריכוז', d: 'מייל ייעודי, וואטסאפ, סריקה, גרירה. מכל מקום שהוא כבר מגיע ממנו' },
  { t: 'נוחת על הלקוח הנכון', k: 'ריכוז', d: 'מזוהה, מסווג ומתויק לבד. מה שלא בטוח — שלושה כפתורים' },
  { t: 'הכול על ציר זמן אחד', k: 'סדר', d: 'מסמך, שיחה, הזמנה וחשבונית — ברצף אחד לכל לקוח' },
  { t: 'שואלים ומקבלים', k: 'שליפה', d: 'שאלה בעברית, תשובה עם ציטוט מעמוד וסעיף' },
  { t: 'הדשבורד מסדר', k: 'סדר', d: 'מה דורש אותך היום, ומי נשכח' },
  { t: 'וגם הכסף מסתדר', k: 'תוצאה', d: 'ריטיינרים וגבייה יושבים על אותו מידע ומפסיקים לדלוף' },
];

function HowItWorks() {
  return (
    <section id="how" className="border-b border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">מהפיזור לתמונה אחת</h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            אתה לא צריך לשנות איך אתה עובד. המידע ממשיך להגיע כמו שהוא מגיע היום —
            Bossi רק דואגת שהוא ינחת במקום הנכון,{' '}
            <strong className="font-semibold text-primary">ושתמצא אותו כשתצטרך.</strong>
          </p>
        </div>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {CHAIN.map((step, i) => (
            <li key={step.t} className="bg-surface p-5">
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-muted">0{i + 1}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[0.68rem] font-medium"
                  style={{ background: 'var(--accent-quiet)', color: 'var(--accent)' }}
                >
                  {step.k}
                </span>
              </div>
              <h3 className="mt-2.5 text-[1.05rem]">{step.t}</h3>
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-secondary">{step.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── Dashboard */

function Dashboard() {
  return (
    <section id="dashboard" className="border-b border-hairline bg-sunken">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-20">
        <div>
          <p className="mb-4 text-[0.8rem] font-medium tracking-wide text-muted">סדר</p>
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">
            מסך אחד שאומר לך מה קורה
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            לא עוד לוח מלא בגרפים שאף אחד לא פותח. הדשבורד של Bossi עונה על שלוש
            שאלות בלבד — <strong className="font-semibold text-primary">מה נכנס, מה דורש אותי, ומי נשכח.</strong>
          </p>

          <ul className="mt-7 space-y-4">
            {[
              { t: 'שלושה דברים, לא שלושים', d: 'רק מה שבאמת דורש החלטה היום. אם הכול בולט, שום דבר לא בולט' },
              { t: 'כל שורה נושאת פעולה', d: 'תזכורת, בקשה, דחייה לשבוע. התראה בלי כפתור היא רעש' },
              { t: '״נכנס היום״', d: 'מה שהמערכת תייקה לבד, ולאיזה לקוח. ככה רואים שהריכוז עובד' },
              { t: 'מי שנשכח', d: 'לקוח קבוע שלא דיברת איתו חודשיים — לפי הדפוס שלו, לא לפי לוח שנה' },
            ].map((f) => (
              <li key={f.t} className="border-t border-hairline pt-3.5">
                <h3 className="text-[1rem]">{f.t}</h3>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-secondary">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── Retrieval */

function Retrieval() {
  return (
    <section id="search" className="border-b border-hairline">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <SearchPreview />

        <div>
          <p className="mb-4 text-[0.8rem] font-medium tracking-wide text-muted">שליפה</p>
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">
            שאלה בעברית. תשובה עם מקור.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            לא רשימת קבצים שצריך לפתוח אחד-אחד. Bossi עונה על השאלה ומראה בדיוק
            מאיפה — איזה מסמך, איזה עמוד, איזה סעיף.
          </p>

          <ul className="mt-7 space-y-4">
            {[
              { t: 'מחפש גם מה שכתוב אחרת', d: '״ביטול״ ימצא גם ״הפסקת התקשרות״. ומספר חוזה מדויק יימצא כמספר' },
              { t: 'בתוך מסמכים סרוקים', d: 'חוזה מצולם בטלפון נקרא ונכנס לחיפוש כמו כל טקסט' },
              { t: 'תמיד עם ציטוט', d: 'בלי מקור אין אמון — ובלי אמון לא תסמוך על זה בוויכוח מול לקוח' },
            ].map((f) => (
              <li key={f.t} className="border-t border-hairline pt-3.5">
                <h3 className="text-[1rem]">{f.t}</h3>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-secondary">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Modules */

const MODULE_CARDS = [
  { id: 'customers', name: 'לקוחות', d: 'כרטיס אחד לכל לקוח: אנשי קשר עם תפקידים, מסמכים, היסטוריה.' },
  { id: 'documents', name: 'מסמכים', d: 'קליטה ממייל, וואטסאפ וסריקה. סיווג, תיוק ומעקב תוקף.' },
  { id: 'search', name: 'חיפוש', d: 'שאלה בעברית — תשובה עם ציטוט מעמוד וסעיף.' },
  { id: 'alerts', name: 'התראות', d: 'דייג׳סט בוקר של שלושה דברים. לא יותר.' },
  { id: 'portal', name: 'פורטל לקוחות', d: 'הלקוחות רואים מסמכים ומזמינים בעצמם.' },
  { id: 'billing', name: 'חיוב', d: 'חשבוניות ותקבולים, מחוברים למערכת שכבר יש לך.' },
  { id: 'collections', name: 'גבייה', d: 'תעדוף לפי חריגה, תזכורות ולינקי תשלום.' },
  { id: 'retainers', name: 'ריטיינרים', d: 'תחזית שחיקה, תעריף שעה אפקטיבי, ראדאר חידושים.' },
  { id: 'catalog', name: 'קטלוג', d: 'מוצרים ומחירון נפרד לכל לקוח.' },
  { id: 'inventory', name: 'מלאי', d: 'מלאי זמין להבטחה, הקצאה, סנכרון ERP.' },
  { id: 'orders', name: 'הזמנות', d: 'עגלה, אשראי ותנאי תשלום, הזמנה חוזרת חכמה.' },
];

function Modules() {
  return (
    <section id="modules" className="border-b border-hairline bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">
            מרכיבים את המערכת שלך, לא קונים אותה שלמה
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            כולם מתחילים מאותו מקום — לקוחות, מסמכים וחיפוש. משם מדליקים רק את מה
            שרלוונטי: עורך דין מוסיף ריטיינרים, יבואן מוסיף מלאי ופורטל.
          </p>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CARDS.map((m) => (
            <article key={m.id} className="bg-surface p-5">
              <h3 className="text-[1.05rem]">{m.name}</h3>
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-secondary">{m.d}</p>
            </article>
          ))}
        </div>

        <p className="mt-6 text-[0.88rem] text-muted">
          מודול שמכובה לא מוחק כלום. אפשר להדליק אותו בחזרה עם כל ההיסטוריה.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Money */

function Money() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="mb-4 text-[0.8rem] font-medium tracking-wide text-muted">מה שנגזר מזה</p>
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">
            כשהמידע מסודר, גם הכסף מסתדר
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            זו לא הסיבה שתתחיל להשתמש ב-Bossi. זו הסיבה שתישאר.
          </p>
        </div>

        <div className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-3">
          {[
            { t: 'ריטיינר שלא נשחק', d: 'ב־15 לחודש: ״נוצלו 78%, בקצב הזה יסיים ב־156%״. וכמה באמת יצא לך לשעה' },
            { t: 'חוב שלא נשכח', d: 'תעדוף לפי מי שחורג מהדפוס שלו, לא לפי גודל החוב. עם לינק תשלום' },
            { t: 'תזכורת עם הראיות', d: 'החוזה ותעודת המשלוח מצורפים לבד — כי הם כבר על אותו ציר זמן' },
          ].map((f) => (
            <div key={f.t} className="border-t border-strong pt-4">
              <h3 className="text-[1.02rem]">{f.t}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-secondary">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Pricing */

function PricingSection() {
  return (
    <section id="pricing" className="border-b border-hairline bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">תמחור שנצמד למה שאתה באמת מפעיל</h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            החבילה קובעת אילו מודולים דלוקים וכמה מותר לצרוך — אחסון, מסמכים, מיילים
            והודעות. חריגה מחויבת לפי שימוש, בלי הפתעות ובלי חסימה פתאומית.
          </p>
        </div>

        <div className="mt-10">
          <Pricing />
        </div>

        <p className="mt-6 text-[0.88rem] text-muted">
          כל החבילות כוללות דייר מבודד, גיבוי יומי ותיעוד גישה מלא למסמכים.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Trust */

const TRUST = [
  { t: 'בידוד ברמת מסד הנתונים', d: 'כל שאילתה עוברת דרך מדיניות בידוד דיירים. לא הסתמכות על תנאי שנזכור לכתוב.' },
  { t: 'הפרדה מלאה בין צוות ללקוחות', d: 'משתמשי הפורטל חיים בעולם זהות נפרד. גישה אחת לא זולגת לשנייה.' },
  { t: 'תיעוד צפייה במסמכים', d: 'מי פתח, מה, ומתי. תשובה מלאה גם שנתיים אחרי.' },
  { t: 'הידע נשאר בעסק', d: 'עובד עוזב — ההיסטוריה, המסמכים והסיכומים נשארים. לא בראש של אף אחד.' },
];

function Trust() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <h2 className="max-w-xl text-[1.9rem] leading-tight sm:text-[2.3rem]">
          אתה מפקיד אצלנו את הזיכרון של העסק. זה מחייב.
        </h2>
        <div className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {TRUST.map((t) => (
            <div key={t.t} className="border-t border-strong pt-4">
              <h3 className="text-[1.02rem]">{t.t}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-secondary">{t.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── CTA */

function Cta() {
  return (
    <section id="contact" className="border-b border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div
          className="rounded-lg px-7 py-12 text-center lg:px-14"
          style={{ background: 'var(--surface-inverse)', color: 'var(--text-inverse)' }}
        >
          <h2 className="mx-auto max-w-2xl text-[1.8rem] leading-tight sm:text-[2.2rem]">
            תן לנו לקוח אחד. נראה לך את הכרטיס שלו.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[1rem] leading-relaxed opacity-75">
            בחר לקוח, שלח לנו את מה שיש עליו — מיילים, קבצים, מה שתמצא. נבנה את
            הכרטיס שלו ב-Bossi ותראה איך זה נראה כשהכול במקום אחד.
          </p>
          <a
            href="mailto:hello@bossi.co.il"
            className="mt-8 inline-block rounded-md px-6 py-3 text-[0.95rem] font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            לתאם הדגמה
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Footer */

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <BossiWordmark className="text-primary" />
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[0.88rem] text-secondary">
          <a href="#problem">הבעיה</a>
          <a href="#how">איך זה עובד</a>
          <a href="#dashboard">דשבורד</a>
          <a href="#search">חיפוש</a>
          <a href="#modules">מודולים</a>
          <a href="#pricing">מחירים</a>
        </nav>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Bossi</p>
      </div>
    </footer>
  );
}
