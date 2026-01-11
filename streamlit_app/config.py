"""設定ファイル（後方互換性のため残す）"""
# 新しい設定は config/settings.py を使用してください
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config.settings import API_BASE_URL
