import argon2 from 'argon2';

/** Argon2id with OWASP-recommended baseline parameters (19 MiB, 2 iterations, 1 lane). */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Runs a verification against a throwaway hash so that "unknown email" and
 * "wrong password" take comparable time and cannot be told apart.
 */
export async function burnVerification(plain: string): Promise<void> {
  dummyHash ??= hashPassword('timing-equaliser-not-a-real-password-1');
  await verifyPassword(await dummyHash, plain);
}
