import { atsLogos } from "@/lib/marketing/content";

/** Logo height in the strip. Width comes from each wordmark's aspect ratio. */
const H = 20;

/**
 * "Applies on" strip.
 *
 * Application system wordmarks are not employer logos, so they do not get the
 * one colour exemption. Each PNG is used as a mask and filled with a single
 * token grey, which keeps the strip monochrome and puts every wordmark at the
 * same weight instead of letting the loudest brand win.
 */
export function AtsStrip() {
  return (
    <div className="strip">
      <div className="wrap">
        <span className="lbl">Applies on</span>
        <div className="logos">
          {atsLogos.map((l) => (
            <span
              key={l.alt}
              className="ats-logo"
              role="img"
              aria-label={l.alt}
              style={{
                width: Math.round(H * l.ratio),
                maskImage: `url(${l.file})`,
                WebkitMaskImage: `url(${l.file})`,
              }}
            />
          ))}
          <span className="more">and more</span>
        </div>
      </div>
    </div>
  );
}
