-- Internal admins own personal reminders without a company.
ALTER TABLE "lembretes_pessoais" ALTER COLUMN "empresaId" DROP NOT NULL;
