サーバーに入る
ssh -i $HOME\.ssh\id_ed25519_sakura ubuntu@160.16.50.238

cd /opt/law-review

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

##Localhost での更新
ローカル開発（ホットリロード）
docker compose --profile local up -d --build
本番起動
docker compose --profile production up -d --build
依存関係が怪しい時
docker compose --profile production build --no-cache web backend
docker compose --profile production up -d --force-recreate
