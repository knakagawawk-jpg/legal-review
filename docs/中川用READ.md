サーバーに入る
ssh -i $HOME\.ssh\id_ed25519_sakura ubuntu@160.16.50.238

cd /opt/law-review

# ============================================
# 本番環境（production）
# ============================================
# ドメイン: juristutor-ai.com

# 0) いま動いてるものを一応見る（任意）
docker compose --profile production ps

# 1) 最新コード取得
git pull origin main

# 2) web/backend をビルド（web を忘れない）
docker compose --profile production build web backend

# 3) コンテナを更新起動（基本は down しない）
docker compose --profile production up -d --force-recreate

# 4) 反映確認（イメージの作成日時を見る）
docker image inspect $(docker inspect law-review-web --format '{{.Image}}') --format 'WEB Created={{.Created}}'
docker image inspect $(docker inspect law-review-backend --format '{{.Image}}') --format 'BE Created={{.Created}}'

# 5) 直近ログ確認（任意）
docker compose --profile production logs --tail=80 web backend

# ============================================
# βテスト環境（beta）
# ============================================
# ドメイン: beta.juristutor-ai.com
# 初回セットアップ: cp .env.beta.example .env.beta して設定を編集

# 0) いま動いてるものを一応見る（任意）
docker compose --profile beta ps

# 1) 最新コード取得
git pull origin main

# 2) web-beta/backend-beta をビルド
docker compose --profile beta build web-beta backend-beta

# 3) コンテナを更新起動
docker compose --profile beta up -d --force-recreate

# 4) 反映確認
docker image inspect $(docker inspect law-review-web-beta --format '{{.Image}}') --format 'WEB-BETA Created={{.Created}}'
docker image inspect $(docker inspect law-review-backend-beta --format '{{.Image}}') --format 'BE-BETA Created={{.Created}}'

# 5) 直近ログ確認（任意）
docker compose --profile beta logs --tail=80 web-beta backend-beta

# ============================================
# 開発環境（dev）
# ============================================
# ドメイン: dev.juristutor-ai.com
# 初回セットアップ: cp .env.dev.example .env.dev して設定を編集
# 注意: 開発環境はホットリロード対応（web-dev-server）

# 0) いま動いてるものを一応見る（任意）
docker compose --profile dev ps

# 1) 最新コード取得
git pull origin main

# 2) web-dev-server/backend-dev をビルド（初回のみ、通常はホットリロードで自動反映）
docker compose --profile dev build web-dev-server backend-dev

# 3) コンテナを更新起動
docker compose --profile dev up -d --force-recreate

# 4) 反映確認
docker image inspect $(docker inspect law-review-web-dev-server --format '{{.Image}}') --format 'WEB-DEV Created={{.Created}}'
docker image inspect $(docker inspect law-review-backend-dev --format '{{.Image}}') --format 'BE-DEV Created={{.Created}}'

# 5) 直近ログ確認（任意）
docker compose --profile dev logs --tail=80 web-dev-server backend-dev

# ============================================
# 全環境を同時に起動する場合
# ============================================
# 注意: proxyサービスが複数ドメインを処理するため、productionプロファイルのみで起動可能
# 全環境を起動: docker compose --profile production --profile beta --profile dev up -d

#Old
フォルダに行く
cd /opt/law-review

Git Pull
git pull origin main

# 3. Docker コンテナを停止

docker compose --profile production down

# 4. バックエンドを再ビルド

docker compose --profile production build --no-cache backend

# 5. コンテナを起動

docker compose --profile production up -d

# ============================================
# ローカル開発環境（local）
# ============================================
# ローカル開発（ホットリロード）
docker compose --profile local up -d --build

# ============================================
# その他の便利なコマンド
# ============================================
# 依存関係が怪しい時（本番環境）
docker compose --profile production build --no-cache web backend
docker compose --profile production up -d --force-recreate

# 依存関係が怪しい時（βテスト環境）
docker compose --profile beta build --no-cache web-beta backend-beta
docker compose --profile beta up -d --force-recreate

# 依存関係が怪しい時（開発環境）
docker compose --profile dev build --no-cache web-dev-server backend-dev
docker compose --profile dev up -d --force-recreate

# 環境ごとの停止
docker compose --profile production down
docker compose --profile beta down
docker compose --profile dev down

# 環境ごとのログ確認
docker compose --profile production logs -f
docker compose --profile beta logs -f
docker compose --profile dev logs -f
