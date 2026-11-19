import React from 'react';
import { CreditCard, History, Send, User } from 'lucide-react';

export type MobileNavTab = 'send' | 'history' | 'payments' | 'account';

interface MobileBottomNavProps {
  activeTab: MobileNavTab;
  onSelect: (tab: MobileNavTab) => void;
}

export function MobileBottomNav({ activeTab, onSelect }: MobileBottomNavProps) {
  const items: Array<{ id: MobileNavTab; label: string; icon: React.ReactNode }> = [
    { id: 'send', label: 'Send', icon: <Send className="h-5 w-5" /> },
    { id: 'history', label: 'History', icon: <History className="h-5 w-5" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="h-5 w-5" /> },
    { id: 'account', label: 'Account', icon: <User className="h-5 w-5" /> },
  ];

  return (
    <nav
      aria-label="Phone app navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md pb-safe"
    >
      <div className="grid grid-cols-4 h-14 items-center">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
