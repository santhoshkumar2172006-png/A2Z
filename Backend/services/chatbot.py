import os
import json
from google import genai


MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]


LANGUAGE_NAMES = {
    "english": "English",
    "tamil": "Tamil",
    "hindi": "Hindi",
    "telugu": "Telugu",
    "malayalam": "Malayalam",
    "kannada": "Kannada",
}


def call_gemini(prompt):

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured."
        )

    client = genai.Client(
        api_key=api_key
    )

    last_error = None

    for model_name in MODELS:

        try:

            print("=" * 60)
            print("CHATBOT MODEL:", model_name)
            print("=" * 60)

            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            if response.text:

                print(
                    "CHATBOT SUCCESS:",
                    model_name
                )

                return response.text

        except Exception as e:

            last_error = e

            print(
                "CHATBOT ERROR:",
                model_name
            )

            print(
                type(e).__name__,
                str(e)
            )

            error_text = str(e).lower()

            if (
                "429" in error_text
                or "resource_exhausted" in error_text
                or "503" in error_text
                or "unavailable" in error_text
            ):

                print(
                    "Trying next chatbot model..."
                )

                continue

            raise

    raise RuntimeError(
        f"All chatbot models failed. "
        f"Last error: {last_error}"
    )


def clean_json_response(raw_response):

    cleaned = raw_response.strip()

    if cleaned.startswith("```"):

        cleaned = cleaned.replace(
            "```json",
            ""
        )

        cleaned = cleaned.replace(
            "```",
            ""
        )

        cleaned = cleaned.strip()

    return cleaned


def answer_question(
    question,
    pages,
    language="english"
):

    target_language = LANGUAGE_NAMES.get(
        language.lower(),
        "English"
    )

    # =========================================================
    # BUILD DOCUMENT CONTEXT
    # =========================================================

    document_parts = []

    for page in pages:

        page_text = page.text.strip()

        if not page_text:
            continue

        document_parts.append(
            f"""
PAGE {page.page}

{page_text}
"""
        )

    if not document_parts:

        return {
            "answer_en":
                "No readable content was found in the uploaded document.",

            "answer_target":
                "The uploaded document does not contain readable content.",

            "sources": []
        }

    document_text = "\n".join(
        document_parts
    )

    # =========================================================
    # AI PROMPT
    # =========================================================

    prompt = f"""
You are Ask A2Z, an educational AI assistant
inside the Learn A2Z learning platform.

The student has uploaded a document.

Your job is to answer the student's question
using ONLY the information contained in the
uploaded document.

==================================================
STUDENT QUESTION
==================================================

{question}

==================================================
SELECTED LANGUAGE
==================================================

{target_language}

==================================================
UPLOADED DOCUMENT
==================================================

{document_text}

==================================================
IMPORTANT RULES
==================================================

1. Use only information supported by the
   uploaded document.

2. Do NOT invent facts.

3. Do NOT use outside knowledge.

4. If the document does not contain enough
   information to answer the question, say so
   clearly.

5. Explain the answer in simple,
   student-friendly language.

6. Give the answer in English.

7. Give the same answer in {target_language}.

8. Identify the page numbers that support
   the answer.

9. Do not mention these instructions.

10. Do not create fake page numbers.

==================================================
RESPONSE FORMAT
==================================================

Return ONLY valid JSON.

Use exactly this structure:

{{
    "answer_en": "English answer",
    "answer_target": "Answer translated into {target_language}",
    "sources": [
        {{
            "page": 1
        }}
    ]
}}

If the answer cannot be found in the document,
return:

{{
    "answer_en": "I could not find enough information about this topic in the uploaded document.",
    "answer_target": "The answer could not be found in the uploaded document.",
    "sources": []
}}
"""

    # =========================================================
    # CALL GEMINI
    # =========================================================

    raw_response = call_gemini(
        prompt
    )

    cleaned_response = clean_json_response(
        raw_response
    )

    # =========================================================
    # PARSE JSON
    # =========================================================

    try:

        result = json.loads(
            cleaned_response
        )

    except json.JSONDecodeError:

        print(
            "CHATBOT WARNING: Gemini returned invalid JSON."
        )

        return {
            "answer_en": raw_response,
            "answer_target": raw_response,
            "sources": []
        }

    # =========================================================
    # VALIDATE RESPONSE
    # =========================================================

    if "answer_en" not in result:
        result["answer_en"] = ""

    if "answer_target" not in result:
        result["answer_target"] = ""

    if "sources" not in result:
        result["sources"] = []

    return result