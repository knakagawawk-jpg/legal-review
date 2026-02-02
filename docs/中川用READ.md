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

# 3-1) エラーが発生した場合のデバッグ手順
# backendコンテナの状態確認
docker ps -a --filter "name=law-review-backend"
# backendコンテナのログ確認（エラー原因の特定）
docker logs law-review-backend --tail=100
# backendコンテナのヘルスチェック状態確認
docker inspect law-review-backend --format '{{json .State.Health}}' | python3 -m json.tool

# 3-2) データベーススキーマエラーの場合（例: no such column: grading_impression_text）
# マイグレーションを手動実行（コンテナ内で実行）
docker exec law-review-backend python3 /app/app/migrate_grading_impression_to_official_questions.py
# または、コンテナを再起動（entrypoint.shで自動実行される）
docker compose --profile production restart backend

# 3-3) web/proxyコンテナが起動していない場合
# backendがhealthyになったら、webとproxyを起動
docker compose --profile production up -d web proxy
# または、全コンテナを再起動
docker compose --profile production up -d --force-recreate

# 3-4) 接続拒否・SSL証明書エラーの場合
# 全コンテナの状態確認
docker compose --profile production ps
# webコンテナの状態確認
docker ps -a --filter "name=law-review-web"
docker logs law-review-web --tail=50
# proxyコンテナのログ確認（SSL証明書エラーなど）
docker logs law-review-proxy --tail=100
# ポートが開いているか確認
sudo netstat -tlnp | grep -E ':(80|443)'
# または
sudo ss -tlnp | grep -E ':(80|443)'
# DNS設定確認（サーバー上から）
nslookup juristutor-ai.com
# コンテナ間の接続確認（proxyからwebへ）
docker exec law-review-proxy wget -O- http://web:3000/api/health
# 全コンテナを再起動
docker compose --profile production restart

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

# 6) DBファイルの存在確認（管理者ページのセレクトにβ/本番が出ないとき）
# ホスト: ls -la data/*.db
# コンテナ内: docker exec law-review-backend-dev ls -la /data/*.db
# コンテナ内の /data が空の場合 → .env に LAW_REVIEW_DATA_DIR=/opt/law-review/data を追加し、
# docker compose --profile dev up -d --force-recreate backend-dev web-dev-server で再作成

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
# サーバーのDBにJSONを追加（インポート）する
# ============================================
# 1) サーバーに入り、最新コード（JSON含む）を取得
#    ssh -i $HOME\.ssh\id_ed25519_sakura ubuntu@160.16.50.238
#    cd /opt/law-review
#    git pull origin main

# 2) 対象環境のコンテナでインポートスクリプトを実行
#    scripts/, data/, config/ をマウントする（H21/H22の公法系・刑事系・民事系対応に config が必要）
# 本番（prod.db に追加）:
#    docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py
# β（beta.db に追加）:
#    docker compose --profile beta run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-beta python /app/scripts/import_all_json_to_db.py
# 開発（dev.db に追加）:
#    docker compose --profile dev run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-dev python /app/scripts/import_all_json_to_db.py

# 特定年度のみインポートする場合は --years を付ける（例: --years R4 R6）
#    docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py --years R4 R6

# 既存データを上書きしたい場合は --update を付ける
#    docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py --update

# --- 司法試験データを dev/beta/本番 すべてに反映する場合 ---
# 上記1)の後に、各環境で順に実行:
#    docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py
#    docker compose --profile beta run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-beta python /app/scripts/import_all_json_to_db.py
#    docker compose --profile dev run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-dev python /app/scripts/import_all_json_to_db.py

# ============================================
# DBにデータが入っているか確認するコマンド
# ============================================
# 環境変数 DATABASE_URL で指定したDBを使う。例: sqlite:///./data/dev.db → data/dev.db
# 本番/β/開発ではコンテナ内の /data/dev.db や /data/beta.db など。

# 方法1) コンテナ内で sqlite3 で確認（サーバー上でDBファイルに直接アクセスする場合）
# 本番: docker exec -it law-review-backend sqlite3 /data/prod.db "SELECT id, shiken_type, nendo, subject_id, status, substr(text,1,40) FROM official_questions WHERE shiken_type='shihou' ORDER BY nendo DESC, subject_id LIMIT 20;"
# β:   docker exec -it law-review-backend-beta sqlite3 /data/beta.db "SELECT id, shiken_type, nendo, subject_id, status FROM official_questions WHERE shiken_type='yobi' AND nendo=2022 ORDER BY subject_id;"
# 開発: docker exec -it law-review-backend-dev sqlite3 /data/dev.db "SELECT id, shiken_type, nendo, subject_id, status FROM official_questions WHERE shiken_type='yobi' AND nendo=2022 ORDER BY subject_id;"

# 方法2) プロジェクトルートで Python から確認（アプリと同じ DATABASE_URL を使用）
# cd /opt/law-review  のうえで:
# python -c "
# from app.db import SessionLocal
# from app.models import OfficialQuestion
# from config.subjects import get_subject_name
# db = SessionLocal()
# rows = db.query(OfficialQuestion).filter(OfficialQuestion.shiken_type=='yobi', OfficialQuestion.nendo==2022, OfficialQuestion.status=='active').order_by(OfficialQuestion.subject_id).all()
# for r in rows: print(r.id, get_subject_name(r.subject_id), r.nendo)
# db.close()
# "

# ローカル（PowerShell）で確認する例（data/dev.db を使う場合）
# cd law-review
# python -c "from app.db import SessionLocal; from app.models import OfficialQuestion; from config.subjects import get_subject_name; db = SessionLocal(); [print(r.id, get_subject_name(r.subject_id)) for r in db.query(OfficialQuestion).filter(OfficialQuestion.shiken_type=='yobi', OfficialQuestion.nendo==2022).order_by(OfficialQuestion.subject_id).all()]; db.close()"

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
