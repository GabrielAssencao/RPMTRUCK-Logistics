import type { Metadata } from 'next'
import PublicDocumentLayout from '@/components/legal/PublicDocumentLayout'

export const metadata: Metadata = {
  title: 'Aviso de Cookies | RPMTruck Logistics',
  description: 'Entenda quais cookies e recursos de armazenamento a RPMTruck Logistics utiliza.',
}

const sections = [
  { id: 'conceito', label: 'O que são' },
  { id: 'utilizados', label: 'Recursos utilizados' },
  { id: 'terceiros', label: 'Serviços de terceiros' },
  { id: 'escolhas', label: 'Suas escolhas' },
  { id: 'mudancas', label: 'Mudanças futuras' },
]

export default function CookiesPage() {
  return (
    <PublicDocumentLayout
      eyebrow="Transparência"
      title="Aviso de Cookies e Armazenamento Local"
      description="A RPMTruck usa armazenamento necessário para autenticação, segurança e preferências. Este aviso descreve cada recurso utilizado atualmente."
      updatedAt="27 de agosto de 2026"
      sections={sections}
    >
      <section>
        <h2 id="conceito">1. O que são cookies e armazenamento local</h2>
        <p className="mt-4">
          Cookies são pequenos registros associados ao navegador e enviados ao site em requisições futuras. O armazenamento local mantém informações no próprio navegador, mas não é enviado automaticamente ao servidor. Ambos podem ser usados para uma funcionalidade necessária ou para guardar uma preferência.
        </p>
      </section>

      <section>
        <h2 id="utilizados">2. O que a Plataforma utiliza hoje</h2>
        <div className="mt-5 overflow-x-auto border border-border">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead className="bg-card text-foreground">
              <tr>
                <th className="border-b border-border p-3">Nome</th>
                <th className="border-b border-border p-3">Tipo</th>
                <th className="border-b border-border p-3">Finalidade</th>
                <th className="border-b border-border p-3">Duração</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:p-3">
              <tr>
                <td><code>rpmtruck_session</code></td>
                <td>Cookie essencial</td>
                <td>Autenticar a sessão com proteção <code>HttpOnly</code> e aplicar permissões.</td>
                <td>Até 24 horas ou até sair/revogar a sessão.</td>
              </tr>
              <tr>
                <td><code>rpm-primary</code> e <code>rpm-light</code></td>
                <td>Armazenamento local funcional</td>
                <td>Lembrar cor e modo claro/escuro escolhidos pelo usuário.</td>
                <td>Até alteração ou limpeza pelo usuário.</td>
              </tr>
              <tr>
                <td><code>@rpmtruck:user</code></td>
                <td>Armazenamento local essencial</td>
                <td>Manter uma cópia limitada do perfil e da empresa para compor a interface autenticada. A autorização real é revalidada no servidor.</td>
                <td>Durante o uso da conta; removido ao sair ou quando a sessão é inválida.</td>
              </tr>
              <tr>
                <td><code>rpmtruck-cookie-notice-v1</code></td>
                <td>Armazenamento local essencial</td>
                <td>Lembrar que este aviso já foi apresentado.</td>
                <td>Até limpeza dos dados do navegador ou mudança da versão do aviso.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Na versão atual, a landing page não instala cookies de publicidade, redes sociais ou medição de audiência. Por isso, não exibimos uma opção fictícia de “aceitar publicidade”.
        </p>
      </section>

      <section>
        <h2 id="terceiros">3. Cloudflare Turnstile</h2>
        <p className="mt-4">
          Quando configurado, o Turnstile é carregado somente nos formulários protegidos, como login, solicitação de acesso e recuperação de senha. Ele processa sinais técnicos para distinguir pessoas de automações e pode utilizar cookies ou armazenamento sob responsabilidade da Cloudflare. Esse tratamento é voltado à segurança e prevenção de fraude, não à publicidade da RPMTruck.
        </p>
      </section>

      <section>
        <h2 id="escolhas">4. Como controlar</h2>
        <p className="mt-4">
          Você pode apagar cookies e dados locais nas configurações do navegador. Bloquear o cookie de sessão impede o login; apagar preferências restaura o tema padrão; apagar o registro do aviso fará com que ele seja exibido novamente. O modo privado normalmente elimina esses dados ao encerrar a janela.
        </p>
      </section>

      <section>
        <h2 id="mudancas">5. Novos recursos e atualização do aviso</h2>
        <p className="mt-4">
          Se ferramentas opcionais de analytics, publicidade ou personalização forem adicionadas, elas deverão permanecer bloqueadas até a escolha aplicável do usuário, e este aviso e o painel de preferências deverão ser atualizados antes da ativação. A versão publicada será revista sempre que as tecnologias ou finalidades mudarem.
        </p>
      </section>
    </PublicDocumentLayout>
  )
}
