import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Task = {
  id: number
  title: string
  completed: boolean
  created_at: string
  updated_at: string
}

type Filter = 'all' | 'active' | 'completed'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Task[]>('/api/tasks')
      .then(setTasks)
      .catch(() => setError('タスクを読み込めませんでした。APIの起動状態を確認してください。'))
      .finally(() => setLoading(false))
  }, [])

  const remaining = tasks.filter((task) => !task.completed).length
  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === 'all' || (filter === 'completed') === task.completed),
    [filter, tasks],
  )

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || saving) return
    setSaving(true)
    setError('')
    try {
      const created = await api<Task>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: trimmedTitle }),
      })
      setTasks((current) => [created, ...current])
      setTitle('')
    } catch {
      setError('タスクを追加できませんでした。')
    } finally {
      setSaving(false)
    }
  }

  async function updateTask(id: number, changes: Partial<Pick<Task, 'title' | 'completed'>>) {
    setError('')
    try {
      const updated = await api<Task>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)))
      return true
    } catch {
      setError('タスクを更新できませんでした。')
      return false
    }
  }

  async function saveEdit(event: FormEvent, id: number) {
    event.preventDefault()
    const trimmedTitle = editingTitle.trim()
    if (!trimmedTitle) return
    if (await updateTask(id, { title: trimmedTitle })) setEditingId(null)
  }

  async function deleteTask(id: number) {
    setError('')
    try {
      await api<void>(`/api/tasks/${id}`, { method: 'DELETE' })
      setTasks((current) => current.filter((task) => task.id !== id))
    } catch {
      setError('タスクを削除できませんでした。')
    }
  }

  function startEditing(task: Task) {
    setEditingId(task.id)
    setEditingTitle(task.title)
  }

  return (
    <main className="page-shell">
      <section className="task-app" aria-labelledby="page-title">
        <header className="app-header">
          <div className="brand-mark" aria-hidden="true">✓</div>
          <div>
            <p className="eyebrow">MY WORKSPACE</p>
            <h1 id="page-title">今日のタスク</h1>
          </div>
          <div className="progress-badge">
            <span className="progress-number">{remaining}</span>
            <span>未完了</span>
          </div>
        </header>

        <form className="add-form" onSubmit={addTask}>
          <span className="add-icon" aria-hidden="true">＋</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="新しいタスクを入力…"
            maxLength={200}
            aria-label="新しいタスク"
          />
          <button type="submit" disabled={!title.trim() || saving}>
            {saving ? '追加中…' : '追加する'}
          </button>
        </form>

        <div className="toolbar">
          <div className="filters" aria-label="タスクの絞り込み">
            {(['all', 'active', 'completed'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
              >
                {{ all: 'すべて', active: '未完了', completed: '完了済み' }[item]}
              </button>
            ))}
          </div>
          <span className="task-count">全 {tasks.length} 件</span>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <div className="task-list" aria-live="polite">
          {loading ? (
            <div className="empty-state"><span className="loader" />読み込み中…</div>
          ) : visibleTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">◎</div>
              <strong>{tasks.length === 0 ? 'タスクはまだありません' : '該当するタスクはありません'}</strong>
              <span>{tasks.length === 0 && '上のフォームから、最初のタスクを追加しましょう。'}</span>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <article className={`task-row ${task.completed ? 'is-completed' : ''}`} key={task.id}>
                <button
                  type="button"
                  className="check-button"
                  aria-label={task.completed ? `${task.title}を未完了にする` : `${task.title}を完了にする`}
                  onClick={() => updateTask(task.id, { completed: !task.completed })}
                >
                  {task.completed && '✓'}
                </button>

                {editingId === task.id ? (
                  <form className="edit-form" onSubmit={(event) => saveEdit(event, task.id)}>
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => event.key === 'Escape' && setEditingId(null)}
                      maxLength={200}
                      aria-label="タスク名を編集"
                    />
                    <button type="submit" className="text-button save">保存</button>
                    <button type="button" className="text-button" onClick={() => setEditingId(null)}>取消</button>
                  </form>
                ) : (
                  <div className="task-content">
                    <span className="task-title">{task.title}</span>
                    <span className="task-date">
                      {new Intl.DateTimeFormat('ja-JP', { month: 'short', day: 'numeric' }).format(new Date(task.created_at))}
                    </span>
                  </div>
                )}

                {editingId !== task.id && (
                  <div className="row-actions">
                    <button type="button" aria-label="編集" onClick={() => startEditing(task)}>編集</button>
                    <button type="button" className="delete" aria-label="削除" onClick={() => deleteTask(task.id)}>削除</button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <footer className="app-footer">
          <span><i className="status-dot" /> API connected</span>
          <span>FastAPI × PostgreSQL</span>
        </footer>
      </section>
    </main>
  )
}

export default App
