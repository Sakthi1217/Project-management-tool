import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useUIStore } from '../../store/uiStore';

export default function Layout() {
  const { sidebarOpen, darkMode } = useUIStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-60' : 'md:ml-[72px]'}`}>
        <Outlet />
      </div>
    </div>
  );
}
