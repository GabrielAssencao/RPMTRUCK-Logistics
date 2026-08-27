import type { Metadata } from 'next'
import PublicDocumentLayout from '@/components/legal/PublicDocumentLayout'

export const metadata: Metadata = {
  title: 'Política de Privacidade | RPMTruck Logistics',
  description: 'Como a RPMTruck Logistics trata dados pessoais e protege os direitos dos titulares.',
}

const sections = [
  { id: 'escopo', label: 'Escopo e responsáveis' },
  { id: 'dados', label: 'Dados tratados' },
  { id: 'finalidades', label: 'Finalidades e bases' },
  { id: 'compartilhamento', label: 'Compartilhamento' },
  { id: 'retencao', label: 'Retenção e eliminação' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'direitos', label: 'Seus direitos' },
  { id: 'contato', label: 'Contato' },
  { id: 'alteracoes', label: 'Alterações' },
]

export default function PrivacyPage() {
  const privacyEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim()

  return (
    <PublicDocumentLayout
      eyebrow="Proteção de dados"
      title="Política de Privacidade"
      description="Este documento explica, em linguagem direta, quais dados pessoais podem ser tratados na plataforma, para quais finalidades e como exercer direitos previstos na legislação brasileira."
      updatedAt="27 de agosto de 2026"
      sections={sections}
    >
      <section>
        <h2 id="escopo">1. Escopo e responsáveis</h2>
        <p className="mt-4">
          Esta Política aplica-se à landing page, aos fluxos de solicitação de acesso e autenticação e aos ambientes administrativos e operacionais da RPMTruck Logistics (“Plataforma”).
        </p>
        <p className="mt-4">
          A identificação empresarial completa do responsável pela oferta da Plataforma e os canais contratuais aplicáveis constam na proposta ou no contrato celebrado com cada cliente. Em regra, a empresa cliente é controladora dos dados de seus empregados, motoristas, prestadores e operações inseridos no sistema; a RPMTruck trata esses dados como operadora, conforme as instruções e o contrato. Para dados de relacionamento comercial, segurança da própria Plataforma e administração de contas, a RPMTruck poderá atuar como controladora. A função concreta pode variar conforme a operação e o instrumento contratual.
        </p>
      </section>

      <section>
        <h2 id="dados">2. Dados pessoais que podemos tratar</h2>
        <ul>
          <li>cadastro e contato: nome, e-mail, telefone, WhatsApp, empresa, função e preferências de contato;</li>
          <li>dados empresariais que identifiquem pessoas físicas, inclusive nome do responsável e dados de empresário individual;</li>
          <li>dados de usuários da Plataforma: credenciais protegidas por hash, papel, permissões, empresa vinculada e histórico de acesso;</li>
          <li>dados de motoristas: nome, CPF, RG, CNH, categoria, validade, fotografia, situação operacional e veículo associado;</li>
          <li>dados operacionais: veículos, placas, localizações ou bases informadas, quilometragem, manutenção, custos, tarefas, containers, relatórios e arquivos enviados;</li>
          <li>dados técnicos e de segurança: endereço IP pseudonimizado, navegador, dispositivo, horários, identificadores de sessão, tentativas de acesso e registros de auditoria;</li>
          <li>métricas agregadas de audiência e desempenho: página acessada, país ou região aproximada, navegador, dispositivo e indicadores Core Web Vitals, sem envio intencional de nomes, e-mails ou identificadores de conta;</li>
          <li>informações fornecidas em mensagens, solicitações de suporte, acesso, plano ou redefinição de senha.</li>
        </ul>
        <p className="mt-4">
          Não solicitamos dados além dos necessários ao uso contratado. O cliente deve evitar inserir dados sensíveis ou informações excessivas em campos livres, anexos e descrições.
        </p>
      </section>

      <section>
        <h2 id="finalidades">3. Finalidades e bases legais</h2>
        <p className="mt-4">Os dados podem ser usados para:</p>
        <ul>
          <li>analisar solicitações, criar contas e executar o contrato da Plataforma;</li>
          <li>autenticar usuários, aplicar permissões e manter a continuidade da sessão;</li>
          <li>viabilizar a gestão de frota, motoristas, manutenção, custos, containers, tarefas, notificações e relatórios;</li>
          <li>prevenir fraude, abuso, acessos indevidos e incidentes, além de produzir trilhas de auditoria;</li>
          <li>atender solicitações de suporte, direitos de titulares e obrigações legais ou regulatórias;</li>
          <li>manter, diagnosticar e melhorar confiabilidade, segurança e desempenho da Plataforma.</li>
        </ul>
        <p className="mt-4">
          Conforme o contexto, o tratamento poderá se apoiar na execução de contrato ou procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse avaliado com necessidade e impacto, proteção contra fraude e, quando efetivamente aplicável, consentimento. Não condicionamos funcionalidades necessárias a consentimento para publicidade.
        </p>
      </section>

      <section>
        <h2 id="compartilhamento">4. Compartilhamento e transferências</h2>
        <p className="mt-4">Dados podem ser compartilhados, no limite necessário, com:</p>
        <ul>
          <li>fornecedores de hospedagem, banco de dados, armazenamento e observabilidade contratados para operar e medir a Plataforma, como Vercel — inclusive Web Analytics e Speed Insights — e Supabase, quando configurados pelo responsável pela instalação;</li>
          <li>Cloudflare Turnstile, quando a proteção contra robôs estiver habilitada nos formulários de autenticação;</li>
          <li>prestadores de suporte, segurança, contabilidade ou assessoria sujeitos a deveres de confidencialidade;</li>
          <li>autoridades públicas ou terceiros quando houver obrigação legal, ordem válida ou necessidade de exercício regular de direitos;</li>
          <li>outras partes em reorganização societária, preservadas as garantias aplicáveis.</li>
        </ul>
        <p className="mt-4">
          Alguns fornecedores podem processar dados fora do Brasil. Nesses casos, o responsável deve avaliar localização, contratos, medidas de segurança e mecanismos admitidos pela LGPD. A RPMTruck não vende dados pessoais nem os compartilha para publicidade comportamental.
        </p>
      </section>

      <section>
        <h2 id="retencao">5. Retenção, exportação e eliminação</h2>
        <p className="mt-4">
          Os dados são mantidos enquanto a conta ou o contrato estiver ativo e pelo período necessário às finalidades informadas. A duração considera o plano contratado, obrigações fiscais e legais, prazos para defesa de direitos, prevenção a fraude, solicitações de preservação e requisitos de backup. Dados operacionais podem ser arquivados em relatórios antes da purga quando esse fluxo for solicitado por usuário autorizado.
        </p>
        <p className="mt-4">
          Após o encerramento ou uma solicitação válida, os dados serão eliminados, anonimizados ou devolvidos, salvo quando a conservação for permitida ou exigida por lei. Backups seguem seu ciclo técnico de sobrescrita e permanecem protegidos enquanto existirem.
        </p>
      </section>

      <section>
        <h2 id="seguranca">6. Segurança e responsabilidades</h2>
        <p className="mt-4">
          A Plataforma adota controles proporcionais ao risco, incluindo sessão em cookie protegido, autorização no servidor, isolamento por empresa, validação de entrada, limites de requisição, auditoria, buckets privados e criptografia configurável para campos de identificação. Nenhum sistema é invulnerável; por isso, controles técnicos devem ser acompanhados de backups, monitoramento, gestão de acessos e resposta a incidentes pelo operador da implantação.
        </p>
        <p className="mt-4">
          Usuários devem proteger suas credenciais, usar contas individuais, revisar permissões e comunicar imediatamente suspeitas de acesso indevido. O cliente é responsável pela qualidade, legalidade e necessidade dos dados que insere na Plataforma.
        </p>
      </section>

      <section>
        <h2 id="direitos">7. Direitos dos titulares</h2>
        <p className="mt-4">
          Nos termos da LGPD, o titular pode solicitar, conforme cabível: confirmação do tratamento; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados irregularmente; portabilidade; informação sobre compartilhamentos; revisão de decisões automatizadas; informação e revogação de consentimento; e oposição ao tratamento.
        </p>
        <p className="mt-4">
          Poderemos pedir informações razoáveis para confirmar identidade e legitimidade, protegendo os dados contra fraude. Quando a empresa cliente for a controladora, a solicitação será encaminhada a ela ou tratada conforme suas instruções. Algumas solicitações podem ser limitadas por obrigação legal ou necessidade de preservar direitos de terceiros.
        </p>
      </section>

      <section>
        <h2 id="contato">8. Como falar sobre privacidade</h2>
        {privacyEmail ? (
          <p className="mt-4">
            Envie sua solicitação para <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>, informando sua relação com a Plataforma e o direito que deseja exercer. Não envie documentos pessoais completos no primeiro contato.
          </p>
        ) : (
          <p className="mt-4">
            Utilize o canal corporativo de privacidade ou suporte informado na contratação e no painel da sua empresa. A organização responsável pela implantação deve configurar e divulgar um e-mail específico antes do uso em produção.
          </p>
        )}
        <p className="mt-4">
          Também é possível apresentar petição à Autoridade Nacional de Proteção de Dados, observados os procedimentos oficiais, especialmente após tentativa de solução com o controlador.
        </p>
      </section>

      <section>
        <h2 id="alteracoes">9. Atualizações desta Política</h2>
        <p className="mt-4">
          Esta Política poderá ser atualizada para refletir mudanças legais, contratuais ou técnicas. A data da versão será alterada e, quando a mudança for relevante, os usuários serão comunicados por meio adequado. A versão publicada não substitui o contrato nem dispensa a avaliação jurídica da operação concreta.
        </p>
      </section>
    </PublicDocumentLayout>
  )
}
