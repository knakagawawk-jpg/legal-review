"""データディレクトリ名を英語に変更するスクリプト"""
import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

def rename_directories():
    """ディレクトリ名を英語に変更"""
    
    # 1. 問題文元pdf -> data/pdfs
    old_pdf_dir = BASE_DIR / "問題文元pdf"
    new_pdf_dir = BASE_DIR / "data" / "pdfs"
    
    if old_pdf_dir.exists():
        new_pdf_dir.parent.mkdir(parents=True, exist_ok=True)
        if new_pdf_dir.exists():
            print(f"{new_pdf_dir} already exists, skipping...")
        else:
            shutil.move(str(old_pdf_dir), str(new_pdf_dir))
            print(f"Moved {old_pdf_dir} -> {new_pdf_dir}")
    
    # 2. json_data -> data/json
    old_json_dir = BASE_DIR / "json_data"
    new_json_dir = BASE_DIR / "data" / "json"
    
    if old_json_dir.exists():
        new_json_dir.parent.mkdir(parents=True, exist_ok=True)
        if new_json_dir.exists():
            print(f"{new_json_dir} already exists, skipping...")
        else:
            shutil.move(str(old_json_dir), str(new_json_dir))
            print(f"Moved {old_json_dir} -> {new_json_dir}")
    
    # 3. data/pdfs内のサブディレクトリ名を変更
    pdfs_dir = BASE_DIR / "data" / "pdfs"
    if pdfs_dir.exists():
        for item in pdfs_dir.iterdir():
            if item.is_dir():
                if item.name == "予備試験":
                    new_name = pdfs_dir / "preliminary_exam"
                    if not new_name.exists():
                        item.rename(new_name)
                        print(f"Renamed {item.name} -> preliminary_exam")
                elif item.name == "司法試験":
                    new_name = pdfs_dir / "judicial_exam"
                    if not new_name.exists():
                        item.rename(new_name)
                        print(f"Renamed {item.name} -> judicial_exam")
    
    # 4. data/json内のサブディレクトリ名を変更
    json_dir = BASE_DIR / "data" / "json"
    if json_dir.exists():
        for item in json_dir.iterdir():
            if item.is_dir():
                if item.name == "予備試験":
                    new_name = json_dir / "preliminary_exam"
                    if not new_name.exists():
                        item.rename(new_name)
                        print(f"Renamed {item.name} -> preliminary_exam")

if __name__ == "__main__":
    rename_directories()
    print("Done!")
