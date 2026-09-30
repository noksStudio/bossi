import { redirect } from 'next/navigation';
import { createProspect } from '@bossi/db';
import { BossiWordmark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { isIsraeliPhone, normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'מערכת ניהול ליבואנים ומפיצים',
  description:
    'גבייה, צ׳קים, הזמנות ולקוחות במקום אחד — מערכת שנבנית בדיוק לאיך שהעסק שלך עובד. אבחון תפעולי של 30 דקות, בלי עלות.',
};

const PAINS = [
  { quote: 'אני לא בטוח מי חייב לי כמה.', cost: 'גבייה לפי תחושה, וכסף שנתקע אצל לקוחות בלי שמישהו שם לב.' },
  { quote: 'הצ׳קים משגעים אותי.', cost: 'מועד הפקדה שנשכח, צ׳ק שחזר, ושעות של התאמות ידניות.' },
  { quote: 'הסחורה כבר יצאה — והלקוח כבר לא משלם.', cost: 'הפסד ישיר, לפעמים של עשרות אלפי שקלים, כי אף אחד לא בדק את המסגרת לפני.' },
  { quote: 'כל היום מתקשרים לשאול איפה ההזמנה.', cost: 'המשרד עונה לטלפונים במקום לעבוד, והזמנות מוואטסאפ הולכות לאיבוד.' },
  { quote: 'אין לי מושג איפה החשבונית ההיא.', cost: 'חיפושים, ויכוחים עם לקוחות, ותלות באדם אחד שזוכר איפה הכל.' },
];

const OUTCOMES = [
  'רואים בכל רגע מי חייב כמה, וממי כדאי לגבות קודם.',
  'הצ׳קים מותאמים לתקבולים, ומועדי ההפקדה לא נשכחים.',
  'מסגרת האשראי של כל לקוח מול העיניים, והזמנות עוברות אישור לפני שהסחורה יוצאת.',
  'הלקוחות רואים בעצמם הזמנות ויתרה, ומקבלים הודעת "מוכן" בוואטסאפ בלחיצה אחת.',
  'כל מסמך מתויק ונמצא בחיפוש של שנייה.',
];

const STEPS = [
  { title: 'אבחון — 30 דקות', body: 'ממפים יחד איפה הולכים כסף וזמן. בלי עלות ובלי התחייבות.' },
  { title: 'אפיון', body: 'מגדירים בדיוק מה המערכת צריכה לעשות אצלכם — לפי איך שאתם עובדים היום, לא להפך.' },
  { title: 'הקמה', body: 'המערכת נבנית ומוזנת בנתונים שלכם. מתחילים מהחלק שכואב הכי הרבה.' },
  { title: 'ליווי', body: 'אני שם בהטמעה בעצמי, עד שהצוות עובד איתה בפועל — לא רק עד שהיא "עלתה".' },
];

/** מה הכי כואב — נשמר על הליד, כדי ללמוד אילו כאבים באמת מביאים פניות. */
const PAIN_OPTIONS: Record<string, string> = {
  debts: 'לא ברור מי חייב לי כמה',
  checks: 'מעקב צ׳קים והפקדות',
  credit: 'סחורה יוצאת ללקוחות בחריגת אשראי',
  orders: 'הזמנות בוואטסאפ ו"איפה ההזמנה שלי"',
  owner: 'הכל עובר דרכי',
  docs: 'מסמכים שאי אפשר למצוא',
  other: 'משהו אחר',
};

const UTM_KEYS = ['utm_source', 'utm_campaign', 'utm_content'] as const;

type Video = { kind: 'youtube' | 'file'; src: string };

/**
 * הסרטון מגיע ממשתנה סביבה ולא מהקוד — מחליפים סרטון בלי דיפלוי של קוד.
 * YouTube (כולל Shorts) או קובץ mp4/webm ישיר; כל דבר אחר מתעלמים ממנו,
 * והעמוד עובד גם בלי סרטון בכלל.
 */
function landingVideo(raw: string | undefined): Video | null {
  if (!raw?.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'm.youtube.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{6,20}$/.test(id)) {
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: 'file', src: url.toString() };
  return null;
}

/**
 * דף נחיתה של המשפך: סרטון גירוי בפרסום → כאן (סרטון + מלל) → השארת
 * פרטים → שיחת טלפון. בלי ניווט בכוונה — יציאה אחת בלבד, הטופס.
 * פנייה נכנסת ישר לתיקיית הלידים ב-/admin/leads עם מקור "דף נחיתה".
 */
export default async function ImportersLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const video = landingVideo(process.env['LANDING_VIDEO_URL']);

  async function submit(formData: FormData) {
    'use server';
    // מלכודת לבוטים: שדה שמוסתר מבני אדם. מי שממלא אותו מקבל "תודה" ולא נשמר.
    if (String(formData.get('website') ?? '')) redirect('/importers?sent=1#form');

    const contact = String(formData.get('contact') ?? '').trim().slice(0, 120);
    const business = String(formData.get('business') ?? '').trim().slice(0, 160);
    const phone = normalizePhone(String(formData.get('phone') ?? ''));
    if (!contact || !isIsraeliPhone(phone)) redirect('/importers?error=1#form');

    const pain = PAIN_OPTIONS[String(formData.get('pain') ?? '')];
    const campaign = UTM_KEYS
      .map((k) => String(formData.get(k) ?? '').trim().slice(0, 80))
      .filter(Boolean)
      .join(' / ');
    const note = [
      `איש קשר: ${contact}`,
      pain ? `הכי כואב: ${pain}` : null,
      campaign ? `קמפיין: ${campaign}` : null,
    ].filter(Boolean).join(' · ');

    await createProspect({ name: business || contact, phone, source: 'landing', note });
    redirect('/importers?sent=1#form');
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <span className="text-primary"><BossiWordmark /></span>
        <ThemeToggle />
      </header>

      <main className="flex-1">
        {/* ── הוק ─────────────────────────────────────────────────── */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-5 pb-14 pt-8 text-center sm:pt-14">
            <p className="mb-4 text-[0.82rem] font-medium tracking-wide text-muted">ליבואנים, מפיצים ויצרנים</p>
            <h1 className="text-[2.2rem] leading-[1.15] sm:text-[3rem]">
              כמה חייבים לך
              <br />
              <span style={{ color: 'var(--accent)' }}>ברגע זה?</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[1.05rem] leading-relaxed text-secondary">
              אם התשובה מתחילה ב&quot;רגע, אני אבדוק&quot; — העסק שלך רץ על אקסל, וואטסאפ והזיכרון שלך.
              אני בונה ליבואנים ומפיצים מערכת אחת, מותאמת בדיוק לאיך שהם עובדים: גבייה, צ׳קים,
              הזמנות ולקוחות — כדי שהעסק יפסיק לעבור רק דרכך.
            </p>

            {video ? (
              <div className="mt-9 overflow-hidden rounded-lg border border-hairline bg-sunken">
                {video.kind === 'youtube' ? (
                  <iframe
                    src={video.src}
                    title="איך זה נראה"
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={video.src} controls playsInline preload="metadata" className="aspect-video w-full" />
                )}
              </div>
            ) : null}

            <CtaButton />
          </div>
        </section>

        {/* ── הכאב ────────────────────────────────────────────────── */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-5xl px-5 py-14">
            <h2 className="text-center text-[1.8rem] leading-tight sm:text-[2.2rem]">זה נשמע מוכר?</h2>
            <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PAINS.map((p) => (
                <li key={p.quote} className="rounded-lg border border-hairline bg-raised p-5">
                  <p className="text-[1.05rem] font-medium">&quot;{p.quote}&quot;</p>
                  <p className="mt-2 text-[0.9rem] leading-relaxed text-secondary">{p.cost}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── הכאב שמתחת ─────────────────────────────────────────── */}
        <section className="border-b border-hairline bg-sunken">
          <div className="mx-auto max-w-2xl px-5 py-14 text-center">
            <h2 className="text-[1.8rem] leading-tight sm:text-[2.2rem]">ואם תיעלם לשבועיים — מה ייתקע?</h2>
            <p className="mt-5 text-[1.02rem] leading-relaxed text-secondary">
              ברוב העסקים שאני פוגש, התשובה היא &quot;הכל&quot;. לא כי הצוות לא טוב — אלא כי כל המידע
              נמצא בראש של אדם אחד. זה לא רק מעייף, זו תקרה: אי אפשר לגדול כשכל החלטה עוברת דרכך.
            </p>
          </div>
        </section>

        {/* ── הפתרון ──────────────────────────────────────────────── */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-5 py-14">
            <h2 className="text-center text-[1.8rem] leading-tight sm:text-[2.2rem]">איך זה נראה כשזה מסודר</h2>
            <ul className="mt-8 space-y-3">
              {OUTCOMES.map((o) => (
                <li key={o} className="flex items-start gap-3 rounded-lg border border-hairline bg-raised p-4 text-[0.98rem]">
                  <span aria-hidden="true" className="mt-0.5 font-medium" style={{ color: 'var(--accent)' }}>✓</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-[0.95rem] text-secondary">
              והכל נבנה לפי איך שאתם כבר עובדים — לא תוכנה כללית שצריך להתעקם סביבה.
            </p>
          </div>
        </section>

        {/* ── תהליך ───────────────────────────────────────────────── */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-5xl px-5 py-14">
            <h2 className="text-center text-[1.8rem] leading-tight sm:text-[2.2rem]">איך העבודה איתי נראית</h2>
            <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-lg border border-hairline bg-raised p-5">
                  <span className="text-[0.8rem] font-medium" style={{ color: 'var(--accent)' }}>שלב {i + 1}</span>
                  <p className="mt-1 text-[1.02rem] font-medium">{s.title}</p>
                  <p className="mt-2 text-[0.9rem] leading-relaxed text-secondary">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── טופס ────────────────────────────────────────────────── */}
        <section id="form" className="scroll-mt-6">
          <div className="mx-auto max-w-md px-5 py-14">
            {params['sent'] ? (
              <div className="rounded-lg border border-hairline bg-raised p-6 text-center">
                <h2 className="text-[1.5rem]">קיבלתי, תודה.</h2>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-secondary">
                  אחזור אליך תוך יום עסקים כדי לתאם את האבחון.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-center text-[1.6rem] leading-tight sm:text-[1.9rem]">
                  בוא נבדוק איפה העסק שלך מאבד כסף וזמן
                </h2>
                <p className="mt-3 text-center text-[0.95rem] leading-relaxed text-secondary">
                  אבחון תפעולי של 30 דקות, בטלפון או בזום. גם אם לא נעבוד יחד — תצא עם תמונה ברורה.
                </p>

                <form action={submit} className="mt-7 space-y-3.5">
                  <Field label="שם" name="contact" required autoComplete="name" />
                  <Field label="טלפון" name="phone" type="tel" required autoComplete="tel" dir="ltr" pattern="[0-9+\-\s()]{9,20}" />
                  <Field label="שם העסק" name="business" autoComplete="organization" />
                  <label className="block">
                    <span className="block text-[0.85rem] font-medium">מה הכי כואב לך היום?</span>
                    <select
                      name="pain"
                      defaultValue=""
                      className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2.5 text-[0.95rem] outline-none"
                    >
                      <option value="" disabled>בחירה</option>
                      {Object.entries(PAIN_OPTIONS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <div aria-hidden="true" className="hidden">
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </div>
                  {UTM_KEYS.map((k) => (params[k] ? <input key={k} type="hidden" name={k} value={params[k]} /> : null))}

                  {params['error'] ? (
                    <p className="text-[0.85rem]" style={{ color: 'var(--danger)' }}>
                      צריך שם ומספר טלפון תקין.
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="w-full rounded-md py-3 text-[1rem] font-medium text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    אני רוצה אבחון
                  </button>
                  <p className="text-center text-[0.78rem] text-muted">בלי עלות, בלי התחייבות. הפרטים נשארים אצלי.</p>
                </form>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline px-5 py-6 text-center text-[0.78rem] text-muted">© Bossi</footer>
    </div>
  );
}

function CtaButton() {
  return (
    <div className="mt-9">
      <a
        href="#form"
        className="inline-block rounded-md px-6 py-3.5 text-[1rem] font-medium text-white"
        style={{ background: 'var(--accent)' }}
      >
        לאבחון תפעולי — 30 דקות, בלי עלות
      </a>
    </div>
  );
}

function Field({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-[0.85rem] font-medium">{label}</span>
      <input
        {...input}
        className="mt-1.5 w-full rounded-md border border-strong bg-raised px-3 py-2.5 text-[0.95rem] outline-none"
      />
    </label>
  );
}
