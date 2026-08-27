import type { Metadata } from 'next'
import PublicDocumentLayout from '@/components/legal/PublicDocumentLayout'

export const metadata: Metadata = {
  title: 'Guia de Uso | RPMTruck Logistics',
  description: 'Tutorial de primeiros passos e rotinas da plataforma RPMTruck Logistics.',
}

const sections = [
  { id: 'primeiros-passos', label: 'Primeiros passos' },
  { id: 'gestor', label: 'Configuração pelo gestor' },
  { id: 'rotina', label: 'Rotina operacional' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'papeis', label: 'Papéis e acesso' },
  { id: 'boas-praticas', label: 'Boas práticas' },
  { id: 'ajuda', label: 'Problemas comuns' },
]

export default function GuidePage() {
  return (
    <PublicDocumentLayout
      eyebrow="Central de ajuda"
      title="Guia de Uso da RPMTruck"
      description="Um roteiro prático para configurar a empresa, organizar a frota e manter a operação diária atualizada. Os menus exibidos dependem do papel do usuário e dos módulos do plano contratado."
      updatedAt="27 de agosto de 2026"
      sections={sections}
    >
      <section>
        <h2 id="primeiros-passos">1. Primeiros passos</h2>
        <ol className="mt-4 list-decimal space-y-3 [&_li]:ml-5 [&_li]:pl-1">
          <li>Na página inicial, selecione <strong className="text-foreground">Solicitar acesso</strong>, informe empresa, responsável, e-mail, frota e plano desejado.</li>
          <li>Depois da aprovação, use o e-mail corporativo e a senha temporária recebida em <strong className="text-foreground">Login</strong>. Ela vale por 72 horas e deve ser mantida em sigilo.</li>
          <li>No primeiro acesso, crie uma senha pessoal e definitiva com 12 ou mais caracteres, maiúscula, minúscula, número e símbolo. Só então a sessão será iniciada.</li>
          <li>Confirme o nome da empresa, os módulos ativos e seu papel. Se algo estiver incorreto, fale com o gestor antes de cadastrar dados.</li>
          <li>Use o seletor no topo para ajustar cor e modo claro/escuro; a preferência fica somente no navegador.</li>
        </ol>
      </section>

      <section>
        <h2 id="gestor">2. Configuração inicial pelo gestor</h2>
        <ol className="mt-4 list-decimal space-y-3 [&_li]:ml-5 [&_li]:pl-1">
          <li>Em <strong className="text-foreground">Configurações</strong>, revise razão social, e-mail, CNPJ e telefone da empresa.</li>
          <li>Em <strong className="text-foreground">Operadores</strong>, crie uma conta individual para cada pessoa. Escolha o menor nível de acesso necessário e evite contas compartilhadas.</li>
          <li>Em <strong className="text-foreground">Frota → Localizações</strong>, cadastre pátios, garagens e bases antes dos veículos.</li>
          <li>Em <strong className="text-foreground">Frota / Veículos</strong>, cadastre placa, modelo, tipo, ano, quilometragem, estado e base.</li>
          <li>Em <strong className="text-foreground">Motoristas</strong>, registre somente os dados necessários e associe veículo quando aplicável.</li>
          <li>Revise plano, módulos e limites em <strong className="text-foreground">Configurações</strong>. Alterações comerciais passam por solicitação e aprovação.</li>
        </ol>
      </section>

      <section>
        <h2 id="rotina">3. Rotina recomendada</h2>
        <h3>Início do turno</h3>
        <ul>
          <li>abra o Painel Operacional e verifique alertas, veículos em oficina, documentos próximos do vencimento e tarefas pendentes;</li>
          <li>confirme disponibilidade dos motoristas e atualize associações com veículos;</li>
          <li>revise containers agendados ou em trânsito e responsáveis por cada movimentação.</li>
        </ul>
        <h3>Durante a operação</h3>
        <ul>
          <li>atualize quilometragem e estado do veículo sempre que houver mudança relevante;</li>
          <li>registre custos no momento em que ocorrerem e associe veículo, motorista e categoria corretos;</li>
          <li>mantenha status de containers e tarefas atualizados para que alertas e indicadores sejam confiáveis.</li>
        </ul>
        <h3>Fechamento</h3>
        <ul>
          <li>resolva ou encaminhe notificações pendentes;</li>
          <li>confira lançamentos de custos e manutenções;</li>
          <li>quando autorizado, gere o relatório do período, faça o download, valide o arquivo e só então confirme o arquivamento ou a purga indicada pelo sistema.</li>
        </ul>
      </section>

      <section>
        <h2 id="modulos">4. O que fazer em cada módulo</h2>
        <h3>Painel Operacional</h3>
        <p>Resumo de disponibilidade, risco, tarefas e alertas. Use como ponto de partida; confirme detalhes no módulo de origem antes de tomar decisões.</p>
        <h3>Frota, localizações e manutenção</h3>
        <p>Cadastre veículos, bases e estados operacionais. Na manutenção, agende serviços, informe peças, custo e quilometragem e conclua o registro somente depois da execução.</p>
        <h3>Motoristas</h3>
        <p>Controle cadastro, validade da CNH, status, foto e vínculo com veículo. Restrinja CPF, RG e CNH a usuários que realmente precisam.</p>
        <h3>Containers</h3>
        <p>Registre operação, itens, valores, motorista e veículo; avance os estados de agendado para em trânsito e entregue. Movimentações arquivadas não devem ser alteradas.</p>
        <h3>Custos e despesas</h3>
        <p>Informe data, categoria, valor, forma de pagamento e vínculos. Revise comissões automáticas de containers e não duplique um custo já gerado pelo sistema.</p>
        <h3>Tarefas e notificações</h3>
        <p>Crie tarefas com responsável, prioridade e prazo. A pessoa responsável atualiza o status; o gestor acompanha atrasos. Notificações devem ser lidas, resolvidas ou delegadas.</p>
        <h3>Relatórios e Arquivo Operacional</h3>
        <p>Escolha um período permitido pelo plano, gere o arquivo e baixe por URL temporária. Confirme somente após validar o conteúdo. A purga é uma ação de alto impacto: preserve a cópia necessária e siga a política de retenção da empresa.</p>
      </section>

      <section>
        <h2 id="papeis">5. Papéis e acesso</h2>
        <ul>
          <li><strong className="text-foreground">Gestor da empresa:</strong> administra perfil, equipe, motoristas, relatórios, arquivos e configurações da própria empresa.</li>
          <li><strong className="text-foreground">Operador:</strong> executa rotinas permitidas de frota, containers, custos e tarefas.</li>
          <li><strong className="text-foreground">Visualizador:</strong> consulta as áreas liberadas, com ações de alteração restritas.</li>
          <li><strong className="text-foreground">Administrador RPMTruck:</strong> gerencia empresas, solicitações, planos, redefinições e segurança global.</li>
        </ul>
        <p className="mt-4">Se um menu não aparece, verifique primeiro seu papel, o módulo contratado e a situação da conta. Não tente contornar a restrição com links diretos.</p>
      </section>

      <section>
        <h2 id="boas-praticas">6. Segurança e qualidade dos dados</h2>
        <ul>
          <li>use senha exclusiva, não compartilhe a sessão e sempre selecione <strong className="text-foreground">Sair</strong> em equipamento compartilhado;</li>
          <li>crie usuários individuais e remova imediatamente o acesso de quem saiu da empresa;</li>
          <li>confira placa, datas, valores e associações antes de salvar; indicadores dependem desses dados;</li>
          <li>não coloque senhas, dados bancários ou documentos desnecessários em descrições e tarefas;</li>
          <li>mantenha backups e cópias externas dos relatórios que a política da empresa exigir;</li>
          <li>em suspeita de acesso indevido, encerre a sessão, avise o gestor e preserve horário e evidências do ocorrido.</li>
        </ul>
      </section>

      <section>
        <h2 id="ajuda">7. Problemas comuns</h2>
        <ul>
          <li><strong className="text-foreground">Não consigo entrar:</strong> confirme e-mail, teclado e conexão; depois use Recuperar senha. A resposta não revela se o e-mail está cadastrado.</li>
          <li><strong className="text-foreground">Menu ausente:</strong> seu papel ou plano pode não liberar o módulo. Peça ao gestor para revisar permissões.</li>
          <li><strong className="text-foreground">Dados não atualizaram:</strong> aguarde a conclusão da ação, recarregue uma vez e confira a conexão. Evite clicar repetidamente.</li>
          <li><strong className="text-foreground">Relatório não gerou:</strong> verifique período, módulo, limite do plano e capacidade de armazenamento.</li>
          <li><strong className="text-foreground">Tela lenta:</strong> feche abas pesadas, teste outra rede e registre página, horário, dispositivo e ação para o suporte reproduzir.</li>
        </ul>
      </section>
    </PublicDocumentLayout>
  )
}
