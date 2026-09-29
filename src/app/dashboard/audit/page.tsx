import { getAuditLogs } from '@/app/actions/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClientDate } from '@/components/ui/ClientDate';

export default async function AuditPage() {
  const logs = await getAuditLogs();

  const getActionColor = (action: string) => {
    if (action.includes('SUCCESS') || action.includes('CREATED') || action.includes('RESTORED')) return 'text-emerald-500';
    if (action.includes('FAILED') || action.includes('DELETED')) return 'text-red-500';
    if (action.includes('REVEALED') || action.includes('COPIED')) return 'text-amber-500';
    return 'text-indigo-400';
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Audit Logs</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Review security and access events for your Lockora data.
        </p>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-md">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>The last 100 security events.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center p-8 text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No audit logs found.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map(log => (
                <div key={log.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${getActionColor(log.action)}`}>
                        {formatActionName(log.action)}
                      </span>
                      {log.result === 'FAILURE' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">Failed</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-1">
                      Resource: <span className="text-zinc-900 dark:text-white">{log.resourceName}</span>
                    </div>
                    {log.action === 'SECRET_UPDATED' && (
                      <div className="text-xs text-zinc-500 mt-1 italic">
                        User edited a secret.
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                    <div><ClientDate dateString={log.timestamp} format="date" /></div>
                    <div><ClientDate dateString={log.timestamp} format="time" /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
