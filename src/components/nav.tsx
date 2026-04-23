import Link from "next/link";
import { Mail, Workflow, LayoutDashboard, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="border-b bg-background">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Mail className="h-5 w-5" />
            Zoho Email Automator
          </Link>
          {user && (
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><LayoutDashboard className="h-4 w-4" />Dashboard</Link>
              <Link href="/automations" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Workflow className="h-4 w-4" />Automations</Link>
              <Link href="/templates" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Mail className="h-4 w-4" />Templates</Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="text-sm hover:underline">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
