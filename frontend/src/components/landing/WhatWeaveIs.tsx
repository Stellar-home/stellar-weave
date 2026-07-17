const capabilities = [
  {
    title: "Identity you own",
    desc: "A profile is a Stellar wallet, not a database row an app controls. Register once; every app that reads Weave recognizes you.",
    icon: (
      <>
        <circle cx="9" cy="6" r="3.4" stroke="#c9a24b" strokeWidth="1.4" fill="none" />
        <path d="M2.5 16c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="#c9a24b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "A graph that travels",
    desc: "Follows live on-chain, readable by any app without asking permission. Your network isn't reset every time you try a new client.",
    icon: (
      <>
        <circle cx="4" cy="9" r="2.6" stroke="#c9a24b" strokeWidth="1.4" fill="none" />
        <circle cx="14" cy="9" r="2.6" stroke="#c9a24b" strokeWidth="1.4" fill="none" />
        <path d="M6.6 9h4.8" stroke="#c9a24b" strokeWidth="1.4" />
      </>
    ),
  },
  {
    title: "Reputation that means something",
    desc: "Standing is earned on-chain and auditable — usable as a signal by lending apps, DAOs, or anything that needs to know who's real.",
    icon: (
      <path
        d="M9 2l2 4.4 4.6.5-3.5 3.2 1 4.7L9 12.4l-4.1 2.4 1-4.7-3.5-3.2 4.6-.5z"
        stroke="#c9a24b"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Payments woven in",
    desc: "Every profile is already a funded Stellar address. Tipping and micropayments use native payment rails, not custom contract accounting.",
    icon: (
      <path
        d="M3 9h12M11 5l4 4-4 4"
        stroke="#c9a24b"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function WhatWeaveIs() {
  return (
    <section id="what" className="border-t border-border py-22">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-13 max-w-xl">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            What Weave does
          </p>
          <h2 className="font-serif text-3xl text-star sm:text-[38px]">
            Four things every social app needs, none of them owned by an app.
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">
            Weave separates identity, connections, and standing from any single client — so
            switching apps doesn&apos;t mean starting your network over.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((cap) => (
            <div key={cap.title}>
              <div className="mb-5 flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-gold">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  {cap.icon}
                </svg>
              </div>
              <h3 className="mb-2.5 font-serif text-xl text-star">{cap.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-slate">{cap.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
