import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../platform-auth';

/**
 * מייצר את ה-hash של סיסמת אדמין הפלטפורמה.
 *
 *   pnpm admin:hash
 *
 * הסיסמה עצמה לא נשמרת בשום מקום ולא נשלחת לשום מקום — היא נקראת,
 * מגובבת, ונשכחת. מה שמודפס הוא מה שנכנס ל-Vercel.
 *
 * עובד גם כשמזינים ידנית וגם כשמזרימים שלוש שורות ב-pipe, כדי שאפשר
 * יהיה לבדוק אותו בלי אדם שיושב מול המסך.
 */

const MIN_LENGTH = 12;
const PROMPTS = ['כתובת מייל לאדמין: ', 'סיסמה: ', 'שוב, לאימות: '];

const answers = await ask(PROMPTS);
// **הסיסמה נלקחת בדיוק כפי שהוקלדה.** חיתוך רווחים כאן היה מייצר hash
// של מחרוזת אחרת מזו שהדפדפן שולח בהתחברות — ואז סיסמה שמסתיימת ברווח
// נועלת את המשתמש בלי שום הודעת שגיאה שתסביר למה.
const [rawEmail = '', password = '', again = ''] = answers;
const email = rawEmail.trim();

fail(!email.includes('@'), 'כתובת מייל לא תקינה.');
fail(password !== password.trim(), 'הסיסמה מתחילה או מסתיימת ברווח. זה עובד, אבל קל לטעות בו — עדיף בלי.');
fail(password !== again, 'הסיסמאות אינן זהות.');
fail(
  password.length < MIN_LENGTH,
  `סיסמה קצרה מ-${MIN_LENGTH} תווים. זו הדלת היחידה שנפתחת בסיסמה במערכת הזו.`,
);

console.log(`
✓ מוכן. הוסיפו את שני המשתנים האלה ב-Vercel (Production):

PLATFORM_ADMIN_EMAIL=${email}
PLATFORM_ADMIN_PASSWORD_HASH=${await hashPassword(password)}

הסיסמה עצמה אינה נשמרת. אבדה — מריצים שוב ומחליפים את ה-hash.
מחיקת שני המשתנים מכבה את קונסולת הניהול לגמרי: /admin יחזיר 404.
`);

function ask(prompts: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
    const collected: string[] = [];

    if (stdin.isTTY) stdout.write(prompts[0]!);

    rl.on('line', (line) => {
      collected.push(line);
      if (collected.length >= prompts.length) return rl.close();
      if (stdin.isTTY) stdout.write(prompts[collected.length]!);
    });
    rl.on('close', () => resolve(collected));
  });
}

function fail(condition: boolean, message: string): void {
  if (!condition) return;
  console.error(`\n✖ ${message}`);
  process.exit(1);
}
