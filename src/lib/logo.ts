/**
 * Employer logos from Logo.dev.
 *
 * The default is the publishable key that ships in the design handoff
 * (website/screens/Jobluvo App.dc.html). Publishable keys are meant to be sent
 * from the browser, so it is safe in client code, but set
 * NEXT_PUBLIC_LOGO_DEV_TOKEN to use your own.
 *
 * Logos are the only colour in the system. Render them inside a 1px border at
 * 16, 24, 32 or 40px.
 */
const HANDOFF_TOKEN = "pk_S5se7z4MRFmirWigT4dW_Q";

export function logoUrl(domain: string, size = 64): string {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || HANDOFF_TOKEN;
  return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png`;
}
