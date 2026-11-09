/** True for `next dev`. Production builds, including `next start` and the Release desktop app, are false. */
export const developmentLogin = process.env.NODE_ENV === "development";

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "super" || role === "mic";
}

/** Development offers authenticator setup to every staff account. Production offers it to super only. */
export function shouldOfferMfa(role: string | null | undefined): boolean {
  if (developmentLogin) return isStaffRole(role);
  return role === "super";
}

/** Production super accounts cannot enter until setup succeeds. Development never blocks on a missing factor. */
export function mustFinishMfa(role: string | null | undefined): boolean {
  if (developmentLogin) return false;
  return role === "super";
}
