import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50 dark:bg-zinc-950 relative z-10">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl text-center">
          Lockora
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-[600px] text-center">
          Secure, Zero-Knowledge Secrets Vault.
        </p>
        <div className="flex gap-4">
          <SignUpButton mode="modal">
            <Button size="lg" className="h-12 px-8">Get Started</Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button variant="outline" size="lg" className="h-12 px-8">Sign In</Button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}
