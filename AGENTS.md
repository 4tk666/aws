# エージェント向け作業ガイド

## 適用範囲と基本方針

- このファイルはリポジトリ全体に適用する。
- ユーザーへの説明と作業結果の報告は日本語で行う。
- 作業前に `git status --short` を確認し、既存の変更や未追跡ファイルを上書き・削除しない。
- 依頼に必要な範囲で変更し、無関係なリファクタリングや依存パッケージの更新を混ぜない。
- 実装の現状はコードと設定ファイルで確認する。設計書や学習TODOにある将来構想を実装済みと扱わない。

## プロジェクト構成

FastAPI、React、PostgreSQLを使うタスク管理アプリ。

| パス | 役割 |
| --- | --- |
| `frontend/src/` | React + TypeScriptの画面・スタイル |
| `frontend/public/` | ビルド時にコピーする静的ファイル |
| `frontend/dist/` | Viteのビルド成果物。直接編集せず、ソースから再生成する |
| `backend/main.py` | FastAPIのAPIとDB関連の実装 |
| `backend/alembic/` | DBマイグレーション |
| `backend/tests/` | pytestによるAPIテスト |
| `compose.yaml` | ローカル開発用の3サービス構成 |
| `.github/workflows/` | GitHub Actions |
| `docs/frontend-deploy.md` | S3デプロイの設定手順 |
| `system_design.md` | AWS構成などの設計資料 |
| `aws_webapp_cicd_learning_todo.md` | 学習・実装のTODO |

## 開発と検証

FrontendはNode.js 24とnpm、BackendはPython 3.12以上とuvを使用する。

ローカル全体の起動はリポジトリ直下で実行する。

```bash
docker compose up --build
```

Frontend: `http://localhost:5173`、API: `http://localhost:8000`、APIドキュメント: `http://localhost:8000/docs`。
Backendコンテナは起動時に `alembic upgrade head` を実行する。

Frontendを変更した場合は `frontend/` で実行する。

```bash
npm ci
npm run lint
npm run build
```

Backendを変更した場合は `backend/` で実行する。

```bash
uv sync --dev
uv run pytest
```

既存のAPIテストはインメモリSQLiteを使うため、PostgreSQLの起動は不要。PostgreSQL固有の挙動やマイグレーションの変更は、別途開発用PostgreSQLで確認する。

- 変更内容に応じた検証を行う。文書のみの変更ではリンク先や記載したコマンドの整合性を確認する。
- 最後に `git diff --check` で空白エラーを確認する。
- 必要なツールがないなどの理由で検証できない場合は、未実施の項目と理由を報告する。未実施の確認を成功と報告しない。

## 実装上の注意

- 既存のコードスタイルに合わせる。Frontendの依存関係を変更した場合は `package-lock.json` も整合させる。
- APIの入出力を変更するときは、Frontendの呼び出しとBackendのテストも確認する。
- DBスキーマの変更にはAlembicマイグレーションを追加する。適用済みのマイグレーションを書き換えて対応しない。
- 環境変数の追加・変更は対象の `.env.example` と必要なドキュメントに反映する。
- 認証情報や実際の `.env` をコミットしない。`VITE_` で始まる環境変数はブラウザー向け成果物に含まれるため、秘密情報を設定しない。

## FrontendのS3デプロイ

- `.github/workflows/deploy-frontend.yml` は、対象パスの変更を伴う `main` へのpush、または `main` での手動実行で動く。PRマージもpushとして扱われる。
- CIで `frontend/dist/` を生成し、その中身をS3バケットのルートへ転送する。
- AWS認証にはOIDCを使用する。必要なGitHub VariablesとIAMポリシーは `docs/frontend-deploy.md` を参照する。
- アセットを先に転送してから `index.html` を更新する。現在のサンプルはS3上の旧ファイルを削除しない。
- CloudFrontのDistribution IDが設定されている場合はキャッシュ無効化を申請する。
- workflowや必要な権限・変数を変更した場合は、デプロイ手順も更新する。
- サンプル作成やコード変更の依頼だけで、実際のAWSデプロイやリソース削除を実行しない。実環境の操作はユーザーが依頼した範囲で行う。

## 作業結果の報告

変更した内容、実施した検証とその結果、未実施の検証や必要な設定を簡潔に伝える。
