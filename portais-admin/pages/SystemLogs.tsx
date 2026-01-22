import React from 'react';
import { MOCK_LOGS } from '../services/mockData';
import { SectionHeader, Card, Badge, formatDate, cn } from '../components/Shared';

export const SystemLogs: React.FC = () => {
  return (
    <div className="space-y-6">
      <SectionHeader title="System Logs" subtitle="Audit trails and error reports." />
      
      <Card className="p-0 overflow-hidden bg-gray-900 text-gray-300 font-mono text-xs">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
           <span>/var/log/opslink-system.log</span>
           <div className="flex space-x-2">
             <div className="h-3 w-3 rounded-full bg-red-500"></div>
             <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
             <div className="h-3 w-3 rounded-full bg-green-500"></div>
           </div>
        </div>
        <div className="p-4 h-[600px] overflow-auto raw-scroll">
           {MOCK_LOGS.map(log => (
             <div key={log.id} className="mb-1 flex">
               <span className="text-gray-500 w-48 flex-shrink-0">{formatDate(log.timestamp)}</span>
               <span className={cn("w-16 flex-shrink-0 font-bold", 
                 log.level === 'ERROR' ? 'text-red-500' : 
                 log.level === 'WARN' ? 'text-yellow-500' : 'text-blue-400'
               )}>
                 [{log.level}]
               </span>
               <span className="text-gray-300">{log.message}</span>
               {log.integrationId && <span className="ml-2 text-gray-600">({log.integrationId})</span>}
             </div>
           ))}
        </div>
      </Card>
    </div>
  );
};
