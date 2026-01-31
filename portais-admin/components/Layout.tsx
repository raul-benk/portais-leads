import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Cable, Webhook, Users, FileText, Settings, ShieldCheck } from 'lucide-react';
import { cn } from './Shared';

interface SidebarItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon: Icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1",
          isActive
            ? "bg-gray-100 text-gray-900"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )
      }
    >
      <Icon className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500" />
      {label}
    </NavLink>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const appEnv = (import.meta as any)?.env?.VITE_ENV;
  const isStaging = appEnv === 'staging';

  return (
    <div className="flex h-screen w-full bg-gray-50">
      {isStaging && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-yellow-200 text-yellow-900 text-xs font-semibold px-3 py-1 shadow">
          STAGING
        </div>
      )}
      {/* Sidebar */}
      <div className="hidden w-64 flex-col fixed inset-y-0 z-50 border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 flex-shrink-0 items-center px-4 border-b border-gray-200">
           <div className="flex items-center gap-2">
             <div className="bg-black text-white p-1 rounded-sm">
                <ShieldCheck size={20} />
             </div>
             <span className="font-bold text-lg tracking-tight">OpsLink</span>
           </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
          <nav className="mt-2 flex-1 space-y-1 px-2">
            <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
            <SidebarItem to="/integrations" icon={Cable} label="Integrations" />
            <SidebarItem to="/webhooks" icon={Webhook} label="Webhooks" />
            <SidebarItem to="/leads" icon={Users} label="Leads" />
            
            <div className="pt-8 pb-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                System
              </p>
            </div>
            <SidebarItem to="/logs" icon={FileText} label="System Logs" />
          </nav>
        </div>
        <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
           <div className="flex items-center">
             <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
               AD
             </div>
             <div className="ml-3">
               <p className="text-sm font-medium text-gray-700">Admin User</p>
               <p className="text-xs font-medium text-gray-500">Super Admin</p>
             </div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pl-0 md:pl-64">
        <div className="py-8 px-4 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};
