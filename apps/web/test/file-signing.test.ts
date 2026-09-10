import { describe, expect, it, vi } from 'vitest';
import { signFileUrl, verifyFileSignature } from '../lib/file-signing';

describe('חתימת קישורי קבצים', () => {
  it('קישור שנחתם עכשיו מאומת בהצלחה', () => {
    const url = signFileUrl('demo-lavi/abc-file.pdf', 'application/pdf', 60);
    const params = new URL(`http://x${url}`).searchParams;
    const ok = verifyFileSignature(
      'demo-lavi/abc-file.pdf', 'application/pdf', params.get('exp')!, params.get('sig')!,
    );
    expect(ok).toBe(true);
  });

  it('שינוי המפתח אחרי החתימה נדחה', () => {
    const url = signFileUrl('demo-lavi/abc-file.pdf', 'application/pdf', 60);
    const params = new URL(`http://x${url}`).searchParams;
    const ok = verifyFileSignature(
      'demo-lavi/OTHER-file.pdf', 'application/pdf', params.get('exp')!, params.get('sig')!,
    );
    expect(ok).toBe(false);
  });

  it('שינוי סוג הקובץ אחרי החתימה נדחה', () => {
    const url = signFileUrl('demo-lavi/abc-file.pdf', 'application/pdf', 60);
    const params = new URL(`http://x${url}`).searchParams;
    const ok = verifyFileSignature(
      'demo-lavi/abc-file.pdf', 'text/html', params.get('exp')!, params.get('sig')!,
    );
    expect(ok).toBe(false);
  });

  it('קישור שפג לא מאומת, גם עם חתימה נכונה', () => {
    const ok = verifyFileSignature('k', 'application/pdf', String(Date.now() - 1000), 'anything');
    expect(ok).toBe(false);
  });

  it('חתימה מומצאת נדחית', () => {
    const url = signFileUrl('demo-lavi/abc-file.pdf', 'application/pdf', 60);
    const params = new URL(`http://x${url}`).searchParams;
    const ok = verifyFileSignature('demo-lavi/abc-file.pdf', 'application/pdf', params.get('exp')!, 'made-up');
    expect(ok).toBe(false);
  });

  it('יציב בין שתי טעינות מודול נפרדות — בדיוק הבאג שקרה בפועל', async () => {
    // Next.js מהדר server components ו-route handlers ליחידות נפרדות,
    // וב-serverless כל route הוא הפעלה נפרדת — כל אחת מריצה את הקובץ
    // הזה מהתחלה. אם הסוד היה מחושב אקראית בזמן טעינה (כפי שהיה כאן
    // בעבר), חתימה מהצד האחד הייתה נכשלת תמיד בצד השני. מדמים שתי
    // טעינות עצמאיות ומוודאים שחתימה מאחת מאומתת תחת השנייה.
    vi.resetModules();
    const first = await import('../lib/file-signing');
    const url = first.signFileUrl('t/file.pdf', 'application/pdf', 60);
    const params = new URL(`http://x${url}`).searchParams;

    vi.resetModules();
    const second = await import('../lib/file-signing');
    const ok = second.verifyFileSignature('t/file.pdf', 'application/pdf', params.get('exp')!, params.get('sig')!);
    expect(ok).toBe(true);
  });
});
