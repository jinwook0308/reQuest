export const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'

export function apiFetch(
  path: string,
  options: RequestInit = {},
) {
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`

  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    credentials: 'include',
  })
}