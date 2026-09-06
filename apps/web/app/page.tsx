import { SiteHeader } from '@/components/site/header';
import { ProductPreview } from '@/components/site/product-preview';
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
        <Modules />
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
          <h1 className="text-[2.35rem] leading-[1.15] sm:text-[3rem] lg:text-[3.35rem]">
            כל שקל שמגיע לך,
            <br />
            וכל מסמך שמוכיח אותו —
            <br />
            <span style={{ color: 'var(--accent)' }}>במקום אחד.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-secondary">
            Bossi מחברת את הלקוחות, הריטיינרים, המסמכים והגבייה לציר זמן אחד.
            מה שנפל בין הכיסאות — מפסיק ליפול.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#pricing"
              className="rounded-md px-5 py-3 text-[0.95rem] font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              להתחיל מ־497 ₪ לחודש
            </a>
            <a
              href="#how"
              className="rounded-md border border-strong px-5 py-3 text-[0.95rem] font-medium"
            >
              לראות איך זה עובד
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-hairline pt-7">
            {[
              { k: 'ריטיינרים', v: 'בלי שחיקה' },
              { k: 'גבייה', v: 'עם ראיות' },
              { k: 'מסמכים', v: 'שמוצאים את עצמם' },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-xs text-muted">{s.k}</dt>
                <dd className="mt-0.5 text-[0.95rem] font-medium">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Problem */

const QUOTES = [
  {
    q: 'שכחתי שהריטיינר של דני עולה בינואר. עבדתי לו שנה שלמה במחיר של 2023.',
    who: 'בעל סוכנות דיגיטל, 9 עובדים',
    cost: '≈ 18,000 ₪ בשנה',
  },
  {
    q: 'הוא טוען שסיכמנו אחרת. אני יודע שיש לי את זה בכתב — רק לא זוכר איפה.',
    who: 'עורך דין, משרד בוטיק',
    cost: 'שעתיים חיפוש, וויתור על הטענה',
  },
  {
    q: 'עשיתי לו החודש עוד שלושה דברים מחוץ לריטיינר. לא חייבתי. לא נעים.',
    who: 'יועצת שיווק עצמאית',
    cost: '≈ 2,400 ₪ בחודש',
  },
  {
    q: 'הזמנה נכנסה בוואטסאפ, הקלדתי לחשבשבת, טעיתי בכמות. הלקוח קיבל חצי.',
    who: 'מנהל תפעול, יבואן מוצרי חשמל',
    cost: 'משלוח חוזר + לקוח כועס',
  },
  {
    q: 'יש לי 180 אלף בחובות פתוחים ואני לא יודע על מי להתקשר קודם.',
    who: 'בעל מפעל קטן',
    cost: 'תזרים תקוע',
  },
];

function Problem() {
  return (
    <section id="problem" className="border-b border-hairline bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">
            זה לא חוסר סדר. זו דליפה כספית.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            אף בעל עסק לא אומר &laquo;אין לי CRM&raquo;. הוא אומר משפטים כאלה — וכל אחד מהם
            הוא כסף שיצא מהכיס.
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
                <span className="tnum shrink-0 font-medium" style={{ color: 'var(--danger)' }}>
                  {item.cost}
                </span>
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
  { t: 'חוזה נחתם', k: 'ראיה', d: 'נקלט מהמייל, מסווג ומתויק אוטומטית' },
  { t: 'ריטיינר נפתח', k: 'התחייבות', d: 'מכסה, תעריף חריגה, מועד חידוש' },
  { t: 'נצרכות שעות', k: 'שחיקה', d: 'ב־15 לחודש: ״78% נוצלו, יסיים ב־156%״' },
  { t: 'חשבונית מונפקת', k: 'חוב', d: 'דרך מערכת החשבוניות שכבר יש לך' },
  { t: 'עובר את המועד', k: 'סיכון', d: 'לפי הדפוס של הלקוח, לא לפי לוח שנה' },
  { t: 'תזכורת נשלחת', k: 'פעולה', d: 'עם החוזה ותעודת המשלוח מצורפים' },
];

function HowItWorks() {
  return (
    <section id="how" className="border-b border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">הכול חי על ציר זמן אחד</h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            Monday יודע משימות. Drive יודע קבצים. מערכת החשבוניות יודעת כסף.
            אף אחד מהם לא יודע שהחוב הזה נשען על החוזה ההוא —{' '}
            <strong className="font-semibold text-primary">וזה כל ההבדל.</strong>
          </p>
        </div>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {CHAIN.map((step, i) => (
            <li key={step.t} className="bg-surface p-5">
              <div className="flex items-center gap-2.5">
                <span className="tnum text-xs text-muted">0{i + 1}</span>
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

/* ─────────────────────────────────────────────────────────── Modules */

const MODULE_CARDS = [
  { id: 'documents', name: 'מסמכים', d: 'קליטה ממייל, וואטסאפ וסריקה. סיווג, תיוק ומעקב תוקף.' },
  { id: 'search', name: 'חיפוש', d: 'שאלה בעברית — תשובה עם ציטוט מעמוד וסעיף.' },
  { id: 'billing', name: 'חיוב', d: 'חשבוניות ותקבולים, מחוברים למערכת שכבר יש לך.' },
  { id: 'collections', name: 'גבייה', d: 'תעדוף לפי חריגה, סולם דחיפה, הבטחות תשלום.' },
  { id: 'retainers', name: 'ריטיינרים', d: 'תחזית שחיקה, תעריף שעה אפקטיבי, ראדאר חידושים.' },
  { id: 'catalog', name: 'קטלוג', d: 'מוצרים ומחירון נפרד לכל לקוח.' },
  { id: 'inventory', name: 'מלאי', d: 'מלאי זמין להבטחה, הקצאה, סנכרון ERP.' },
  { id: 'orders', name: 'הזמנות', d: 'עגלה, אשראי ותנאי תשלום, הזמנה חוזרת חכמה.' },
  { id: 'portal', name: 'פורטל לקוחות', d: 'הלקוחות שלך מזמינים ורואים מסמכים לבד.' },
  { id: 'alerts', name: 'התראות', d: 'דייג׳סט בוקר של שלושה דברים. לא יותר.' },
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
            Bossi בנויה ממודולים שמתחברים. עורך דין מדליק מסמכים, ריטיינרים וגבייה.
            יבואן מדליק קטלוג, מלאי, הזמנות ופורטל. אותה מערכת — הרכבה אחרת.
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

/* ─────────────────────────────────────────────────────────── Pricing */

function PricingSection() {
  return (
    <section id="pricing" className="border-b border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.9rem] leading-tight sm:text-[2.3rem]">תמחור שנצמד למה שאתה באמת מפעיל</h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-secondary">
            החבילה קובעת אילו מודולים דלוקים וכמה מותר לצרוך — אחסון, מסמכים, מיילים והודעות.
            חריגה מחויבת לפי שימוש, בלי הפתעות ובלי חסימה פתאומית.
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
  { t: 'חישובי כסף בקוד, לא ב־AI', d: 'המודל מסווג ומנסח. יתרות, חריגות וסכומים מחושבים דטרמיניסטית ונבדקים.' },
];

function Trust() {
  return (
    <section className="border-b border-hairline bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <h2 className="max-w-xl text-[1.9rem] leading-tight sm:text-[2.3rem]">
          אתה מפקיד אצלנו חוזים וכסף. זה מחייב.
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
            תן לנו שעה. נראה לך איפה הכסף שלך דולף.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[1rem] leading-relaxed opacity-75">
            הדגמה על הנתונים שלך — לא על דמו. אם לא נמצא לפחות דליפה אחת שאפשר לסתום,
            נגיד לך את זה.
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
          <a href="#modules">מודולים</a>
          <a href="#pricing">מחירים</a>
          <a href="mailto:hello@bossi.co.il">צור קשר</a>
        </nav>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Bossi</p>
      </div>
    </footer>
  );
}
