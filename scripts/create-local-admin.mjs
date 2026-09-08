import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

if (process.env.LOCAL_ENVIRONMENT !== 'development') {
  throw new Error('Criação de administrador bloqueada fora do ambiente de desenvolvimento.')
}

const name = process.env.LOCAL_ADMIN_NAME?.trim() || 'Administrador de desenvolvimento'
const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase() || ''
const password = process.env.LOCAL_ADMIN_PASSWORD || ''

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  throw new Error('Configure LOCAL_ADMIN_EMAIL com um endereço válido no .env.local.')
}
if (
  password.length < 12
  || password.length > 128
  || !/[a-z]/.test(password)
  || !/[A-Z]/.test(password)
  || !/[0-9]/.test(password)
  || !/[^A-Za-z0-9]/.test(password)
) {
  throw new Error('LOCAL_ADMIN_PASSWORD deve ter 12 a 128 caracteres, maiúscula, minúscula, número e símbolo.')
}

const prisma = new PrismaClient()

try {
  const existing = await prisma.usuario.findUnique({ where: { email } })
  if (existing?.empresaId) {
    throw new Error('O e-mail informado já pertence a uma empresa e não pode ser promovido pelo bootstrap.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  if (existing) {
    await prisma.usuario.update({
      where: { id: existing.id },
      data: {
        nome: name,
        senha_hash: passwordHash,
        role: 'ADMIN_RPM',
        ativo: true,
        excluidoEm: null,
        exigeTrocaSenha: false,
        senhaTemporariaExpiraEm: null,
        senhaAlteradaEm: new Date(),
        sessaoVersao: { increment: 1 },
      },
    })
    await prisma.sessaoUsuario.updateMany({
      where: { usuarioId: existing.id, revogadaEm: null },
      data: { revogadaEm: new Date() },
    })
  } else {
    await prisma.usuario.create({
      data: { nome: name, email, senha_hash: passwordHash, role: 'ADMIN_RPM' },
    })
  }

  process.stdout.write('Superadmin local criado/atualizado. Remova LOCAL_ADMIN_PASSWORD do .env.local após entrar.\n')
} catch (error) {
  console.error(
    'Não foi possível criar o superadmin local:',
    error instanceof Error ? error.message : 'erro desconhecido',
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
