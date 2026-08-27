export interface MensagemPrimeiroAcessoInput {
  empresa: string
  responsavel: string
  email: string
  senhaTemporaria: string
  expiraEm: string
  loginUrl: string
}

export function criarMensagensPrimeiroAcesso(input: MensagemPrimeiroAcessoInput) {
  const validade = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(input.expiraEm))

  const instrucoes = [
    `E-mail de acesso: ${input.email}`,
    `Senha temporária: ${input.senhaTemporaria}`,
    `Acesse: ${input.loginUrl}`,
    `Validade da senha temporária: ${validade}`,
  ].join('\n')

  return {
    assunto: `Acesso aprovado — Plataforma RPMTRUCK | ${input.empresa}`,
    email: `Olá, ${input.responsavel}!

A solicitação de acesso da ${input.empresa} à Plataforma RPMTRUCK foi aprovada.

${instrucoes}

No primeiro acesso, o sistema solicitará a criação de uma senha pessoal e definitiva. Por segurança, não compartilhe esta mensagem nem reutilize a senha temporária em outros serviços.

Se você não reconhece esta solicitação, responda a este e-mail imediatamente.

Atenciosamente,
Equipe RPMTRUCK Logistics`,
    whatsapp: `Olá, ${input.responsavel}! O acesso da *${input.empresa}* à Plataforma RPMTRUCK foi aprovado.

${instrucoes}

No primeiro acesso, será obrigatório criar uma senha pessoal e definitiva. Não encaminhe esta mensagem. Se não reconhece a solicitação, avise nossa equipe imediatamente.`,
  }
}
