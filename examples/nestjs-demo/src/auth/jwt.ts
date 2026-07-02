export function signJwt(payload: unknown) {
  return JSON.stringify(payload);
}
