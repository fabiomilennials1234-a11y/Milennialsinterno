import { useState } from 'react';
import {
  FileText,
  FolderKanban,
  AlertTriangle,
  Users,
  ClipboardList,
} from 'lucide-react';

import TechTeamDocDev from './team/TechTeamDocDev';
import TechTeamDocProject from './team/TechTeamDocProject';
import TechTeamDelaysTable from './team/TechTeamDelaysTable';
import TechTeamOneOnOne from './team/TechTeamOneOnOne';
import TechTeamJustifications from './team/TechTeamJustifications';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TEAM_TABS = [
  { id: 'doc-dev', label: 'Doc Dev', icon: FileText },
  { id: 'doc-projeto', label: 'Doc Projeto', icon: FolderKanban },
  { id: 'atrasados', label: 'Atrasados', icon: AlertTriangle },
  { id: 'reuniao-1a1', label: 'Reuniao 1:1', icon: Users },
  { id: 'justificativas', label: 'Justificativas', icon: ClipboardList },
] as const;

type TabId = (typeof TEAM_TABS)[number]['id'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TechTeamView() {
  const [activeTab, setActiveTab] = useState<TabId>('doc-dev');

  return (
    <div className="-mx-8 h-[calc(100vh-16rem)] flex flex-col">
      {/* Tab bar */}
      <div className="px-8 border-b border-[var(--mtech-border)]">
        <nav className="flex gap-0.5">
          {TEAM_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium transition-colors
                  border-b-2 -mb-[1px]
                  ${
                    isActive
                      ? 'text-[var(--mtech-accent)] border-[var(--mtech-accent)]'
                      : 'text-[var(--mtech-text-muted)] border-transparent hover:text-[var(--mtech-text)] hover:border-[var(--mtech-border)]'
                  }
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-apple">
        {activeTab === 'doc-dev' && <TechTeamDocDev />}
        {activeTab === 'doc-projeto' && <TechTeamDocProject />}
        {activeTab === 'atrasados' && <TechTeamDelaysTable />}
        {activeTab === 'reuniao-1a1' && <TechTeamOneOnOne />}
        {activeTab === 'justificativas' && <TechTeamJustifications />}
      </div>
    </div>
  );
}
