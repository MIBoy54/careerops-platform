import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../../src/adminAccess.js';
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
describe('administrative authorization', () => {
  it.each([undefined, {}, { user: undefined }])('rejects unauthenticated sessions %#', session => {
    const res = response(); const next = vi.fn();
    requireAdmin({ session }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it.each(['guest', 'user', undefined])('rejects nonadmin role %s including DEMO guests', role => {
    const res = response(); const next = vi.fn();
    requireAdmin({ session: { user: { role } } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('allows an authenticated administrator', () => {
    const next = vi.fn();
    requireAdmin({ session: { user: { role: 'admin' } } }, response(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
