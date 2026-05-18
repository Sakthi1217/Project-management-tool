import { ChevronRight, Menu } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useLangStore } from '../../store/langStore';

interface HeaderProps {
  breadcrumbs: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export default function Header({ breadcrumbs, actions }: HeaderProps) {
  const { sidebarOpen, toggleSidebar, setMobileMenuOpen } = useUIStore();
  const { lang, setLang } = useLangStore();

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 gap-2">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        {/* Desktop hamburger (only when sidebar collapsed) */}
        {!sidebarOpen && (
          <button onClick={toggleSidebar} className="hidden md:block p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <span className={`truncate ${i === breadcrumbs.length - 1 ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hidden sm:inline'}`}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Language switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setLang('es')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              lang === 'es'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title="Español"
          >
            ES
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              lang === 'en'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title="English"
          >
            EN
          </button>
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
