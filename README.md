# Task App — Phase 1

FastAPI、React、PostgreSQLで構成した小規模なタスク管理アプリです。3サービスをDocker Composeで起動でき、Backend起動時にAlembic Migrationが自動適用されます。

## 起動方法

Docker / Docker Composeが使える環境で、リポジトリ直下から実行します。

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

停止する場合は `docker compose down` を実行します。DBデータも削除する場合は `docker compose down -v` を実行してください。

## API

| Method | Path | 内容 |
|---|---|---|
| `GET` | `/health` | ヘルスチェック |
| `GET` | `/api/tasks` | タスク一覧 |
| `POST` | `/api/tasks` | タスク登録 |
| `PATCH` | `/api/tasks/{id}` | タイトル・完了状態の更新 |
| `DELETE` | `/api/tasks/{id}` | タスク削除 |

登録例:

```json
{ "title": "AWSを学ぶ" }
```

更新例:

```json
{ "title": "Docker Composeを学ぶ", "completed": true }
```

## テスト

```bash
cd backend
uv sync --dev
uv run pytest
```

Frontendの確認:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

環境変数の例は `backend/.env.example` と `frontend/.env.example` を参照してください。

## FrontendのS3デプロイ

PRを `main` にマージした後に `frontend/dist/` をS3へアップロードするGitHub Actionsのサンプルを追加しています。設定方法は [デプロイ手順](docs/frontend-deploy.md) を参照してください。
