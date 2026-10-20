import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'wedding_session';
const MAX_AGE = 60 * 60 * 24 * 7;
const attempts = new Map();

export function cookieName() { return COOKIE; }
export function hasServerSecrets() {
  return Boolean(process.env.WEDDING_PASSWORD && process.env.WEDDING_SESSION_SECRET && process.env.WEDDING_SESSION_SECRET.length >= 32);
}
function digest(s) { return createHash('sha256').update(String(s)).digest(); }
export function matchesPassword(input) {
  if (!hasServerSecrets() || typeof input !== 'string') return false;
  return timingSafeEqual(digest(input), digest(process.env.WEDDING_PASSWORD));
}
function signature(value) { return createHmac('sha256', process.env.WEDDING_SESSION_SECRET).update(value).digest('base64url'); }
export function createSession() {
  if (!hasServerSecrets()) throw new Error('Missing WEDDING_PASSWORD or WEDDING_SESSION_SECRET configuration');
  const payload = Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+MAX_AGE, nonce:randomBytes(12).toString('hex')})).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function validSession(session) {
  try {
    if (!hasServerSecrets() || typeof session !== 'string') return false;
    const [payload, sig, other] = session.split('.');
    if (!payload || !sig || other !== undefined) return false;
    const actual = Buffer.from(sig, 'base64url');
    const expected = Buffer.from(signature(payload), 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) return false;
    const data = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now()/1000;
  } catch { return false; }
}
export function getCookie(req) {
  const cookies = String(req.headers?.cookie || '').split(';');
  const pair = cookies.map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(COOKIE.length+1)) : '';
}
export function isAuthenticated(req) { return validSession(getCookie(req)); }
export function makeCookie(session,req) {
  const secure = Boolean(process.env.VERCEL || req.headers?.['x-forwarded-proto'] === 'https');
  return `${COOKIE}=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}${secure?'; Secure':''}`;
}
export function clearCookie(req) {
  const secure = Boolean(process.env.VERCEL || req.headers?.['x-forwarded-proto'] === 'https');
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`;
}
export function tooManyAttempts(ip) {
  const now=Date.now(), record=attempts.get(ip) || {count:0,reset:now+15*60_000};
  if (record.reset < now) {attempts.delete(ip);return false;}
  return record.count >= 8;
}
export function recordAttempt(ip, success) {
  if (success) {attempts.delete(ip);return;}
  const now=Date.now(), record=attempts.get(ip) || {count:0,reset:now+15*60_000};
  if (record.reset < now) {record.count=0;record.reset=now+15*60_000;}
  record.count++; attempts.set(ip,record);
  if(attempts.size>5000) attempts.clear();
}
