import fitz
from docx import Document
import re


def clean_page_text(text):
    lines = text.splitlines()
    cleaned_lines = []

    for line in lines:
        line = line.strip()

        if not line:
            continue

        # Remove only explicit "Page 1", "Page 2", etc.
        if re.fullmatch(r"Page\s+\d+", line, re.IGNORECASE):
            continue

        # Keep everything else, including numbers
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def extract_pdf_text(file_path):
    document = fitz.open(file_path)

    pages = []

    for page_number, page in enumerate(document):
        text = page.get_text("text")

        cleaned_text = clean_page_text(text)

        pages.append({
            "page": page_number + 1,
            "text": cleaned_text
        })

    document.close()

    return pages


def extract_docx_text(file_path):
    document = Document(file_path)

    paragraphs = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()

        if text:
            paragraphs.append(text)

    return [{
        "page": 1,
        "text": "\n".join(paragraphs)
    }]