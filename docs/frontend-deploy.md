# FrontendをGitHub ActionsからS3へデプロイ

`.github/workflows/deploy-frontend.yml` は、frontendまたはworkflowを変更したPRを `main` にマージすると実行されます。`push` イベントを使うため、`main` への直接pushでも実行されます。PR経由に限定する場合はGitHubのブランチ保護で直接pushを制限してください。Actions画面の「Run workflow」から `main` を指定して手動実行することもできます。

実行環境で `npm ci` → `npm run build` を行い、生成された `frontend/dist/` の**中身**を既存S3バケットのルートへアップロードします。ローカルのdistをコミットする必要はありません。

## 1. GitHubのVariablesを登録

リポジトリの Settings → Secrets and variables → Actions → Variables に登録します。

| 名前 | 設定例 | 必須 |
| --- | --- | --- |
| `AWS_REGION` | `ap-northeast-1` | 必須 |
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/github-frontend-deploy` | 必須 |
| `S3_BUCKET` | `my-frontend-bucket`（`s3://` やパスは含めない） | 必須 |
| `VITE_API_URL` | `https://api.example.com` | 必須 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1234567890ABC` | 任意 |

`VITE_API_URL` はビルド時にJavaScriptへ埋め込まれる公開情報です。アクセスキーなどの秘密情報は設定しないでください。

## 2. AWS側でOIDCとIAMロールを設定

IAMでGitHub用OpenID Connectプロバイダーを登録します。

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

IAMロールの信頼ポリシー例です。`ACCOUNT_ID`、`OWNER`、`REPOSITORY` を置換します。この例は標準の名前ベースのOIDC subject用です。リポジトリでimmutable subjectや独自subjectを使用している場合は、`sub` を実際の設定に合わせてください。

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:OWNER/REPOSITORY:ref:refs/heads/main"
      }
    }
  }]
}
```

このロールに次の権限ポリシーを付与します。`BUCKET_NAME` を実際のバケット名へ置換してください。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::BUCKET_NAME"
    },
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/*"
    }
  ]
}
```

CloudFrontを使う場合は、ロールに `cloudfront:CreateInvalidation` を対象の `arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID` に限定して追加します。SSE-KMSで暗号化するバケットでは、使用するKMSキーの権限も別途必要です。

OIDCの詳細: [GitHub公式ドキュメント](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

## 更新時の挙動

- 同名ファイルを更新し、新しいファイルを追加します。S3にだけ存在するファイルは残します。
- アセットを先に転送し、最後に `index.html` を `Cache-Control: no-cache` 付きで更新します。
- 完全同期して不要なファイルを削除したい場合は、フロントエンド専用バケットであることを確認し、syncに `--delete`、IAMに `s3:DeleteObject` を追加します。旧アセットを削除すると、更新前から開いているページが読み込みに失敗する場合があります。
- CloudFrontのIDを設定した場合は `/*` の無効化を申請します。workflowは無効化の完了を待たないため、配信への反映には少し時間がかかります。
- S3バケットの作成・公開設定、CloudFrontの作成はこのサンプルの対象外です。既存の配信環境へアップロードします。

同期の仕様: [AWS CLI s3 sync](https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html)
