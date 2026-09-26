import { VaultGuard } from '@/components/vault/VaultGuard';
import { DashboardSidebar, DashboardHeader } from '@/components/vault/DashboardNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultGuard>
      <div className="flex h-screen bg-transparent">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <DashboardHeader />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </VaultGuard>
  );
}
