サーバーに入る
ssh -i $HOME\.ssh\id_ed25519_sakura [ubuntu@160.16.50.238](mailto:ubuntu@160.16.50.238)

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
