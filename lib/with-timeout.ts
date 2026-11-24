/**
 * Answers with `fallback` when `promise` has not settled after `ms`.
 *
 * For forms that call a server action: a request that gets lost on the way (seen on Vercel — the
 * middleware ran, the function was never invoked, the browser waited forever) would otherwise
 * leave the button spinning with no message. A late real answer is simply ignored by
 * useActionState; a late redirect (sign-in that did succeed) still navigates.
 */
export function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 20_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}
