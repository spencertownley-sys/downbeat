import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthConfigured } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: {
    default: "Downbeat — Find time to play",
    template: "%s · Downbeat",
  },
  description:
    "The easiest way for a band to find time to rehearse. Share one link, everyone taps their availability, no logins for the band.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==='dark'||(!('theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );

  if (!isAuthConfigured()) return page;
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/"
      appearance={{ variables: { colorPrimary: "hsl(258 90% 58%)" } }}
    >
      {page}
    </ClerkProvider>
  );
}
