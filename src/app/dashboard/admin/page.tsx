'use client'

import { useState } from 'react'

// Layout do Admin (a "casca" que arrumamos no Passo 1)
import AdminLayout, { type AdminTab } from './layout/AdminLayout'

// Importação dos módulos com o alias padrão do Next.js @/
import DashboardModule from '@/app/dashboard/admin/modules/dashboard/DashboardModule'
import CompaniesModule from '@/app/dashboard/admin/modules/companies/CompaniesModule'
import PasswordResetsModule from '@/app/dashboard/admin/modules/password-resets/AdminPasswordResets'
import AdminRequests from '@/app/dashboard/admin/modules/requests/AdminRequests'
import SettingsModule from '@/app/dashboard/admin/modules/settings/SettingsModule'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  // O "Cérebro" decide qual componente renderizar com base na aba ativa
  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardModule key="dashboard" />
      case 'companies':
        return <CompaniesModule key="companies" />
      case 'resets':
        return <PasswordResetsModule key="resets" />
      case 'requests':
        return <AdminRequests key="requests" />
      case 'settings':
        return <SettingsModule key="settings" />
      default:
        return <DashboardModule key="dashboard" />
    }
  }

  return (
    // Passamos o estado e o setState para a casca (para a Sidebar conseguir mudar a aba)
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {/* O módulo escolhido entra aqui e é repassado como 'children' para o layout */}
      {renderModule()}
    </AdminLayout>
  )
}
