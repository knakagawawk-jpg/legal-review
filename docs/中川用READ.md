サーバーに入る
ssh -i $HOME\.ssh\id_ed25519_sakura ubuntu@160.16.50.238

cd /opt/law-review

# ============================================

# 環境一覧・接続先整理

# ============================================
#
# | 環境 | プロファイル | envファイル | DB | ドメイン/アクセス先 |
# |------|-------------|-------------|-----|---------------------|
# | 本番 | production | .env | prod.db | https://juristutor-ai.com |
# | β | beta | .env.beta | beta.db | https://beta.juristutor-ai.com |
# | dev（サーバー） | dev | .env.dev2 | dev.db | https://dev.juristutor-ai.com |
# | dev（ローカル） | dev | .env.dev1 | dev.db | http://localhost:8081 |
# | local（フロントのみ） | local | .env | dev.db | http://localhost:8080 |
#
# 【重要】本番の .env は DATABASE_URL=sqlite:////data/prod.db にすること
# 【npm run dev】Next.js単体起動時は web_next/.env.local で BACKEND_INTERNAL_URL=http://127.0.0.1:8000 を設定
#
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

# 開発環境（dev）- dev1（ローカル）と dev2（サーバー）に分離

# ============================================

# ・dev1: ローカル（localhost）用 → .env.dev1（Basic認証なし、CADDY_DOMAIN_DEV=localhost）

# ・dev2: サーバー用 → .env.dev2（Basic認証あり、CADDY_DOMAIN_DEV=dev.juristutor-ai.com）

# 初回セットアップ:

#   ローカル用: cp .env.dev1.example .env.dev1 して設定を編集

#   サーバー用: cp .env.dev2.example .env.dev2 して設定を編集

# 起動（推奨: スクリプトで確実に起動）:

#   dev1（ローカル）: .\scripts\dev1-up.ps1  → http://localhost:8081（接続拒否のときは http://localhost:3000 を利用）

#   dev2（サーバー）: .\scripts\dev2-up.ps1  → https://dev.juristutor-ai.com

# 手動で起動する場合（dev1 では CADDYFILE_DEV_PATH も必須。さもないと proxy が正しく動かず接続拒否になることがあります）:

#   PowerShell（ローカル）: $env:DEV_ENV_FILE=".env.dev1"; $env:CADDYFILE_DEV_PATH="./Caddyfile.dev.local"; docker compose --profile dev up -d

#   PowerShell（サーバー）: $env:DEV_ENV_FILE=".env.dev2"; docker compose --profile dev up -d

#   Bash（Linux/Mac のみ。PowerShell では不可）:

#      DEV_ENV_FILE=.env.dev1 CADDYFILE_DEV_PATH=./Caddyfile.dev.local docker compose --profile dev up -d

#      DEV_ENV_FILE=.env.dev2 docker compose --profile dev up -d

# 未指定の場合は従来どおり .env.dev が使われます（後方互換）

# 接続拒否になった場合: http://localhost:3000 で直接アクセス可能（proxy 経由ではなく web-dev-server 直）。または上記のとおり DEV_ENV_FILE と（dev1のときは）CADDYFILE_DEV_PATH を設定してから up するか、\scripts\dev1-up.ps1 を実行。docker compose --profile dev ps で backend-dev / web-dev-server / proxy-dev の3つが running か確認。

# 注意: 開発環境はホットリロード対応（web-dev-server）

# --- devローカルでよくある問題と対処 ---
# ・8000 が「古いVer」: dev ではバックエンドはコンテナ内の backend-dev:8000 のみ。ホストの 8000 は本番用や別プロセスなので、dev では 8081 または 3000 でフロントにアクセスすること。
# ・8081 が接続拒否:
#   1) .env.dev1 があるか確認（無ければ cp .env.dev1.example .env.dev1 して編集）
#   2) 必ず .\scripts\dev1-up.ps1 で起動する（DEV_ENV_FILE と CADDYFILE_DEV_PATH が設定される）
#   3) docker compose --profile dev ps で backend-dev / web-dev-server / proxy-dev の3つが running か確認
#   4) いずれか unhealthy なら: docker compose --profile dev logs backend-dev web-dev-server proxy-dev で原因確認
# ・3000 で Google 認証が利かない:
#   本アプリは Google Identity Services（One Tap）を使っているため、開いているオリジンが「承認済みの JavaScript 生成元」に無いとエラーになる。
#   対処: Google Cloud Console → APIとサービス → 認証情報 → 該当の OAuth 2.0 クライアント ID を編集
#         「承認済みの JavaScript 生成元」に http://localhost:3000 を追加して保存。
#         （8081 経由の場合は http://localhost:8081 も追加推奨。反映に 5〜10 分かかることがある。）

# 0) いま動いてるものを一応見る（任意）

docker compose --profile dev ps

# 1) 最新コード取得

git pull origin main

# 2) web-dev-server/backend-dev をビルド（初回のみ、通常はホットリロードで自動反映）

#    （事前に DEV_ENV_FILE を設定してから実行）

docker compose --profile dev build web-dev-server backend-dev

# 3) コンテナを更新起動（DEV_ENV_FILE を設定してから）

docker compose --profile dev up -d --force-recreate

# 4) 反映確認

docker image inspect $(docker inspect law-review-web-dev-server --format '{{.Image}}') --format 'WEB-DEV Created={{.Created}}'
docker image inspect $(docker inspect law-review-backend-dev --format '{{.Image}}') --format 'BE-DEV Created={{.Created}}'

# 5) 直近ログ確認（任意）

docker compose --profile dev logs --tail=80 web-dev-server backend-dev

# 6) DBファイルの存在確認（管理者ページのセレクトにβ/本番が出ないとき）

# ホスト: ls -la data/\*.db

# コンテナ内: docker exec law-review-backend-dev ls -la /data/\*.db

# コンテナ内の /data が空の場合 → 使用中の env（.env.dev1 または .env.dev2）に LAW_REVIEW_DATA_DIR=/opt/law-review/data を追加し、

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

# ssh -i $HOME\.ssh\id_ed25519_sakura ubuntu@160.16.50.238

# cd /opt/law-review

# git pull origin main

# 2) 対象環境のコンテナでインポートスクリプトを実行

# scripts/, data/, config/ をマウントする（H21/H22の公法系・刑事系・民事系対応に config が必要）

# 本番（prod.db に追加）:

# docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py

# β（beta.db に追加）:

# docker compose --profile beta run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-beta python /app/scripts/import_all_json_to_db.py

# 開発（dev.db に追加）:

# docker compose --profile dev run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-dev python /app/scripts/import_all_json_to_db.py

# 特定年度のみインポートする場合は --years を付ける（例: --years R4 R6）

# docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py --years R4 R6

# 既存データを上書きしたい場合は --update を付ける

# docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py --update

# --- 司法試験データを dev/beta/本番 すべてに反映する場合 ---

# 上記1)の後に、各環境で順に実行:

# docker compose --profile production run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend python /app/scripts/import_all_json_to_db.py

# docker compose --profile beta run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-beta python /app/scripts/import_all_json_to_db.py

# docker compose --profile dev run --rm -v /opt/law-review/scripts:/app/scripts:ro -v /opt/law-review/data:/app/data -v /opt/law-review/config:/app/config:ro backend-dev python /app/scripts/import_all_json_to_db.py

# ============================================

# DBにデータが入っているか確認するコマンド

# ============================================

# 環境変数 DATABASE_URL で指定したDBを使う。例: sqlite:///./data/dev.db → data/dev.db

# 本番/β/開発ではコンテナ内の /data/dev.db や /data/beta.db など。

# 方法1) コンテナ内で sqlite3 で確認（サーバー上でDBファイルに直接アクセスする場合）

# 本番: docker exec -it law-review-backend sqlite3 /data/prod.db "SELECT id, shiken_type, nendo, subject_id, status, substr(text,1,40) FROM official_questions WHERE shiken_type='shihou' ORDER BY nendo DESC, subject_id LIMIT 20;"

# β: docker exec -it law-review-backend-beta sqlite3 /data/beta.db "SELECT id, shiken_type, nendo, subject_id, status FROM official_questions WHERE shiken_type='yobi' AND nendo=2022 ORDER BY subject_id;"

# 開発: docker exec -it law-review-backend-dev sqlite3 /data/dev.db "SELECT id, shiken_type, nendo, subject_id, status FROM official_questions WHERE shiken_type='yobi' AND nendo=2022 ORDER BY subject_id;"

# 方法2) プロジェクトルートで Python から確認（アプリと同じ DATABASE_URL を使用）

# cd /opt/law-review のうえで:

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
