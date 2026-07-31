import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`)
  }

  return value
}

export const pool = new Pool({
  host: getRequiredEnvironmentVariable('DB_HOST'),
  port: Number(getRequiredEnvironmentVariable('DB_PORT')),
  database: getRequiredEnvironmentVariable('DB_NAME'),
  user: getRequiredEnvironmentVariable('DB_USER'),
  password: getRequiredEnvironmentVariable('DB_PASSWORD'),
})

pool.on('error', (error) => {
  console.error('PostgreSQL 연결 중 예상하지 못한 오류가 발생했습니다.', error)
})