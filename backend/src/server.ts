import express, { type Request, type Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { pool } from './config/db'
import subjectsRouter from './routes/subjects'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
)

app.use(express.json())
app.use('/api/subjects', subjectsRouter)

app.get('/api/health', (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    message: 'reQuest 백엔드 서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/db-health', async (_request: Request, response: Response) => {
  try {
    const result = await pool.query(
      'SELECT NOW() AS database_time, current_database() AS database_name',
    )

    response.status(200).json({
      success: true,
      message: 'PostgreSQL 데이터베이스 연결에 성공했습니다.',
      databaseName: result.rows[0].database_name,
      databaseTime: result.rows[0].database_time,
    })
  } catch (error) {
    console.error('데이터베이스 연결 실패:', error)

    response.status(500).json({
      success: false,
      message: 'PostgreSQL 데이터베이스 연결에 실패했습니다.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`reQuest 서버 실행: http://localhost:${PORT}`)
})