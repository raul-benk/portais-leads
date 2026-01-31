import React from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility Functions ---
export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// --- Components ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className, children, ...props }) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-md";
  
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 focus:ring-gray-900",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-300",
    outline: "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-300",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    warning: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 focus:ring-yellow-500 border border-yellow-200",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};

export const Card: React.FC<{ className?: string, children: React.ReactNode, title?: string, extra?: React.ReactNode }> = ({ className, children, title, extra }) => (
  <div className={cn("bg-white border border-gray-200 rounded-lg shadow-sm", className)}>
    {(title || extra) && (
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
        {extra && <div>{extra}</div>}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

export const Badge: React.FC<{ variant?: 'success' | 'warning' | 'error' | 'neutral', children: React.ReactNode }> = ({ variant = 'neutral', children }) => {
  const styles = {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    error: "bg-red-100 text-red-800 border-red-200",
    neutral: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", styles[variant])}>
      {children}
    </span>
  );
};

export const CopyInput: React.FC<{ value: string, label?: string, disabled?: boolean, helpText?: string }> = ({ value, label, disabled, helpText }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (disabled) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex shadow-sm rounded-md">
        <div className="relative flex-grow focus-within:z-10">
          <input
            type="text"
            readOnly
            disabled={disabled}
            className={cn(
              "focus:ring-black focus:border-black block w-full rounded-none rounded-l-md sm:text-sm border-gray-300 font-mono transition-colors",
              disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50 text-gray-600"
            )}
            value={value}
          />
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          className={cn(
            "relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-colors",
             disabled ? "text-gray-300 cursor-not-allowed hover:bg-white" : "text-gray-700 hover:bg-gray-50"
          )}
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-400" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      {helpText && <p className={cn("mt-1 text-xs", disabled ? "text-yellow-600" : "text-gray-500")}>{helpText}</p>}
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      className={cn("shadow-sm focus:ring-black focus:border-black block w-full sm:text-sm border-gray-300 rounded-md h-10 px-3", className)}
      {...props}
    />
  </div>
);

export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className, ...props }) => (
  <div className="flex items-start">
    <div className="flex items-center h-5">
      <input
        type="checkbox"
        className={cn("focus:ring-black h-4 w-4 text-black border-gray-300 rounded", className)}
        {...props}
      />
    </div>
    {label && (
      <div className="ml-3 text-sm">
        <label className="font-medium text-gray-700 select-none cursor-pointer" htmlFor={props.id}>{label}</label>
      </div>
    )}
  </div>
);

export const SectionHeader: React.FC<{ title: string, subtitle?: string, action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="md:flex md:items-center md:justify-between mb-6">
    <div className="min-w-0 flex-1">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    {action && <div className="mt-4 flex md:ml-4 md:mt-0">{action}</div>}
  </div>
);

export const EmptyState: React.FC<{ title: string, description: string }> = ({ title, description }) => (
  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
    <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 text-sm text-gray-500">{description}</p>
  </div>
);
