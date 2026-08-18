// src/components/dashboard/admin/AdminTabs.tsx
// Navegação em tabs para o painel admin

'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { motion } from 'framer-motion'
import AdminDashboard from './AdminDashboard'
import AdminEmpresas from './AdminEmpresas'
import AdminSolicitacoes from './AdminSolicitacoes'

type TabType = 'dashboard' | 'empresas' | 'solicitacoes'

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'empresas', label: 'Empresas', icon: '🏢' },
  { id: 'solicitacoes', label: 'Solicitações', icon: '📋' }
]

export default function AdminTabs() {
  const { primary } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />
      case 'empresas':
        return <AdminEmpresas />
      case 'solicitacoes':
        return <AdminSolicitacoes />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div
        className="flex gap-2 border-b overflow-x-auto pb-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {tabs.map(tab => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-6 py-4 font-bold uppercase tracking-widest text-sm whitespace-nowrap relative"
            style={{
              color: activeTab === tab.id ? primary : 'var(--foreground-muted)'
            }}
            whileHover={{ opacity: 0.7 }}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}

            {/* Active Indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="underline"
                className="absolute bottom-0 left-0 right-0 h-1"
                style={{ backgroundColor: primary }}
                transition={{ duration: 0.3 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {renderContent()}
      </motion.div>
    </div>
  )
}
