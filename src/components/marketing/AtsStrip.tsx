import { atsLogos } from "@/lib/marketing/content";

/** "Applies on" strip. Logos are the only colour on the page. */
export function AtsStrip() {
  return (
    <div className="strip">
      <div className="wrap">
        <span className="lbl">Applies on</span>
        <div className="logos">
          {atsLogos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element -- fixed height wordmarks, no loader needed
            <img key={l.alt} src={l.file} alt={l.alt} />
          ))}
          <span className="more">and more</span>
        </div>
      </div>
    </div>
  );
}
