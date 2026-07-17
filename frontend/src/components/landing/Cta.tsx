import Link from "next/link";

export default function Cta() {
  return (
    <section className="border-t border-border bg-cta-glow py-24 text-center">
      <div className="mx-auto max-w-[1180px] px-7">
        <h2 className="mx-auto max-w-[18ch] font-serif text-3xl text-star sm:text-4xl lg:text-[44px]">
          Build the graph with us.
        </h2>
        <p className="mx-auto mt-4.5 max-w-[48ch] text-base text-slate">
          Weave is open source and part of the Stellar ecosystem. If you&apos;re building on
          Stellar, the social graph underneath your app is already here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-[#191204] transition-transform hover:-translate-y-px hover:bg-gold-soft"
          >
            Try the Live Demo
          </Link>
          <Link
            href="/docs"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-5 text-sm font-semibold text-star transition-colors hover:border-gold hover:text-gold-soft"
          >
            Read the Docs
          </Link>
          <Link
            href="https://github.com"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-5 text-sm font-semibold text-star transition-colors hover:border-gold hover:text-gold-soft"
          >
            Star on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}
