import crypto from 'node:crypto';

/**
 * FreeBSD-style MD5 crypt ($1$). rpcd checks login passwords with crypt(3),
 * and $1$ is the one scheme every OpenWrt libc supports. The password itself is
 * a long random string, so the weak hash is not what protects it.
 */
const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function to64(v: number, n: number) {
  let s = '';
  while (n-- > 0) {
    s += itoa64[v & 0x3f];
    v >>= 6;
  }
  return s;
}

export function md5crypt(password: string, salt?: string): string {
  const magic = '$1$';
  salt ??= Array.from(crypto.randomBytes(8), (b) => itoa64[b & 0x3f]).join('');
  salt = salt.slice(0, 8);
  const pw = Buffer.from(password, 'utf8');
  const sl = Buffer.from(salt, 'utf8');

  const alt = crypto.createHash('md5').update(pw).update(sl).update(pw).digest();
  const ctx = crypto.createHash('md5').update(pw).update(magic).update(sl);
  for (let pl = pw.length; pl > 0; pl -= 16) ctx.update(alt.subarray(0, Math.min(16, pl)));
  for (let i = pw.length; i; i >>= 1) ctx.update(i & 1 ? Buffer.alloc(1) : pw.subarray(0, 1));
  let fin = ctx.digest();

  for (let i = 0; i < 1000; i++) {
    const c = crypto.createHash('md5');
    c.update(i & 1 ? pw : fin);
    if (i % 3) c.update(sl);
    if (i % 7) c.update(pw);
    c.update(i & 1 ? fin : pw);
    fin = c.digest();
  }

  let out = '';
  out += to64((fin[0] << 16) | (fin[6] << 8) | fin[12], 4);
  out += to64((fin[1] << 16) | (fin[7] << 8) | fin[13], 4);
  out += to64((fin[2] << 16) | (fin[8] << 8) | fin[14], 4);
  out += to64((fin[3] << 16) | (fin[9] << 8) | fin[15], 4);
  out += to64((fin[4] << 16) | (fin[10] << 8) | fin[5], 4);
  out += to64(fin[11], 2);
  return magic + salt + '$' + out;
}
