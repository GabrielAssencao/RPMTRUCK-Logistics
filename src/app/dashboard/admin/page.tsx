'use client'

import { useState } from 'react'

// Layout do Admin (a "casca" que arrumamos no Passo 1)
import AdminLayout, { type AdminTab } from './_estrutura/AdminLayout'

// Importação dos módulos com o alias padrão do Next.js @/
import DashboardModule from './_modulos/visao-geral/DashboardModule'
import CompaniesModule from './_modulos/empresas/CompaniesModule'
import PasswordResetsModule from './_modulos/redefinicoes-senha/AdminPasswordResets'
import AdminRequests from './_modulos/solicitacoes/AdminRequests'
import SettingsModule from './_modulos/configuracoes/SettingsModule'
import SecurityModule from './_modulos/seguranca/SecurityModule'
import SubscriptionsModule from './_modulos/assinaturas/SubscriptionsModule'

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
      case 'security':
        return <SecurityModule key="security" />
      case 'subscriptions':
        return <SubscriptionsModule key="subscriptions" />
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
