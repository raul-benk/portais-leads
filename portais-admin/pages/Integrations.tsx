import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchIntegrations, createIntegration } from '../services/api';
import { Integration, IntegrationStatus } from '../types';
import { SectionHeader, Button, Badge, Card, formatDate, Input } from '../components/Shared';
import { Plus, Search, X, Loader2, ExternalLink } from 'lucide-react';

export const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSlug) return;

    try {
      setIsCreating(true);
      setError(null);
      await createIntegration({ name: newName, slug: newSlug });
      await loadData();
      setIsModalOpen(false);
      setNewName('');
      setNewSlug('');
    } catch (err: any) {
      setError(err.message || 'Falha ao criar integração');
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-generate slug from name if slug is untouched
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewName(val);
    // Simple slugify logic
    if (!newSlug || newSlug === val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
       setNewSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const filteredIntegrations = integrations.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Integrações" 
        subtitle="Gerencie clientes e endpoints de webhook."
        action={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Integração
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <Search className="h-4 w-4 text-gray-400" />
           </div>
           <input
             type="text"
             className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm"
             placeholder="Buscar por nome ou slug..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      {/* List */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Slug</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook URL</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Carregando...</td>
                </tr>
              ) : filteredIntegrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhuma integração encontrada.</td>
                </tr>
              ) : (
                filteredIntegrations.map((integration) => (
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
                        <span className="truncate">.../webhook/email/{integration.slug}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(integration.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                       <Button variant="ghost" size="sm" onClick={(e) => {
                         e.stopPropagation();
                         navigate(`/integrations/${integration.id}`);
                       }}>
                         Ver
                       </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nova Integração</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              <Input 
                label="Nome do Cliente" 
                value={newName} 
                onChange={handleNameChange}
                placeholder="Ex: Concessionária XYZ"
                required
              />
              
              <Input 
                label="Slug (URL)" 
                value={newSlug} 
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="ex: concessionaria-xyz"
                required
              />
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Integração
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};