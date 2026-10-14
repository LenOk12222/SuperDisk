import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

function scryptAsync(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 128 * SCRYPT_N * SCRYPT_R * 4 },
      (err, derived) => (err ? reject(err) : resolve(derived)),
    );
  });
}

/** scrypt(N,r,p)$salt(base64)$hash(base64) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = (await new Promise((resolve, reject) => {
      scryptCb(
        password,
        salt,
        expected.length,
        {
          N: Number(n),
          r: Number(r),
          p: Number(p),
          maxmem: 128 * Number(n) * Number(r) * 4,
        },
        (err, d) => (err ? reject(err) : resolve(d)),
      );
    })) as Buffer;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
