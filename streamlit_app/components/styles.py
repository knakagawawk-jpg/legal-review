"""共通スタイルコンポーネント"""
import streamlit as st


def apply_custom_css():
    """カスタムCSSを適用"""
    st.markdown("""
    <style>
    /* 全体のスタイル */
    .main {
        padding-top: 2rem;
    }
    
    /* タイトルのスタイル */
    h1 {
        color: #1f77b4;
        font-weight: 700;
        border-bottom: 3px solid #1f77b4;
        padding-bottom: 0.5rem;
        margin-bottom: 1.5rem;
    }
    
    h2 {
        color: #2c3e50;
        font-weight: 600;
        margin-top: 2rem;
        margin-bottom: 1rem;
    }
    
    h3 {
        color: #34495e;
        font-weight: 600;
        margin-top: 1.5rem;
    }
    
    /* カードスタイル */
    .card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin-bottom: 1rem;
        color: white;
    }
    
    .card-info {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin-bottom: 1rem;
        color: white;
    }
    
    .card-success {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin-bottom: 1rem;
        color: white;
    }
    
    /* ボタンのスタイル改善 */
    .stButton > button {
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    /* サイドバーのスタイル */
    .css-1d391kg {
        background-color: #f8f9fa;
    }
    
    /* テキストエリアのスタイル */
    .stTextArea > div > div > textarea {
        border-radius: 8px;
        border: 2px solid #e0e0e0;
        transition: border-color 0.3s ease;
    }
    
    .stTextArea > div > div > textarea:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    /* セレクトボックスのスタイル */
    .stSelectbox > div > div > select {
        border-radius: 8px;
        border: 2px solid #e0e0e0;
    }
    
    /* メトリックのスタイル */
    [data-testid="stMetricValue"] {
        font-size: 2rem;
        font-weight: 700;
        color: #1f77b4;
    }
    
    /* タブのスタイル */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px 8px 0 0;
        padding: 10px 20px;
        font-weight: 600;
    }
    
    /* エクスパンダーのスタイル */
    .streamlit-expanderHeader {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 1rem;
        font-weight: 600;
    }
    
    /* 情報ボックスのスタイル */
    .stAlert {
        border-radius: 8px;
        border-left: 4px solid;
    }
    
    /* カスタムカードコンポーネント */
    .metric-card {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #667eea;
        margin-bottom: 1rem;
    }
    
    /* グラデーションテキスト */
    .gradient-text {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        font-weight: 700;
    }
    
    /* ノートブックカード */
    .notebook-card {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 1rem;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        cursor: pointer;
    }
    
    .notebook-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    /* セクションカード */
    .section-card {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #667eea;
        margin-bottom: 1rem;
    }
    
    /* ページカード */
    .page-card {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        margin-bottom: 0.5rem;
    }
    
    /* 履歴カード */
    .history-card {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 1rem;
        border-top: 3px solid #667eea;
    }
    
    /* サイドバーボタンのスタイル */
    .sidebar-button {
        width: 100%;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    /* スクロールバーのスタイル */
    ::-webkit-scrollbar {
        width: 8px;
    }
    
    ::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    </style>
    """, unsafe_allow_html=True)


def render_card(title: str, content: str, card_type: str = "default"):
    """カードコンポーネントを表示"""
    card_class = {
        "default": "card",
        "info": "card-info",
        "success": "card-success"
    }.get(card_type, "card")
    
    st.markdown(f"""
    <div class="{card_class}">
        <h3 style="color: white; margin-top: 0;">{title}</h3>
        <p style="color: white; margin-bottom: 0;">{content}</p>
    </div>
    """, unsafe_allow_html=True)


def render_metric_card(label: str, value: str, delta: str = None):
    """メトリックカードを表示"""
    delta_html = f'<div style="color: #28a745; font-size: 0.9rem;">{delta}</div>' if delta else ""
    st.markdown(f"""
    <div class="metric-card">
        <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 0.5rem;">{label}</div>
        <div style="font-size: 2rem; font-weight: 700; color: #1f77b4;">{value}</div>
        {delta_html}
    </div>
    """, unsafe_allow_html=True)


def render_gradient_title(text: str, level: int = 1):
    """グラデーションタイトルを表示"""
    tag = f"h{level}"
    st.markdown(f'<{tag} class="gradient-text">{text}</{tag}>', unsafe_allow_html=True)
