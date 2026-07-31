export interface GitHubRepo {
  name: string
  language: string | null
  stargazers_count: number
  size: number
  id: number
  created_at: string
  node_id: string
}
