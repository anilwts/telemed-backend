const { z } = require('zod');
describe('request schema contracts', () => {
  const booking = z.object({ slotId:z.string().uuid(), reason:z.string().max(2000).optional() });
  test('accepts valid booking payload', () => {
    expect(booking.safeParse({slotId:'d9428888-122b-11e1-b85c-61cd3cbb3210',reason:'Follow-up'}).success).toBe(true);
  });
  test('rejects invalid slot IDs', () => {
    expect(booking.safeParse({slotId:'not-a-uuid'}).success).toBe(false);
  });
  test('rejects oversized reasons', () => {
    expect(booking.safeParse({slotId:'d9428888-122b-11e1-b85c-61cd3cbb3210',reason:'x'.repeat(2001)}).success).toBe(false);
  });
});
