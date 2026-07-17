import { SiStellar, SiGithub, SiIpfs, SiOpenzeppelin } from "react-icons/si";
import { ArrowUpRight } from "lucide-react";

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

type Stack = {
  name: string;
  category: string;
  desc: string;
  Icon: IconComponent;
  href: string;
  tint: string; // background tint for the icon badge, kept within the site's own palette
};

const stack: Stack[] = [
  {
    name: "Stellar",
    category: "Settlement layer",
    desc: "Every Weave profile is a Stellar address by construction — sub-5-second finality and sub-cent fees make the graph cheap enough to feel instant.",
    Icon: SiStellar,
    href: "https://stellar.org",
    tint: "bg-gold/12 border-gold/30",
  },
  {
    name: "OpenZeppelin",
    category: "Audited contracts",
    desc: "Weave's Soroban contracts build on OpenZeppelin's audited Stellar contracts suite rather than reimplementing access control and token primitives from scratch.",
    Icon: SiOpenzeppelin,
    href: "https://www.openzeppelin.com/networks/stellar",
    tint: "bg-teal/10 border-teal/30",
  },
  {
    name: "IPFS",
    category: "Content storage",
    desc: "Posts and media live off-chain on IPFS; only a content hash is anchored on Soroban, keeping storage costs off the consensus layer.",
    Icon: SiIpfs,
    href: "https://ipfs.tech",
    tint: "bg-slate/10 border-slate/30",
  },
  {
    name: "GitHub",
    category: "Open source",
    desc: "The full protocol — contracts, spec, and client — is public and open source. No closed reference implementation, no gatekeeping.",
    Icon: SiGithub,
    href: "https://github.com",
    tint: "bg-star/8 border-star/20",
  },
];

export default function AppsShowcase() {
  return (
    <section id="apps" className="border-t border-border py-22">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-13 max-w-2xl">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            Built on real infrastructure
          </p>
          <h2 className="font-serif text-3xl text-star sm:text-[38px]">
            Not a whitepaper — real, verifiable technology.
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">
            Weave doesn&apos;t invent new infrastructure where mature, audited infrastructure
            already exists. Here&apos;s what it actually runs on.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stack.map((item) => (
            <div
              key={item.name}
              className="flex flex-col rounded-2xl border border-border bg-panel p-6 transition-colors hover:border-border-strong"
            >
              <div
                className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${item.tint}`}
                aria-hidden="true"
              >
                <item.Icon size={22} className="text-star" />
              </div>

              <h3 className="font-serif text-lg text-star">{item.name}</h3>
              <span className="mb-3 mt-0.5 font-mono text-[10.5px] uppercase tracking-wide text-slate-dim">
                {item.category}
              </span>
              <p className="mb-5 flex-1 text-[13.5px] leading-relaxed text-slate">{item.desc}</p>

              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-border-strong px-4 font-mono text-xs text-star/70 transition-colors hover:border-gold hover:text-gold-soft"
              >
                Visit
                <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
