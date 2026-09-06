# タスク管理アプリ システム設計図

## 1. 設計の対象と前提

[学習TODO](aws_webapp_cicd_learning_todo.md)をもとに、Phase 0〜10の完成時点を目標とする構成を示す。Phase 11の発展課題とPhase 12のTerraform化は末尾に分けて記載する。

ローカル構成・API・データモデルは、現在の `compose.yaml`、`backend/main.py`、Alembicの定義も参照した。AWS構成とCI/CDは目標設計であり、構築済みを意味しない。

| 項目 | 設計 |
|---|---|
| アプリ | タスクの一覧・登録・更新・削除・完了切り替え |
| Frontend | React。AWSではビルド済み静的ファイルをS3からCloudFront経由で配信 |
| Backend | FastAPI + SQLAlchemy。ECS Fargateで実行、コンテナポート8000 |
| Database | RDS PostgreSQL。Private Subnetに配置、Public Access無効 |
| 公開URL例 | Frontend: `https://example.com`、API: `https://api.example.com` |
| 初期稼働数 | ECS ServiceのDesired Countは1。2つのAZを配置候補にする |
| 秘密情報・ログ | Secrets Manager、CloudWatch Logs |
| 自動化 | GitHub ActionsでCI/CD、OIDCでAWS認証 |

## 2. AWS全体構成

実線はリクエストやデータの流れ、点線はDNS設定・証明書・起動時参照などの補助関係を表す。Route 53は名前解決を担当し、HTTP通信を中継しない。Reactは利用者のブラウザで動作する。

```mermaid
flowchart TB
    browser["利用者のブラウザ / React"]
    dns["Route 53"]
    cf["CloudFront / example.com"]
    s3["S3 / Reactの静的ファイル / Public Access Block有効"]
    cert["ACM / TLS証明書"]

    subgraph vpc["学習用VPC"]
        subgraph public["Public Subnet × 2 AZ"]
            alb["ALB / api.example.com / HTTPS:443"]
        end
        subgraph private["Private Subnet × 2 AZ"]
            ecs["ECS Fargate Service / FastAPI:8000 / Desired Count:1"]
            rds[("RDS PostgreSQL:5432")]
        end
    end

    ecr["ECR / Backendイメージ"]
    secrets["Secrets Manager / DB接続情報"]
    logs["CloudWatch Logs"]

    browser -.->|"DNS問い合わせ"| dns
    dns -.->|"FrontendのAlias"| cf
    dns -.->|"APIのAlias"| alb
    browser -->|"HTTPS / HTML・JS・CSS取得"| cf
    cf -->|"Originへの取得要求"| s3
    browser -->|"HTTPS / タスクAPI"| alb
    alb -->|"Target Group / HTTP:8000"| ecs
    ecs -->|"SQL / TCP:5432"| rds
    ecs -.->|"起動時にイメージ取得"| ecr
    ecs -.->|"起動時に秘密情報取得"| secrets
    ecs -->|"標準出力・標準エラー"| logs
    cert -.->|"証明書を設定"| cf
    cert -.->|"証明書を設定"| alb
```

設計補足として、S3への読み取りはCloudFrontのOACとバケットポリシーで許可する。Frontendのビルド時に `VITE_API_URL=https://api.example.com` を設定し、Backendの `CORS_ORIGINS` には `https://example.com` を設定する。

## 3. ネットワークとアクセス制御

以下のCIDRとNAT GatewayはTODOで未指定のため、設計例として補った。Private Subnetのタスクがイメージ取得・秘密情報取得・ログ送信を行えるよう、外向きの経路を用意する。

```mermaid
flowchart TB
    internet["Internet"]
    awsapi["ECR / Secrets Manager / CloudWatch等の公開エンドポイント"]
    subgraph vpc["VPC / 10.0.0.0/16（例）"]
        igw["Internet Gateway"]
        alb["ALB / Public A・Bに配置"]
        subgraph aza["AZ-A"]
            subgraph pa["Public A / 10.0.1.0/24"]
                nat["NAT Gateway（補足案）"]
            end
            subgraph pra["Private A / 10.0.11.0/24"]
                task["FastAPIタスク / 初期1タスク"]
                db[("RDS / 配置例")]
            end
        end
        subgraph azb["AZ-B"]
            pb["Public B / 10.0.2.0/24"]
            prb["Private B / 10.0.12.0/24 / ECS配置候補"]
        end
        dbgroup["DB Subnet Group / Private A・B"]
        publicrt["Public Route Table / 0.0.0.0/0 → IGW"]
        privatert["Private Route Table / 0.0.0.0/0 → NAT"]
    end
    internet --> igw
    igw -->|"HTTP:80 / HTTPS:443"| alb
    alb -->|"HTTP:8000"| task
    task -->|"TCP:5432"| db
    task -->|"外向き通信"| privatert
    privatert --> nat
    nat --> igw
    igw --> awsapi
    publicrt -.-> pa
    publicrt -.-> pb
    privatert -.-> pra
    privatert -.-> prb
    dbgroup -.-> pra
    dbgroup -.-> prb
```

- VPC内のALB → ECS → RDS通信はVPC内の経路を使い、NATを経由しない。
- NAT Gatewayは学習用に1台を置く案。AZ単位の可用性は保証しない。VPC Endpointを使う構成への変更も検討対象とする。
- DB Subnet Groupに2つのAZを含めることと、RDSのMulti-AZ配置を有効にすることは別。RDSの冗長化はTODOで未指定。
- ALBが2つのAZを使っていても、初期のECSタスク数1ではアプリの冗長化はされない。

| Security Group | インバウンド許可元 | ポート・用途 |
|---|---|---|
| ALB SG | Internet | TCP 80・443。完成時は80から443へリダイレクト |
| ECS SG | ALB SGのみ | TCP 8000。API・ヘルスチェック |
| RDS SG | ECS SGのみ | TCP 5432。DB接続 |

アウトバウンドはALBからECSの8000、ECSからRDSの5432、および起動・ログ送信に必要なHTTPS通信を許可する。

## 4. API処理とデータ設計

```mermaid
sequenceDiagram
    actor User as 利用者
    participant React as ブラウザ上のReact
    participant ALB as ALB
    participant API as FastAPI
    participant DB as RDS PostgreSQL
    User->>React: タスクを登録
    React->>ALB: POST /api/tasks（HTTPS・JSON）
    ALB->>API: HTTP:8000へ転送
    API->>API: 入力検証
    API->>DB: SQLAlchemyでINSERT・COMMIT
    DB-->>API: 保存したタスク
    API-->>ALB: 201 Created・JSON
    ALB-->>React: レスポンス
    React-->>User: タスク一覧を更新
```

| Method | Path | 用途 |
|---|---|---|
| GET | `/health` | ALBヘルスチェック |
| GET | `/api/tasks` | 一覧取得 |
| POST | `/api/tasks` | 登録 |
| PATCH | `/api/tasks/{task_id}` | タイトル・完了状態の更新 |
| DELETE | `/api/tasks/{task_id}` | 削除 |

```mermaid
erDiagram
    tasks {
        integer id PK "自動採番"
        varchar_200 title "必須・最大200文字"
        boolean completed "必須・初期値false"
        timestamptz created_at "必須・作成日時"
        timestamptz updated_at "必須・更新日時"
    }
```

スキーマ変更はAlembicで管理する。現在の `/health` はアプリの応答を確認するもので、DB疎通は確認しない。認証・ユーザー別タスク管理はTODOの基本構成に含まれていない。

## 5. 秘密情報とIAM

```mermaid
flowchart LR
    definition["ECS Task Definition / secrets.valueFrom"]
    execution["Task Execution Role"]
    secret["Secrets Manager"]
    ecr["ECR"]
    logs["CloudWatch Logs"]
    container["FastAPIコンテナ / 環境変数"]
    taskrole["Task Role / アプリのAWS API権限"]
    definition -.-> execution
    execution -->|"指定Secretの取得"| secret
    execution -->|"イメージ取得"| ecr
    execution -->|"ログ送信"| logs
    secret -.->|"起動時に注入"| container
    taskrole -.->|"必要な場合に利用"| container
```

TODOではDB Host・Port・Name・User・Passwordを保存する。一方、現在のBackendは `DATABASE_URL` を読み取るため、AWS化時には接続URLをSecretとして追加して注入するか、各項目から接続URLを組み立てる実装が必要。秘密情報をFrontendの環境変数へ入れない。

Task Execution Roleには起動・ログ転送に必要な権限を付与し、Secret参照先を限定する。Task Roleはアプリ自身がAWS APIを呼ぶための権限であり、将来のS3・SQS連携などで利用する。

## 6. CI/CD

CIはPull Requestとmainへのpushで実行する。CDはmainへのpushに対するCI成功後に実行する設計とする。

```mermaid
flowchart TB
    dev["開発者"] -->|"PR / mainへpush"| github["GitHub"]
    github --> ci["GitHub Actions / CI"]
    ci --> backend["Backend / 依存関係取得・pytest・lint"]
    ci --> frontend["Frontend / npm ci・lint・build"]
    ci --> docker["Backend / Docker build"]
    backend --> gate{"全CI成功かつmainへのpush?"}
    frontend --> gate
    docker --> gate
    gate -->|"Yes"| oidc["GitHub OIDC Token"]
    gate -->|"No"| stop["デプロイしない"]
    oidc --> sts["AWS STS / IAM Role引き受け"]
    trust["Trust Policy / Repository・branch条件"] -.-> sts
    sts --> credentials["一時認証情報"]
    credentials --> push["BackendイメージをECRへpush / Commit SHAタグ"]
    push --> definition["新しいTask Definitionを登録"]
    definition --> service["ECS Service更新"]
    service --> task["新タスク起動"]
    task --> health["ALB /health確認"]
    health --> stable["Healthy・安定稼働確認 / 旧タスク停止"]
    credentials --> build["公開API URLを指定してFrontend build"]
    build --> upload["S3へアップロード"]
    upload --> cache["必要に応じてCloudFrontキャッシュ無効化"]
```

GitHub Actionsには `id-token: write` と `contents: read` を設定し、長期Access Keyを保存しない。デプロイ用Roleの権限は対象ECR・ECS・S3・CloudFrontと、必要なRoleへのPassRoleに絞る。

DBマイグレーションの実行タイミングはTODOで未指定。現在はBackend起動時に実行する構成のため、CDで複数タスクが同時起動する段階では、一度だけ実行する方式とスキーマ互換性を検討する。

## 7. ローカル開発構成

```mermaid
flowchart LR
    browser["ブラウザ / React実行"]
    subgraph compose["Docker Compose"]
        frontend["frontend / 開発サーバー:5173"]
        backend["backend / FastAPI:8000"]
        db[("db / PostgreSQL:5432")]
        volume["postgres_data / 永続ボリューム"]
        frontend -.->|"backendのhealthyを待つ"| backend
        backend -.->|"dbのhealthyを待つ"| db
        backend -->|"DATABASE_URL / db:5432"| db
        db --- volume
    end
    browser -->|"localhost:5173 / 静的ファイル取得"| frontend
    browser -->|"localhost:8000 / API呼び出し"| backend
```

## 8. 障害調査の流れ

```mermaid
flowchart TD
    issue["APIへ接続できない"] --> dns["DNS・証明書・ALB Listenerを確認"]
    dns --> tg["Target Group / Healthy状態・Port・Path"]
    tg --> service["ECS Service / Deployment・イベント"]
    service --> task["ECS Task / 起動状態・Stopped Reason"]
    task --> logs["CloudWatch Logs / 起動・リクエスト・エラー"]
    logs --> network["SG・ルート・Container Port"]
    logs --> db["RDS状態・接続情報・RDS SG"]
    task --> startup["ECR・Secrets Managerへの到達性 / Execution Role権限"]
    deploy["GitHub Actionsの認証失敗"] --> iam["OIDC・Trust Policy・Repository・branch条件"]
```

## 9. 発展課題とTerraform化

以下は基本構成の完成後に追加する構成。Workerの実行基盤など、TODOで未指定の項目は実装時に決定する。

```mermaid
flowchart LR
    api["FastAPI"] -->|"アップロード / Presigned URL発行"| s3["ファイル用S3"]
    api -->|"Message送信"| sqs["SQS"]
    worker["Worker"] -->|"Message取得・成功後削除"| sqs
    worker --> external["外部API"]
    sqs -->|"処理失敗が規定回数に到達"| dlq["Dead Letter Queue"]
    scheduler["EventBridge Scheduler"] --> batch["Lambda または ECS Task / 定期処理"]
    metrics["CPUなどのメトリクス"] --> scaling["ECS Service Auto Scaling"]
    metrics --> alarm["CloudWatch Alarm"]
    terraform["Terraform / Phase 12"] -.-> infra["学習したAWSリソースをコード化・再構築"]
```

Terraform化はConsole / CLIで手動構築を理解した後に行う。再構築後はGitHub Actionsによるデプロイとブラウザからの動作確認までを完了条件とする。
