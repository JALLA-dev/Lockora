'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useVault } from '@/components/vault/VaultProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Shield, PlusCircle, Settings, FileText, Lock } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'My Lockora', icon: Shield },
  { href: '/dashboard/secrets/new', label: 'Add Secret', icon: PlusCircle },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/audit', label: 'Audit Logs', icon: FileText },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { isUnlocked, lockVault } = useVault();

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md hidden md:flex flex-col relative z-20">
      {/* Brand */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Image src="/lockora-icon.svg" alt="Lockora" width={32} height={32} className="rounded-lg" />
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Lockora</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function DashboardHeader() {
  const { isUnlocked } = useVault();

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md flex items-center px-4 justify-between flex-shrink-0 relative z-20">
      {/* Mobile brand (hidden on desktop since sidebar shows it) */}
      <div className="md:hidden flex items-center gap-2">
        <Image src="/lockora-icon.svg" alt="Lockora" width={28} height={28} className="rounded-md" />
        <span className="font-bold text-zinc-900 dark:text-white text-lg">Lockora</span>
      </div>
      
      {/* Desktop left (empty to push items to right) */}
      <div className="hidden md:block flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Vault state pill */}
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border shadow-sm ${
          isUnlocked
            ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40'
            : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/60'
        }`}>
          <span className={`h-2 w-2 rounded-full ${isUnlocked ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
          <span>{isUnlocked ? 'Lockora Access Active' : 'Lockora Protected'}</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: "w-8 h-8",
              }
            }} 
          />
        </div>
      </div>
    </header>
  );
}
