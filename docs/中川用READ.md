サーバーに入る
ssh -i $HOME\.ssh\id_ed25519_sakura [ubuntu@160.16.50.238](mailto:ubuntu@160.16.50.238)

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

Localhost での更新
docker compose --profile local up -d --build web

Dev 環境構築＝ホットリロード（依存関係を変更した場合再度実行）
docker compose --profile local up -d --build web-dev

本番モードに戻す
docker compose --profile production up -d --build web

強制リフレッシュ版（「反映されない」「依存関係が怪しい」時だけ）
cd /opt/law-review
git pull origin main

# キャッシュを捨てて確実に新規ビルド

docker compose --profile production build --no-cache web backend

# 作り直し（必要なら down をここで入れる）

docker compose --profile production up -d --force-recreate

※ それでもおかしい時だけ、最後の手段として：

docker compose --profile production down
docker compose --profile production up -d

“環境変数が空”事故を防ぐ（任意だけどおすすめ）

以前 GOOGLE_CLIENT_ID 系が未設定で WARN が出ていたので、デプロイ前にこれを入れておくと事故が減ります。

cd /opt/law-review
test -f .env && echo ".env OK" || echo "WARNING: .env がありません（環境変数が空になる可能性）"

さらに厳密にしたいなら（必要なキーが空なら止める）：

grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|NEXT_PUBLIC_GOOGLE_CLIENT_ID)=' .env

片付け（任意：ディスク節約）

ビルドを回すと古いイメージが溜まるので、たまに：

docker image prune -f
