# 小規模Webアプリ × AWS × CI/CD 学習TODO

## 目的

小規模なWebアプリをローカルで作成し、AWSへホスティングし、GitHub Actionsを使ってCI/CDまで構築する。

この学習では、AWSサービスを個別に暗記するのではなく、実際のWebアプリをAWS上で動かす過程で以下を身につける。

- DockerでWebアプリを動かす
- AWSのネットワーク構成を理解する
- ECS / FargateへAPIをデプロイする
- RDS PostgreSQLを利用する
- ALB経由でAPIへアクセスする
- CloudWatchでログを確認する
- Secrets Managerで秘密情報を管理する
- S3 / CloudFrontでフロントエンドを公開する
- Route 53 / ACMで独自ドメイン・HTTPS化する
- GitHub ActionsでCI/CDを構築する
- GitHub ActionsからOIDCを使ってAWSへ認証する
- 障害時にどこを確認すべきか判断できるようになる

---

# 全体構成

最終的には以下の構成を目標とする。

```text
                         Internet
                            │
                       Route 53
                            │
               ┌────────────┴────────────┐
               │                         │
           CloudFront                   ALB
               │                         │
               ▼                         ▼
              S3                    ECS Fargate
           React App                     │
                                         ▼
                                      FastAPI
                                         │
                                         ▼
                                  RDS PostgreSQL

ECS ───────────────→ Secrets Manager
ECS ───────────────→ CloudWatch Logs

GitHub
   │
   ▼
GitHub Actions
   │
   ├─ Test / Lint
   ├─ Docker Build
   ├─ ECR Push
   └─ ECS Deploy
```

---

# 学習時間の目安

| Phase | 内容 | 目安時間 |
|---|---|---:|
| Phase 1 | ローカルアプリ作成 | 5〜10h |
| Phase 2 | AWSへ手動デプロイ | 15〜20h |
| Phase 3 | CI構築 | 3〜5h |
| Phase 4 | CD構築 | 5〜10h |
| Phase 5 | フロントエンド公開 | 3〜5h |
| Phase 6 | Route 53 / HTTPS | 3〜5h |
| Phase 7 | 運用・障害調査 | 5〜10h |
| **合計** |  | **39〜65h** |

---

# Phase 0. 事前準備

## Git / GitHub

- [ ] GitHub Repositoryを作成する
- [ ] `main` ブランチを用意する
- [ ] `.gitignore` を設定する
- [ ] READMEを作成する
- [ ] ローカルからGitHubへpushできることを確認する

## 開発環境

- [ ] Dockerが利用できることを確認する
- [ ] Docker Composeが利用できることを確認する
- [ ] AWS CLIをインストールする
- [ ] `aws --version` を確認する
- [ ] AWS CLIでAWSへアクセスできることを確認する
- [ ] GitHub Actionsを利用できることを確認する

---

# Phase 1. ローカルで小規模Webアプリを作成する

**目安：5〜10時間**

複雑な業務ロジックは作らず、AWS学習に集中できる程度のアプリにする。

## アプリ仕様

タスク管理アプリを例とする。

### 機能

- [x] タスク一覧取得
- [x] タスク登録
- [x] タスク更新
- [x] タスク削除
- [x] 完了 / 未完了の切り替え

## Backend

FastAPIを使用する。

- [x] FastAPIプロジェクトを作成する
- [x] `/health` APIを作成する
- [x] タスク一覧APIを作成する
- [x] タスク登録APIを作成する
- [x] タスク更新APIを作成する
- [x] タスク削除APIを作成する
- [x] SQLAlchemyでPostgreSQLへ接続する
- [x] DB接続情報を環境変数から取得する
- [x] APIの単体テストを最低1つ作成する

## Database

PostgreSQLを使用する。

- [x] `tasks` テーブルを作成する
- [x] Primary Keyを設定する
- [x] titleカラムを作成する
- [x] completedカラムを作成する
- [x] created_at / updated_atを作成する
- [x] AlembicでMigrationできるようにする

## Frontend

Reactを使用する。

- [x] Reactプロジェクトを作成する
- [x] タスク一覧画面を作成する
- [x] タスク登録ができるようにする
- [x] タスク更新ができるようにする
- [x] タスク削除ができるようにする
- [x] Backend APIのURLを環境変数化する

## Docker

- [x] Backend用Dockerfileを作成する
- [x] Frontend用Dockerfileを作成する
- [x] PostgreSQLをDocker Composeで起動する
- [x] `frontend`
- [x] `backend`
- [x] `db`
- [x] の3サービスをComposeで起動する
- [x] Frontend → Backend通信を確認する
- [x] Backend → PostgreSQL通信を確認する

## 完了条件

以下がローカルで動くこと。

```text
Browser
  ↓
React
  ↓
FastAPI
  ↓
PostgreSQL
```

---

# Phase 2. AWSへBackendを手動デプロイする

**目安：15〜20時間**

最初はCI/CDを使わず、AWS Console / CLIから手動でデプロイする。

---

## 2-1. VPC

- [ ] 学習用VPCを作成する
- [ ] VPCのCIDRを決める
- [ ] Public Subnetを2つ作成する
- [ ] Private Subnetを2つ作成する
- [ ] Availability Zoneを分ける
- [ ] Internet Gatewayを作成する
- [ ] VPCへInternet Gatewayをアタッチする
- [ ] Public Subnet用Route Tableを作成する
- [ ] `0.0.0.0/0 → Internet Gateway` を設定する
- [ ] Private Subnet用Route Tableを作成する

### 確認

- [ ] Public Subnetが「Public」になる条件を説明できる
- [ ] Private Subnetが「Private」になる理由を説明できる
- [ ] Route Tableの役割を説明できる

---

## 2-2. Security Group

### ALB用Security Group

- [ ] ALB用Security Groupを作成する
- [ ] HTTP `80` をInternetから許可する
- [ ] 後でHTTPS `443` を許可できるようにする

### ECS用Security Group

- [ ] ECS用Security Groupを作成する
- [ ] BackendのContainer Portを許可する
- [ ] 接続元をALBのSecurity Groupのみにする

### RDS用Security Group

- [ ] RDS用Security Groupを作成する
- [ ] PostgreSQL `5432` を許可する
- [ ] 接続元をECSのSecurity Groupのみにする

### 確認

以下を説明できる。

```text
Internet
  ↓ :80 / :443
ALB SG
  ↓ Backend Port
ECS SG
  ↓ :5432
RDS SG
```

---

## 2-3. ECR

- [ ] ECR Repositoryを作成する
- [ ] AWS CLIでECRへログインする
- [ ] Backend Docker Imageをbuildする
- [ ] Docker Imageへtagを付与する
- [ ] ECRへpushする
- [ ] ECR上でImageを確認する

### 確認

- [ ] Repositoryとは何か説明できる
- [ ] Image Tagとは何か説明できる
- [ ] Image Digestとは何か説明できる

---

## 2-4. RDS PostgreSQL

- [ ] RDS用DB Subnet Groupを作成する
- [ ] Private SubnetをDB Subnet Groupへ設定する
- [ ] PostgreSQL RDSを作成する
- [ ] Public Accessを無効にする
- [ ] RDS用Security Groupを設定する
- [ ] DB Endpointを確認する
- [ ] Database Nameを確認する
- [ ] DB Userを作成する

### 確認

- [ ] RDSをPrivate Subnetに置く理由を説明できる
- [ ] EndpointとIPアドレスの違いを説明できる
- [ ] DB Subnet Groupの役割を説明できる

---

## 2-5. Secrets Manager

- [ ] DB Hostを登録する
- [ ] DB Portを登録する
- [ ] DB Nameを登録する
- [ ] DB Userを登録する
- [ ] DB Passwordを登録する
- [ ] Secret ARNを確認する

### IAM

- [ ] ECS Task Execution Roleを確認する
- [ ] Secrets Managerの値を取得する権限を付与する
- [ ] 必要なSecretだけ取得できるよう権限を絞る

### 確認

- [ ] ARNとは何か説明できる
- [ ] `valueFrom` の役割を説明できる
- [ ] Secretを取得する際にIAM権限が必要な理由を説明できる

---

## 2-6. ECS / Fargate

### ECS Cluster

- [ ] ECS Clusterを作成する

### Task Definition

- [ ] Fargate用Task Definitionを作成する
- [ ] CPUを設定する
- [ ] Memoryを設定する
- [ ] ECR Imageを設定する
- [ ] Container Portを設定する
- [ ] CloudWatch Logsを設定する
- [ ] Secrets Managerの値を環境変数として設定する
- [ ] Task Execution Roleを設定する
- [ ] Task Roleを設定する

### ECS Service

- [ ] ECS Serviceを作成する
- [ ] Desired Countを1に設定する
- [ ] Private SubnetへTaskを配置する
- [ ] ECS用Security Groupを設定する

### 確認

以下の違いを説明できる。

- [ ] Cluster
- [ ] Task Definition
- [ ] Task
- [ ] Service
- [ ] Container Definition
- [ ] Task Role
- [ ] Task Execution Role

---

## 2-7. ALB

### Target Group

- [ ] Target Groupを作成する
- [ ] Target Typeを理解する
- [ ] BackendのPortを指定する
- [ ] `/health` をHealth Check Pathへ設定する

### ALB

- [ ] Application Load Balancerを作成する
- [ ] Public Subnetへ配置する
- [ ] ALB用Security Groupを設定する
- [ ] Listener `HTTP:80` を作成する
- [ ] Target GroupへForwardする

### ECS

- [ ] ECS ServiceとTarget Groupを紐付ける
- [ ] ECS TaskがTarget Groupへ登録されることを確認する
- [ ] Health CheckがHealthyになることを確認する

### 動作確認

- [ ] ALB DNS Nameを確認する
- [ ] Browser / curlからALBへアクセスする
- [ ] `/health` が200になることを確認する
- [ ] タスクAPIへアクセスできることを確認する

### 確認

以下を説明できる。

```text
Browser
  ↓
ALB Listener
  ↓
Target Group
  ↓
ECS Task
  ↓
Container Port
  ↓
FastAPI
```

---

# Phase 3. CloudWatchでログを確認する

**目安：2〜3時間**

- [ ] CloudWatch Log Groupを確認する
- [ ] ECS TaskごとのLog Streamを確認する
- [ ] FastAPIの起動ログを確認する
- [ ] HTTPリクエストログを確認する
- [ ] アプリケーションエラーを意図的に発生させる
- [ ] CloudWatchからエラーを探す
- [ ] ECS Task停止理由を確認する方法を理解する

### 確認

以下の障害時に確認する場所を説明できる。

```text
APIへ接続できない
  ↓
ALB
  ↓
Target Group
  ↓
ECS Service
  ↓
ECS Task
  ↓
CloudWatch Logs
```

---

# Phase 4. GitHub ActionsでCIを作成する

**目安：3〜5時間**

## Workflow

- [ ] `.github/workflows/ci.yml` を作成する
- [ ] Pull Request作成時にWorkflowを実行する
- [ ] `main` push時にWorkflowを実行する

## Backend

- [ ] Python依存関係をinstallする
- [ ] pytestを実行する
- [ ] lintを実行する

## Frontend

- [ ] npm依存関係をinstallする
- [ ] lintを実行する
- [ ] buildを実行する

## Docker

- [ ] Backend Docker Imageをbuildする
- [ ] Docker build失敗時にCIが失敗することを確認する

## 完了条件

```text
Pull Request
    ↓
GitHub Actions
    ├─ Backend Test
    ├─ Backend Lint
    ├─ Frontend Lint
    ├─ Frontend Build
    └─ Docker Build
```

---

# Phase 5. GitHub ActionsからAWSへOIDC認証する

**目安：2〜4時間**

長期Access KeyをGitHubへ保存する方式は使わず、OIDCを利用する。

## AWS IAM

- [ ] GitHub Actions用OIDC ProviderをAWSへ登録する
- [ ] GitHub Actions用IAM Roleを作成する
- [ ] Trust Policyを設定する
- [ ] GitHub Repositoryを条件に設定する
- [ ] 必要に応じてbranchを条件に設定する

## GitHub Actions

- [ ] `id-token: write` を設定する
- [ ] `contents: read` を設定する
- [ ] AWS RoleをAssumeできるようにする
- [ ] GitHub Actionsから `aws sts get-caller-identity` を実行する
- [ ] 一時CredentialでAWSへアクセスできることを確認する

## 確認

以下を説明できる。

```text
GitHub Actions
      │
      │ OIDC Token
      ▼
     AWS STS
      │
      │ AssumeRole
      ▼
Temporary Credentials
```

- [ ] Access Keyを長期間保存しなくてよい理由を説明できる
- [ ] OIDC Providerの役割を説明できる
- [ ] IAM RoleのTrust Policyの役割を説明できる

---

# Phase 6. GitHub ActionsでCDを作成する

**目安：5〜10時間**

## ECR Push

- [ ] GitHub ActionsでDocker Imageをbuildする
- [ ] ECRへログインする
- [ ] ECRへDocker Imageをpushする
- [ ] Commit SHAなどをImage Tagとして利用する
- [ ] `latest` の扱いを考える

## ECS Deploy

- [ ] 新しいImageを利用するTask Definitionを作成する
- [ ] ECS Serviceへ新しいTask Definitionを反映する
- [ ] ECS Deploymentが開始されることを確認する
- [ ] 新しいTaskが起動することを確認する
- [ ] ALB Health CheckがHealthyになることを確認する
- [ ] 古いTaskが停止することを確認する

## 完了条件

以下が自動化されている。

```text
git push main
       │
       ▼
GitHub Actions
       │
       ├─ Test
       ├─ Lint
       ├─ Docker Build
       │
       ▼
      ECR
       │
       ▼
Task Definition更新
       │
       ▼
ECS Service Deploy
       │
       ▼
New Task
       │
       ▼
ALB Health Check
```

---

# Phase 7. FrontendをS3 / CloudFrontへデプロイする

**目安：3〜5時間**

## S3

- [ ] Frontendをproduction buildする
- [ ] S3 Bucketを作成する
- [ ] Public Access Blockを有効にする
- [ ] build結果をS3へ配置する

## CloudFront

- [ ] CloudFront Distributionを作成する
- [ ] S3をOriginとして設定する
- [ ] S3を直接PublicにせずCloudFront経由で配信する
- [ ] Frontendへアクセスできることを確認する

## GitHub Actions

- [ ] Frontend buildを自動化する
- [ ] S3 uploadを自動化する
- [ ] 必要に応じてCloudFront Cache Invalidationを実行する

## 完了条件

```text
Browser
  ↓
CloudFront
  ↓
S3
  ↓
React
```

---

# Phase 8. Route 53 / ACMで独自ドメイン・HTTPS化する

**目安：3〜5時間**

## Route 53

- [ ] 独自ドメインを用意する
- [ ] Hosted Zoneを確認する
- [ ] DNS Recordを設定する

## ACM

- [ ] ACM Certificateを発行する
- [ ] DNS Validationを行う

## Frontend

- [ ] CloudFrontへ独自ドメインを設定する
- [ ] ACM Certificateを設定する

## Backend

- [ ] ALBへHTTPS `443` Listenerを追加する
- [ ] ACM Certificateを設定する
- [ ] HTTP `80` → HTTPS `443` Redirectを設定する
- [ ] `api.example.com` のようなサブドメインをALBへ設定する

## 完了条件

```text
https://example.com
        ↓
     CloudFront
        ↓
        S3

https://api.example.com
        ↓
       ALB
        ↓
      ECS
        ↓
      RDS
```

---

# Phase 9. 障害調査を練習する

**目安：5〜10時間**

正常系だけではなく、意図的に設定を壊して原因を調査する。

---

## Security Group障害

- [ ] ECS SGからALBの通信許可を削除する
- [ ] 接続できなくなることを確認する
- [ ] Target Groupの状態を確認する
- [ ] SGが原因だと特定する
- [ ] 設定を戻す

---

## Container Port障害

- [ ] Task DefinitionのContainer Portを間違える
- [ ] Target GroupがUnhealthyになることを確認する
- [ ] ALB / ECS / Container Portの関係から原因を特定する

---

## Health Check障害

- [ ] Health Check Pathを存在しないPathへ変更する
- [ ] Unhealthyになることを確認する
- [ ] HTTP Statusを確認する
- [ ] `/health` へ戻す

---

## RDS接続障害

- [ ] RDS Security Groupを変更する
- [ ] BackendがDBへ接続できなくなることを確認する
- [ ] CloudWatch Logsからエラーを確認する
- [ ] RDS SGが原因だと特定する

---

## Secrets Manager障害

- [ ] DB Passwordを意図的に間違える
- [ ] Application起動失敗を確認する
- [ ] CloudWatch Logsを確認する
- [ ] Secretの値を戻す

---

## IAM障害

- [ ] Secrets Manager参照権限を外す
- [ ] ECS Taskの起動に失敗することを確認する
- [ ] ECSのStopped Reasonを確認する
- [ ] IAM権限不足だと判断する

---

## GitHub Actions障害

- [ ] IAM RoleのTrust Policy条件を意図的に間違える
- [ ] GitHub ActionsからAssumeRoleできなくなることを確認する
- [ ] エラー内容から原因を確認する

---

# Phase 10. AWSサービスと基礎知識を結びつける

アプリ完成後、以下を説明できるか確認する。

## Network

- [ ] VPCとは何か
- [ ] Subnetとは何か
- [ ] Public / Private Subnetの違い
- [ ] Route Tableとは何か
- [ ] Internet Gatewayとは何か
- [ ] NAT Gatewayとは何か
- [ ] Security Groupとは何か
- [ ] DNSとは何か
- [ ] TCP Portとは何か

## Docker / ECS

- [ ] Containerとは何か
- [ ] ECS TaskとLinux Processの関係
- [ ] Container Portとは何か
- [ ] ECS Serviceとは何か
- [ ] Desired Countとは何か
- [ ] Graceful Shutdownとは何か

## HTTP

- [ ] BrowserからALBまで何が起きるか
- [ ] ALBからECSまで何が起きるか
- [ ] HTTPとTCPの関係
- [ ] HTTPSとTLSの関係
- [ ] Certificateの役割

## Database

- [ ] BackendからRDSへどう接続するか
- [ ] Connectionとは何か
- [ ] Connection Poolとは何か
- [ ] Transactionとは何か

## IAM

- [ ] IAM UserとIAM Roleの違い
- [ ] IAM Policyの役割
- [ ] Task RoleとTask Execution Roleの違い
- [ ] OIDCを使うメリット

---

# Phase 11. 発展課題

基本構成が完成した後に取り組む。

---

## S3ファイルアップロード

- [ ] 画像アップロード機能を作成する
- [ ] S3 Bucketを用意する
- [ ] BackendからS3へアップロードする
- [ ] Presigned URLを利用してみる
- [ ] IAM RoleでS3アクセスを制御する

---

## SQS

- [ ] SQS Queueを作成する
- [ ] APIからMessageを送信する
- [ ] WorkerでMessageを取得する
- [ ] 処理成功後にMessageを削除する
- [ ] Visibility Timeoutを理解する
- [ ] Retryを確認する
- [ ] Dead Letter Queueを作成する

構成例：

```text
API
 ↓
SQS
 ↓
Worker
 ↓
外部API
```

---

## EventBridge

- [ ] EventBridge Schedulerを作成する
- [ ] LambdaまたはECS Taskを定期実行する
- [ ] バッチ処理を作成する

---

## Auto Scaling

- [ ] ECS Service Auto Scalingを設定する
- [ ] CPU使用率などを条件にScale Outする
- [ ] Scale Inすることを確認する
- [ ] StatelessなApplicationが必要な理由を理解する

---

## CloudWatch Alarm

- [ ] CPU使用率Alarmを作成する
- [ ] ALB 5xx Alarmを作成する
- [ ] ECS Task Countの監視を考える
- [ ] RDSのCPU / Connection数を確認する

---

# Phase 12. Terraformで再構築する

ここは最後に行う。

最初からTerraformを利用せず、一度Console / CLIで構成を理解してからコード化する。

## Terraform基礎

- [ ] Terraformをインストールする
- [ ] Providerを理解する
- [ ] Resourceを理解する
- [ ] Variableを理解する
- [ ] Outputを理解する
- [ ] Stateを理解する

## AWS Infrastructure

以下をTerraform化する。

- [ ] VPC
- [ ] Subnet
- [ ] Route Table
- [ ] Internet Gateway
- [ ] Security Group
- [ ] ALB
- [ ] Target Group
- [ ] ECS Cluster
- [ ] ECS Task Definition
- [ ] ECS Service
- [ ] ECR
- [ ] RDS
- [ ] Secrets Manager
- [ ] IAM Role
- [ ] CloudWatch Log Group

## 最終課題

- [ ] 学習環境を一度削除する
- [ ] TerraformからAWS環境を再構築する
- [ ] GitHub ActionsからアプリをDeployする
- [ ] Browserから動作確認する

---

# 最終到達目標

この学習終了時に、以下の構成を自分で説明・構築・調査できることを目標とする。

```text
Developer
    │
    │ git push
    ▼
GitHub
    │
    ▼
GitHub Actions
    │
    ├─ Test
    ├─ Lint
    ├─ Docker Build
    │
    ├─ OIDC
    │    ↓
    │   AWS IAM Role
    │
    ├─ ECR Push
    │
    └─ ECS Deploy


User
 │
 ▼
DNS
 │
 ▼
Route 53
 │
 ├───────────────┐
 │               │
 ▼               ▼
CloudFront       ALB
 │               │
 ▼               ▼
S3              ECS
React             │
                  ▼
               FastAPI
                  │
                  ▼
                 RDS

ECS ─────→ Secrets Manager
ECS ─────→ CloudWatch Logs
```

以下について「設定方法」だけでなく「なぜ必要なのか」を説明できる状態を目標とする。

- [ ] なぜALBが必要なのか
- [ ] なぜECSをPrivate Subnetへ配置するのか
- [ ] なぜRDSをInternetへ公開しないのか
- [ ] なぜSecurity Groupを分けるのか
- [ ] なぜSecrets Managerを使うのか
- [ ] なぜCloudWatch Logsが必要なのか
- [ ] なぜGitHub ActionsからOIDCを使うのか
- [ ] なぜCIとCDを分けて考えるのか
- [ ] なぜHealth Checkが必要なのか
- [ ] 障害時にどこから調査を始めるべきか

---

# 学習方針

分からない項目をすべて先に勉強してから構築するのではなく、

```text
作る
 ↓
問題が起きる
 ↓
調べる
 ↓
仕組みを理解する
 ↓
直す
 ↓
もう一度作る
```

のサイクルで進める。

特に、AWS Console上の設定だけを見るのではなく、

```text
AWS
 ↓
Network
 ↓
Linux
 ↓
Docker
 ↓
Application
```

まで原因を掘り下げることを意識する。
