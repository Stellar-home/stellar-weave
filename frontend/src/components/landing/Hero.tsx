import Link from "next/link";
import LoomGraphic from "./LoomGraphic";

const tags = ["Permissionless to read", "Composable by any app", "Payments woven in"];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-hero-glow pb-18 pt-24 sm:pt-28">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-7 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            A protocol, not an app
          </p>
          <h1 className="font-serif text-[38px] leading-[1.06] tracking-tight text-star sm:text-5xl lg:text-[60px]">
            The social graph
            <br />
            <em className="font-medium not-italic italic text-gold-soft">Stellar</em> was missing.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-slate">
            Weave gives every Stellar wallet a portable identity, a follow graph, and a
            reputation that travels between apps instead of resetting to zero each time. No
            app owns your network. No permission needed to build on it.
          </p>

          <div className="mt-8 flex flex-wrap gap-3.5">
            <Link
              href="#what"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-[#191204] transition-transform hover:-translate-y-px hover:bg-gold-soft"
            >
              See How It Works
            </Link>
            <Link
              href="/docs"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-5 text-sm font-semibold text-star transition-colors hover:border-gold hover:text-gold-soft"
            >
              Read the Docs ↗
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3.5 font-mono text-[12.5px] tracking-wide text-slate-dim">
            {tags.map((tag, i) => (
              <span key={tag} className={i > 0 ? "before:mr-3.5 before:text-border-strong before:content-['·']" : ""}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <LoomGraphic />
        </div>
      </div>
    </section>
  );
}
