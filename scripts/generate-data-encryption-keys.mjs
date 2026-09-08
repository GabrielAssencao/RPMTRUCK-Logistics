import { randomBytes } from 'node:crypto'

process.stdout.write('Guarde estas chaves em um cofre seguro e não as envie por chat ou Git.\n')
process.stdout.write(`DATA_ENCRYPTION_MASTER_KEY="${randomBytes(32).toString('base64')}"\n`)
process.stdout.write(`DATA_BLIND_INDEX_KEY="${randomBytes(32).toString('base64')}"\n`)
