interface BacklogTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { key: 'BUG', label: 'Problemas' },
  { key: 'FEATURE', label: 'Melhorias' },
  { key: 'HOTFIX', label: 'Urgentes' },
  { key: 'CHORE', label: 'Tarefas' },
  { key: 'DONE', label: 'Concluídas' },
] as const;

export function BacklogTabs({ activeTab, onTabChange }: BacklogTabsProps) {
  return (
    <div className="flex gap-1 border-b border-[var(--mtech-border)]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: isActive
                ? 'var(--mtech-text)'
                : 'var(--mtech-text-muted)',
            }}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: 'var(--mtech-accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
