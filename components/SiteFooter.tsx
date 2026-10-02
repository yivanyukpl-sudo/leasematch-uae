import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo size={24} />
            <p className="mt-3 max-w-xs text-sm text-text-muted">
              An AI-driven leasing platform for the UAE rental market — matched, verified,
              signed, and handled by an agent that works for you.
            </p>
          </div>
          <div className="flex gap-12 text-sm">
            <div>
              <p className="mb-2 font-medium">Product</p>
              <ul className="space-y-1.5 text-text-muted">
                <li>
                  <Link href="/signup" className="hover:text-text">
                    Get started
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-text">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/demos" className="hover:text-text">
                    Demos &amp; simulations
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium">Company</p>
              <ul className="space-y-1.5 text-text-muted">
                <li>LeaseMatch UAE</li>
                <li>Dubai, United Arab Emirates</li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-text-muted">
          © {new Date().getFullYear()} LeaseMatch UAE. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
