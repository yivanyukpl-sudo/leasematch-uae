import Link from "next/link";
import { Logo } from "./Logo";
import { getSession, clearSessionCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

async function logoutAction() {
  "use server";
  await clearSessionCookie();
  redirect("/login");
}

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header
      className="border-b bg-surface"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <nav data-tour="nav" className="flex items-center gap-4 text-sm">
          <Link href="/demos" className="text-text-muted hover:text-text">
            Demos
          </Link>
          <a href="https://github.com/yivanyukpl-sudo/leasematch-uae/blob/main/docs/PROTOTYPE-GUIDE.md" target="_blank" rel="noopener noreferrer" className="hidden text-text-muted hover:text-text sm:inline">
            How to use
          </a>
          {session ? (
            <>
              <Link href="/listings" className="hidden text-text-muted hover:text-text sm:inline">
                Listings
              </Link>
              {session.role === "tenant" && (
                <Link href="/dashboard/market" className="hidden text-text-muted hover:text-text sm:inline">
                  Market search
                </Link>
              )}
              <Link href="/dashboard/leases" className="text-text-muted hover:text-text">
                Leases
              </Link>
              <Link href="/dashboard" className="text-text-muted hover:text-text">
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md border px-3 py-1.5 text-text-muted hover:text-text"
                  style={{ borderColor: "var(--border)" }}
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-text-muted hover:text-text">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md px-3 py-1.5 font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
