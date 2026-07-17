import Link from "next/link";

const navLinks = [
  { href: "#what", label: "What It Does" },
  { href: "#apps", label: "Built On" },
  { href: "#ecosystem", label: "For Stellar" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-ink/80 backdrop-blur-md">
      <nav className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-7">
        <Link
          href="#top"
          aria-label="Weave home"
          className="flex items-center gap-2.5 font-serif text-xl italic text-star"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <path
              d="M2 11c3-6 6 6 9 0s6-6 9 0"
              stroke="#c9a24b"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="2" cy="11" r="1.6" fill="#c9a24b" />
            <circle cx="11" cy="11" r="1.6" fill="#f2f0ea" />
            <circle cx="20" cy="11" r="1.6" fill="#c9a24b" />
          </svg>
          Weave
        </Link>

        <div className="flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden font-mono text-[13px] tracking-wide text-slate transition-colors hover:text-star sm:inline"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center rounded-md bg-gold px-5 text-sm font-semibold text-[#191204] transition-colors hover:bg-gold-soft"
          >
            Try the Demo
          </Link>
          <Link
            href="https://github.com"
            className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-5 text-sm font-semibold text-star transition-colors hover:border-gold hover:text-gold-soft"
          >
            GitHub
          </Link>
        </div>
      </nav>
    </header>
  );
}
