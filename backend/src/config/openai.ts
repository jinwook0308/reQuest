import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

const apiKey =
  process.env.OPENAI_API_KEY?.trim()

export const OPENAI_MODEL =
  process.env.OPENAI_MODEL?.trim() ||
  'gpt-5.6-terra'

export const openAIClient = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null

export const isOpenAIConfigured =
  openAIClient !== null