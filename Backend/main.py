from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.quiz_generator import generate_quiz
from services.chatbot import answer_question

from pathlib import Path
import shutil

from services.parser import (
    extract_pdf_text,
    extract_docx_text
)

from services.translator import translate_text
from services.analyzer import analyze_document
from fastapi.responses import StreamingResponse

from services.download_generator import (
    create_docx,
    create_pdf
)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Learn A2Z API"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

UPLOAD_DIR = Path("uploads")

UPLOAD_DIR.mkdir(
    exist_ok=True
)


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Learn A2Z Backend is running"
    }


# =========================================================
# UPLOAD DOCUMENT
# =========================================================

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...)
):
    try:
        print("=" * 60)
        print("UPLOAD ENDPOINT CALLED")
        print("FILENAME:", file.filename)
        print("CONTENT TYPE:", file.content_type)
        print("=" * 60)

        # -----------------------------------------------------
        # Validate filename
        # -----------------------------------------------------

        if not file.filename:
            return {
                "success": False,
                "error": "No filename was provided."
            }

        extension = Path(file.filename).suffix.lower()

        # -----------------------------------------------------
        # Check file type
        # -----------------------------------------------------

        if extension not in [".pdf", ".docx"]:
            return {
                "success": False,
                "error": "Only PDF and DOCX files are supported."
            }

        # -----------------------------------------------------
        # Read uploaded file completely
        # -----------------------------------------------------

        file_bytes = await file.read()

        print("UPLOADED BYTES:", len(file_bytes))

        # -----------------------------------------------------
        # Check empty file
        # -----------------------------------------------------

        if not file_bytes:
            return {
                "success": False,
                "error": "The uploaded file is empty. Please choose the PDF/DOCX again."
            }

        # -----------------------------------------------------
        # Create safe filename
        # -----------------------------------------------------

        safe_name = Path(file.filename).name

        file_path = UPLOAD_DIR / safe_name

        # -----------------------------------------------------
        # Save file
        # -----------------------------------------------------

        with open(file_path, "wb") as buffer:
            buffer.write(file_bytes)

        # -----------------------------------------------------
        # Verify saved file
        # -----------------------------------------------------

        saved_size = file_path.stat().st_size

        print("SAVED FILE:", file_path)
        print("SAVED SIZE:", saved_size, "bytes")

        if saved_size == 0:
            return {
                "success": False,
                "error": "The server saved an empty file. Please try uploading again."
            }

        # -----------------------------------------------------
        # Extract text
        # -----------------------------------------------------

        print("EXTRACTING TEXT...")

        if extension == ".pdf":
            pages = extract_pdf_text(str(file_path))
        else:
            pages = extract_docx_text(str(file_path))

        print("EXTRACTION COMPLETE")
        print("PAGES:", len(pages))

        # -----------------------------------------------------
        # Calculate characters
        # -----------------------------------------------------

        total_characters = sum(
            len(page.get("text", ""))
            for page in pages
        )

        print("TOTAL CHARACTERS:", total_characters)

        # -----------------------------------------------------
        # Return response
        # -----------------------------------------------------

        return {
            "success": True,
            "filename": file.filename,
            "file_type": extension,
            "page_count": len(pages),
            "character_count": total_characters,
            "pages": pages
        }

    except Exception as e:
        print("=" * 60)
        print("UPLOAD ERROR")
        print(type(e).__name__)
        print(str(e))
        print("=" * 60)

        return {
            "success": False,
            "error": str(e)
        }
    # -----------------------------------------------------
    # Check file type
    # -----------------------------------------------------

    if extension not in [
        ".pdf",
        ".docx"
    ]:

        return {
            "success": False,
            "error":
                "Only PDF and DOCX files are supported."
        }

    # -----------------------------------------------------
    # Save uploaded file
    # -----------------------------------------------------

    file_path = (
        UPLOAD_DIR /
        file.filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # -----------------------------------------------------
    # Extract text
    # -----------------------------------------------------

    if extension == ".pdf":

        pages = extract_pdf_text(
            str(file_path)
        )

    else:

        pages = extract_docx_text(
            str(file_path)
        )

    # -----------------------------------------------------
    # Calculate characters
    # -----------------------------------------------------

    total_characters = sum(
        len(page["text"])
        for page in pages
    )

    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return {

        "success": True,

        "filename":
            file.filename,

        "file_type":
            extension,

        "page_count":
            len(pages),

        "character_count":
            total_characters,

        "pages":
            pages
    }


# =========================================================
# TRANSLATION REQUEST MODEL
# =========================================================

class TranslationRequest(BaseModel):

    text: str

    language: str


# =========================================================
# TRANSLATE DOCUMENT
# =========================================================

@app.post("/api/documents/translate")
async def translate_document(
    request: TranslationRequest
):

    try:

        print("=" * 60)

        print(
            "TRANSLATION ENDPOINT CALLED"
        )

        print(
            "LANGUAGE:",
            request.language
        )

        print("=" * 60)

        translated_text = translate_text(

            request.text,

            request.language
        )

        return {

            "success": True,

            "language":
                request.language,

            "translated_text":
                translated_text
        }

    except Exception as e:

        print("=" * 60)

        print(
            "TRANSLATION ERROR:"
        )

        print(
            type(e).__name__
        )

        print(
            str(e)
        )

        print("=" * 60)

        return {

            "success": False,

            "error":
                str(e)
        }


# =========================================================
# DOCUMENT PAGE MODEL
# =========================================================

class DocumentPage(BaseModel):

    page: int

    text: str


# =========================================================
# ANALYZE REQUEST MODEL
# =========================================================

class AnalyzeRequest(BaseModel):

    pages: list[DocumentPage]

    language: str = "english"


# =========================================================
# ANALYZE DOCUMENT
# =========================================================

@app.post("/api/documents/analyze")
async def analyze_uploaded_document(
    request: AnalyzeRequest
):

    try:

        print("=" * 60)

        print(
            "ANALYZE ENDPOINT CALLED"
        )

        print(
            "NUMBER OF PAGES:",
            len(request.pages)
        )

        print(
            "SELECTED LANGUAGE:",
            request.language
        )

        print("=" * 60)

        # -------------------------------------------------
        # Send pages + selected language to analyzer
        # -------------------------------------------------

        analysis = analyze_document(

            request.pages,

            request.language

        )

        # -------------------------------------------------
        # Return AI analysis
        # -------------------------------------------------

        return {

            "success": True,

            "language":
                request.language,

            "analysis":
                analysis
        }

    except Exception as e:

        print("=" * 60)

        print(
            "ANALYSIS ERROR:"
        )

        print(
            type(e).__name__
        )

        print(
            str(e)
        )

        print("=" * 60)

        return {

            "success": False,

            "error":
                str(e)
        }

# =========================================================
# QUIZ REQUEST MODEL
# =========================================================

class QuizRequest(BaseModel):

    concepts: list

    questions: list

    language: str = "english"

    difficulty: str = "medium"

    question_count: int = 10


# =========================================================
# GENERATE QUIZ
# =========================================================

@app.post("/api/documents/quiz")
async def generate_document_quiz(
    request: QuizRequest
):

    try:

        print("=" * 60)

        print(
            "QUIZ GENERATION STARTED"
        )

        print(
            "LANGUAGE:",
            request.language
        )

        print(
            "DIFFICULTY:",
            request.difficulty
        )

        print(
            "QUESTION COUNT:",
            request.question_count
        )

        print(
            "CONCEPT COUNT:",
            len(request.concepts)
        )

        print(
            "DOCUMENT QUESTION COUNT:",
            len(request.questions)
        )

        print("=" * 60)


        # -----------------------------------------------------
        # Validate question count
        # -----------------------------------------------------

        if request.question_count < 1:

            return {
                "success": False,
                "error":
                    "Question count must be at least 1."
            }


        if request.question_count > 20:

            return {
                "success": False,
                "error":
                    "Maximum 20 questions are allowed."
            }


        # -----------------------------------------------------
        # Validate difficulty
        # -----------------------------------------------------

        if request.difficulty not in [
            "easy",
            "medium",
            "hard"
        ]:

            return {
                "success": False,
                "error":
                    "Invalid difficulty. "
                    "Use easy, medium or hard."
            }


        # -----------------------------------------------------
        # Generate quiz
        # -----------------------------------------------------

        quiz = generate_quiz(

            concepts=request.concepts,

            document_questions=request.questions,

            language=request.language,

            difficulty=request.difficulty,

            question_count=request.question_count

        )


        # -----------------------------------------------------
        # Success
        # -----------------------------------------------------

        print("=" * 60)

        print(
            "QUIZ GENERATION COMPLETE"
        )

        print("=" * 60)


        return {

            "success": True,

            "language":
                request.language,

            "difficulty":
                request.difficulty,

            "quiz":
                quiz

        }


    except Exception as e:

        print("=" * 60)

        print(
            "QUIZ ERROR:"
        )

        print(
            type(e).__name__
        )

        print(
            str(e)
        )

        print("=" * 60)


        return {

            "success": False,

            "error":
                str(e)

        }
# ============================================================
# ASK A2Z CHATBOT
# ============================================================

class ChatRequest(BaseModel):

    question: str

    pages: list[DocumentPage]

    language: str = "english"


@app.post("/api/chat")
async def ask_a2z(
    request: ChatRequest
):

    try:

        print("=" * 60)
        print("ASK A2Z CHATBOT")
        print("=" * 60)

        print(
            "QUESTION:",
            request.question
        )

        print(
            "LANGUAGE:",
            request.language
        )

        print(
            "PAGES:",
            len(request.pages)
        )

        print("=" * 60)

        # ----------------------------------------------------
        # VALIDATE QUESTION
        # ----------------------------------------------------

        if not request.question.strip():

            return {
                "success": False,
                "error":
                    "Question cannot be empty."
            }

        # ----------------------------------------------------
        # VALIDATE DOCUMENT
        # ----------------------------------------------------

        if not request.pages:

            return {
                "success": False,
                "error":
                    "No document content was provided."
            }

        # ----------------------------------------------------
        # ASK AI
        # ----------------------------------------------------

        answer = answer_question(
            question=request.question,
            pages=request.pages,
            language=request.language
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {

            "success": True,

            "language":
                request.language,

            "answer":
                answer
        }

    except Exception as e:

        print("=" * 60)
        print("ASK A2Z ERROR")
        print("=" * 60)

        print(
            type(e).__name__
        )

        print(
            str(e)
        )

        print("=" * 60)

        return {

            "success": False,

            "error":
                str(e)
        }
# =========================================================
# DOWNLOAD TRANSLATED DOCUMENT
# =========================================================

class DownloadRequest(BaseModel):
    text: str
    language: str = "english"
    filename: str = "LearnA2Z_Document"


@app.post("/api/documents/download/docx")
async def download_docx(request: DownloadRequest):

    try:

        if not request.text.strip():
            return {
                "success": False,
                "error": "No document content available."
            }

        output = create_docx(
            text=request.text,
            filename=request.filename,
            language=request.language
        )

        safe_filename = (
            request.filename
            .replace(".pdf", "")
            .replace(".docx", "")
            .replace(" ", "_")
        )

        return StreamingResponse(
            output,
            media_type=(
                "application/"
                "vnd.openxmlformats-officedocument"
                ".wordprocessingml.document"
            ),
            headers={
                "Content-Disposition":
                    f'attachment; filename="{safe_filename}.docx"'
            }
        )

    except Exception as e:

        print("=" * 60)
        print("DOCX DOWNLOAD ERROR")
        print("=" * 60)
        print(type(e).__name__)
        print(str(e))
        print("=" * 60)

        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/documents/download/pdf")
async def download_pdf(request: DownloadRequest):

    try:

        if not request.text.strip():
            return {
                "success": False,
                "error": "No document content available."
            }

        output = create_pdf(
            text=request.text,
            filename=request.filename,
            language=request.language
        )

        safe_filename = (
            request.filename
            .replace(".pdf", "")
            .replace(".docx", "")
            .replace(" ", "_")
        )

        return StreamingResponse(
            output,
            media_type="application/pdf",
            headers={
                "Content-Disposition":
                    f'attachment; filename="{safe_filename}.pdf"'
            }
        )

    except Exception as e:

        print("=" * 60)
        print("PDF DOWNLOAD ERROR")
        print("=" * 60)
        print(type(e).__name__)
        print(str(e))
        print("=" * 60)

        return {
            "success": False,
            "error": str(e)
        }