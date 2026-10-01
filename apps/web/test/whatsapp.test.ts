import { describe, expect, it } from 'vitest';
import { demoInviteMessage, isIsraeliMobile, toWhatsAppNumber, whatsAppHref } from '../lib/whatsapp';

describe('whatsapp', () => {
  it('converts local and international formats to wa.me numbers', () => {
    expect(toWhatsAppNumber('054-1234567')).toBe('972541234567');
    expect(toWhatsAppNumber('+972 54 123 4567')).toBe('972541234567');
    expect(toWhatsAppNumber('09-8654545')).toBe('97298654545');
    expect(toWhatsAppNumber('12345')).toBeNull();
  });

  it('only mobiles are prefilled', () => {
    expect(isIsraeliMobile('053-6626666')).toBe(true);
    expect(isIsraeliMobile('09-8654545')).toBe(false);
  });

  it('builds a link with the encoded message', () => {
    const href = whatsAppHref('0541234567', 'היי\nhttps://x.co/signin');
    expect(href).toBe(`https://wa.me/972541234567?text=${encodeURIComponent('היי\nhttps://x.co/signin')}`);
    expect(whatsAppHref('abc', 'x')).toBeNull();
  });

  it('greets by name when given, and always carries the link', () => {
    const named = demoInviteMessage({ contactName: ' משה ', link: 'https://x.co/signin' });
    expect(named.startsWith('היי משה, כאן יעקב אליה')).toBe(true);
    expect(named).toContain('https://x.co/signin');
    expect(demoInviteMessage({ link: 'L' }).startsWith('היי, כאן')).toBe(true);
    expect(named).not.toContain('Bossi');
  });
});
