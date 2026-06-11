import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { footerColumns } from "@/lib/marketing";

export function Footer() {
  return (
    <footer className="dark border-t border-white/10 bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              The AI copilot for hiring. AI finds, you approve, and stablecoin escrow on Celo
              settles — fair for both sides.
            </p>
          </div>

          {footerColumns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Shire Labs. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built on Celo · Secured by stablecoin escrow
          </p>
        </div>
      </div>
    </footer>
  );
}
