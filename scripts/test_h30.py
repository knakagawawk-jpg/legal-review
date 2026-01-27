import pdfplumber
import re
from pathlib import Path

pdf_path = Path('data/pdfs/preliminary_exam/H30/論述/出題趣旨.pdf')
pdf = pdfplumber.open(pdf_path)
text = ''
for p in pdf.pages[:5]:
    page_text = p.extract_text()
    if page_text:
        text += page_text + '\n'

print(f'PDFの最初の1000文字:')
print(text[:1000])
print('\n' + '='*50 + '\n')

matches = list(re.finditer(r'［([^］]+)］', text))
print(f'パターン［科目名］で見つかった数: {len(matches)}')
if matches:
    print('抽出された科目名（最初の5つ）:')
    for i, m in enumerate(matches[:5]):
        original = m.group(1).strip()
        normalized = "".join(original.split())
        print(f'  {i+1}. 元: "{original}" -> 正規化: "{normalized}"')

# JSONファイルのsubject_nameと比較
json_subjects = ["憲法", "行政法"]
print('\nJSONファイルのsubject_name:')
for subj in json_subjects:
    subj_clean = "".join(subj.split())
    print(f'  "{subj}" -> 正規化: "{subj_clean}"')
    # マッチするか確認
    for key in [m.group(1).strip() for m in matches[:5]]:
        key_clean = "".join(key.split())
        if subj_clean == key_clean:
            print(f'    マッチ: "{key}" (正規化: "{key_clean}")')

