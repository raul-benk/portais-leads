import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Integrations } from './pages/Integrations';
import { IntegrationDetail } from './pages/IntegrationDetail';
import { WebhooksGlobal } from './pages/WebhooksGlobal';
import { LeadsGlobal } from './pages/LeadsGlobal';
import { SystemLogs } from './pages/SystemLogs';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/integrations/:id" element={<IntegrationDetail />} />
          <Route path="/webhooks" element={<WebhooksGlobal />} />
          <Route path="/leads" element={<LeadsGlobal />} />
          <Route path="/logs" element={<SystemLogs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
