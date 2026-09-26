import os
import json
import time
import re

from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing from .env")

client = genai.Client(api_key=API_KEY)


# ============================================================
# GEMINI MODELS
# ============================================================

MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]


# ============================================================
# LANGUAGE NAMES
# ============================================================

LANGUAGE_NAMES = {
    "english": "English",
    "tamil": "Tamil",
    "hindi": "Hindi",
    "telugu": "Telugu",
    "malayalam": "Malayalam",
    "kannada": "Kannada",
}


# ============================================================
# CHUNK SETTINGS
# ============================================================

# Roughly 5k–7k tokens depending on the document.
# This is intentionally much smaller than the previous
# full-document request.
MAX_CHUNK_CHARACTERS = 24000


# ============================================================
# PAGE NORMALIZATION
# ============================================================

def normalize_page(page):

    if isinstance(page, dict):
        return {
            "page": page["page"],
            "text": page["text"]
        }

    if hasattr(page, "model_dump"):
        data = page.model_dump()

        return {
            "page": data["page"],
            "text": data["text"]
        }

    if hasattr(page, "dict"):
        data = page.dict()

        return {
            "page": data["page"],
            "text": data["text"]
        }

    if hasattr(page, "page") and hasattr(page, "text"):
        return {
            "page": page.page,
            "text": page.text
        }

    raise TypeError(
        f"Unsupported page object type: {type(page)}"
    )


# ============================================================
# CREATE DOCUMENT CHUNKS
# ============================================================

def create_chunks(pages):

    normalized_pages = [
        normalize_page(page)
        for page in pages
    ]

    chunks = []

    current_pages = []
    current_text = ""
    current_length = 0

    for page in normalized_pages:

        page_number = page["page"]
        page_text = page["text"].strip()

        if not page_text:
            continue

        page_block = (
            f"\n\n===== PAGE {page_number} =====\n"
            f"{page_text}"
        )

        page_length = len(page_block)

        # ----------------------------------------------------
        # If adding this page exceeds the chunk size,
        # save the current chunk first.
        # ----------------------------------------------------

        if (
            current_pages
            and
            current_length + page_length
            > MAX_CHUNK_CHARACTERS
        ):

            chunks.append({
                "chunk_number": len(chunks) + 1,
                "pages": current_pages,
                "text": current_text
            })

            current_pages = []
            current_text = ""
            current_length = 0

        # ----------------------------------------------------
        # If ONE page itself is larger than the limit,
        # split that page by paragraphs.
        # ----------------------------------------------------

        if page_length > MAX_CHUNK_CHARACTERS:

            paragraphs = page_text.split("\n")

            paragraph_buffer = ""
            paragraph_length = 0

            for paragraph in paragraphs:

                paragraph = paragraph.strip()

                if not paragraph:
                    continue

                paragraph_block = (
                    paragraph + "\n"
                )

                if (
                    paragraph_buffer
                    and
                    paragraph_length
                    + len(paragraph_block)
                    > MAX_CHUNK_CHARACTERS
                ):

                    chunks.append({
                        "chunk_number": len(chunks) + 1,
                        "pages": [page_number],
                        "text": (
                            f"===== PAGE {page_number} =====\n"
                            f"{paragraph_buffer}"
                        )
                    })

                    paragraph_buffer = ""
                    paragraph_length = 0

                paragraph_buffer += paragraph_block
                paragraph_length += len(
                    paragraph_block
                )

            if paragraph_buffer:

                chunks.append({
                    "chunk_number": len(chunks) + 1,
                    "pages": [page_number],
                    "text": (
                        f"===== PAGE {page_number} =====\n"
                        f"{paragraph_buffer}"
                    )
                })

            continue

        # ----------------------------------------------------
        # Normal page
        # ----------------------------------------------------

        current_pages.append(page_number)
        current_text += page_block
        current_length += page_length

    # --------------------------------------------------------
    # Save final chunk
    # --------------------------------------------------------

    if current_pages:

        chunks.append({
            "chunk_number": len(chunks) + 1,
            "pages": current_pages,
            "text": current_text
        })

    return chunks


# ============================================================
# GEMINI CALL
# ============================================================

def call_gemini(prompt):

    last_error = None

    for model_name in MODELS:

        print("=" * 60)
        print(f"AI MODEL: {model_name}")
        print("=" * 60)

        try:

            print("Sending request...")

            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            if not response.text:
                raise ValueError(
                    "Gemini returned an empty response."
                )

            print(
                f"SUCCESS: {model_name}"
            )

            return response.text

        except Exception as e:

            last_error = e

            error_text = str(e)

            print(
                f"{model_name} ERROR:"
            )
            print(error_text)

            # -----------------------------------------------
            # QUOTA / RATE LIMIT
            # -----------------------------------------------

            if (
                "429" in error_text
                or
                "RESOURCE_EXHAUSTED"
                in error_text
            ):

                print(
                    f"{model_name} quota unavailable."
                )

                print(
                    "Trying next available model..."
                )

                continue

            # -----------------------------------------------
            # TEMPORARY SERVER ERROR
            # -----------------------------------------------

            if (
                "503" in error_text
                or
                "UNAVAILABLE" in error_text
            ):

                print(
                    f"{model_name} temporarily unavailable."
                )

                continue

            # -----------------------------------------------
            # OTHER ERROR
            # -----------------------------------------------

            raise

    raise Exception(
        "All configured Gemini models are currently "
        "unavailable. Last error: "
        + str(last_error)
    )

# ============================================================
# PARSE JSON
# ============================================================

def parse_json_response(text):

    text = text.strip()

    if text.startswith("```json"):

        text = text[7:]

    elif text.startswith("```"):

        text = text[3:]

    if text.endswith("```"):

        text = text[:-3]

    text = text.strip()

    return json.loads(text)


# ============================================================
# ANALYZE ONE CHUNK
# ============================================================

def analyze_chunk(
    chunk,
    target_language
):

    language_name = LANGUAGE_NAMES.get(
        target_language.lower(),
        "English"
    )

    prompt = f"""
You are the AI learning engine of Learn A2Z.

Analyze ONLY the following section of an educational
document.

The original document is in English.

The student's selected language is:

{language_name}

IMPORTANT:

- Use ONLY information contained in this section.
- Do not invent facts.
- Preserve the meaning.
- Preserve important technical terminology.
- Do not add unrelated information.
- Keep the page numbers provided.
- This is one chunk of a larger document.

==================================================
SUMMARY
==================================================

Create:

- English title
- {language_name} title
- English overview
- {language_name} overview
- Important key points

==================================================
CONCEPTS
==================================================

Identify important concepts a student needs to understand.

Do NOT treat every sentence or ordinary noun as a concept.

For each concept provide:

- English concept name
- {language_name} concept name
- English explanation
- {language_name} explanation
- English importance
- {language_name} importance
- page number

==================================================
DIFFICULT VOCABULARY
==================================================

Identify useful words or phrases that may be difficult
for a beginner to read, understand, or remember.

Prefer:

- technical terms
- domain-specific terms
- uncommon terms
- abstract terms
- complex phrases
- technical usage

Do NOT include ordinary words such as:

- the
- user
- system
- computer
- good
- use

For each vocabulary item provide:

- Original English term
- Simple English meaning
- Meaning in {language_name}
- English context
- {language_name} context
- Simple English example
- {language_name} example
- page number

==================================================
QUESTIONS
==================================================

Extract ONLY questions that already exist in this
document section.

Do NOT create new questions.

If there are no explicit questions,
return an empty array.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

Use EXACTLY:

{{
    "summary": {{
        "title_en": "",
        "title_target": "",
        "overview_en": "",
        "overview_target": "",
        "key_points": [
            {{
                "en": "",
                "target": ""
            }}
        ]
    }},

    "concepts": [
        {{
            "name_en": "",
            "name_target": "",
            "explanation_en": "",
            "explanation_target": "",
            "importance_en": "",
            "importance_target": "",
            "page": 1
        }}
    ],

    "vocabulary": [
        {{
            "term_en": "",
            "meaning_en": "",
            "meaning_target": "",
            "context_en": "",
            "context_target": "",
            "example_en": "",
            "example_target": "",
            "page": 1
        }}
    ],

    "questions": [
        {{
            "question_en": "",
            "question_target": "",
            "page": 1
        }}
    ]
}}

DOCUMENT SECTION:

{chunk["text"]}
"""

    print(
        f"Analyzing chunk {chunk['chunk_number']}"
    )

    result = call_gemini(prompt)

    return parse_json_response(result)


# ============================================================
# NORMALIZE TEXT FOR DUPLICATE DETECTION
# ============================================================

def normalize_text(value):

    if not value:
        return ""

    value = value.lower().strip()

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value


# ============================================================
# REMOVE DUPLICATE CONCEPTS
# ============================================================

def merge_concepts(all_concepts):

    unique = {}

    for concept in all_concepts:

        key = normalize_text(
            concept.get("name_en")
        )

        if not key:
            continue

        if key not in unique:

            unique[key] = concept

    return list(unique.values())


# ============================================================
# REMOVE DUPLICATE VOCABULARY
# ============================================================

def merge_vocabulary(all_vocabulary):

    unique = {}

    for item in all_vocabulary:

        key = normalize_text(
            item.get("term_en")
        )

        if not key:
            continue

        if key not in unique:

            unique[key] = item

    return list(unique.values())


# ============================================================
# REMOVE DUPLICATE QUESTIONS
# ============================================================

def merge_questions(all_questions):

    unique = {}

    for question in all_questions:

        key = normalize_text(
            question.get("question_en")
        )

        if not key:
            continue

        if key not in unique:

            unique[key] = question

    return list(unique.values())


# ============================================================
# FINAL SUMMARY
# ============================================================

def create_final_summary(
    chunk_summaries,
    target_language
):

    language_name = LANGUAGE_NAMES.get(
        target_language.lower(),
        "English"
    )

    summary_text = ""

    for index, summary in enumerate(
        chunk_summaries,
        start=1
    ):

        summary_text += f"""

===== CHUNK {index} =====

English Title:
{summary.get("title_en", "")}

Target Title:
{summary.get("title_target", "")}

English Overview:
{summary.get("overview_en", "")}

Target Overview:
{summary.get("overview_target", "")}

Key Points:
"""

        for point in summary.get(
            "key_points",
            []
        ):

            summary_text += (
                f"- EN: {point.get('en', '')}\n"
                f"- TARGET: {point.get('target', '')}\n"
            )

    prompt = f"""
You are the final summarization engine of Learn A2Z.

The following are summaries produced from different
sections of ONE educational document.

Create ONE unified summary.

Selected language:

{language_name}

Rules:

- Do not invent information.
- Use only the provided chunk summaries.
- Remove repeated points.
- Keep the most important information.
- Make the final overview coherent.
- Preserve technical terminology.
- English and {language_name} must communicate
  the same meaning.

Return ONLY valid JSON.

Use:

{{
    "title_en": "",
    "title_target": "",
    "overview_en": "",
    "overview_target": "",
    "key_points": [
        {{
            "en": "",
            "target": ""
        }}
    ]
}}

CHUNK SUMMARIES:

{summary_text}
"""

    print(
        "Creating final document summary..."
    )

    result = call_gemini(prompt)

    return parse_json_response(result)


# ============================================================
# MAIN ANALYSIS FUNCTION
# ============================================================

def analyze_document(
    pages,
    target_language="english"
):

    print("=" * 60)
    print("STARTING LARGE-DOCUMENT ANALYSIS")
    print("=" * 60)

    print(
        "NUMBER OF PAGES:",
        len(pages)
    )

    print(
        "TARGET LANGUAGE:",
        target_language
    )

    # --------------------------------------------------------
    # Create chunks
    # --------------------------------------------------------

    chunks = create_chunks(pages)

    print(
        "TOTAL CHUNKS:",
        len(chunks)
    )

    for chunk in chunks:

        print(
            f"Chunk {chunk['chunk_number']}: "
            f"Pages {chunk['pages'][0]}"
            f"-{chunk['pages'][-1]} | "
            f"{len(chunk['text'])} characters"
        )

    # --------------------------------------------------------
    # Analyze each chunk
    # --------------------------------------------------------

    chunk_results = []

    for chunk in chunks:

        result = analyze_chunk(
            chunk,
            target_language
        )

        chunk_results.append(result)

        # Small pause between requests.
        # Helps avoid aggressively hitting the API.
        time.sleep(1)

    # --------------------------------------------------------
    # Collect results
    # --------------------------------------------------------

    all_concepts = []
    all_vocabulary = []
    all_questions = []
    chunk_summaries = []

    for result in chunk_results:

        if result.get("summary"):

            chunk_summaries.append(
                result["summary"]
            )

        all_concepts.extend(
            result.get(
                "concepts",
                []
            )
        )

        all_vocabulary.extend(
            result.get(
                "vocabulary",
                []
            )
        )

        all_questions.extend(
            result.get(
                "questions",
                []
            )
        )

    # --------------------------------------------------------
    # Remove duplicates
    # --------------------------------------------------------

    concepts = merge_concepts(
        all_concepts
    )

    vocabulary = merge_vocabulary(
        all_vocabulary
    )

    questions = merge_questions(
        all_questions
    )

    print(
        "CONCEPTS:",
        len(concepts)
    )

    print(
        "VOCABULARY:",
        len(vocabulary)
    )

    print(
        "QUESTIONS:",
        len(questions)
    )

    # --------------------------------------------------------
    # Final summary
    # --------------------------------------------------------

    if len(chunk_summaries) == 1:

        summary = chunk_summaries[0]

    else:

        summary = create_final_summary(
            chunk_summaries,
            target_language
        )

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    final_result = {

        "summary": summary,

        "concepts": concepts,

        "vocabulary": vocabulary,

        "questions": questions
    }

    print("=" * 60)
    print("LARGE-DOCUMENT ANALYSIS COMPLETE")
    print("=" * 60)

    return final_result