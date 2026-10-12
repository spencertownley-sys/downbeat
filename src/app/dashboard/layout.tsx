import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/brand/Logo";
import { isAuthConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile.fullName}
            </span>
            {isAuthConfigured() && <UserButton />}
          </div>
        </div>
      </header>
      <main className="container py-10">{children}</main>
    </div>
  );
}
