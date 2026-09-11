// pdfjs-dist לא מפרסם טיפוסים לנתיב ה-worker עצמו (רק ל-pdf.mjs
// הראשי) — הוא נטען ישירות רק בשביל ה-hook `globalThis.pdfjsWorker`
// (ראו extract-text.ts), לא בשביל שום API אחר שלו.
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
