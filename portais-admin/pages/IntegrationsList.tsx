import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MOCK_INTEGRATIONS } from '../services/mockData';
import { IntegrationStatus } from '../types';
import { SectionHeader, Button, Badge, Card, formatDate, cn } from '../components/Shared';
import { Plus, Search, MoreHorizontal, ExternalLink } from 'lucide-react';

export const IntegrationsList: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredIntegrations = MOCK_INTEGRATIONS.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Integrations" 
        subtitle="Manage client webhook endpoints and configurations."
        action={
          <Button onClick={() => console.log('Create')}>
            <Plus className="h-4 w-4 mr-2" />
            New Integration
          </Button>
        }
      />

      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <Search className="h-4 w-4 text-gray-400" />
           </div>
           <input
             type="text"
             className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm"
             placeholder="Search by name or slug..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Slug</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook URL</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIntegrations.map((integration) => (
                <tr key={integration.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/integrations/${integration.id}`)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                        {integration.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{integration.name}</div>
                        <div className="text-sm text-gray-500">{integration.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={integration.status === IntegrationStatus.Active ? 'success' : 'neutral'}>
                      {integration.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2 max-w-xs truncate font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      <span className="truncate">{integration.webhookUrl}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(integration.lastActivity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                     <Button variant="ghost" size="sm" onClick={(e) => {
                       e.stopPropagation();
                       navigate(`/integrations/${integration.id}`);
                     }}>
                       View
                     </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredIntegrations.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No integrations found matching your search.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
