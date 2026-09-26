import os
import re

from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is missing from .env"
    )

client = genai.Client(api_key=API_KEY)


# ============================================================
# MODELS
# ============================================================

MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
]


# ============================================================
# SUPPORTED LANGUAGES
# ============================================================

LANGUAGES = {
    "tamil": "Tamil",
    "hindi": "Hindi",
    "telugu": "Telugu",
    "malayalam": "Malayalam",
    "kannada": "Kannada",
}


# ============================================================
# CHUNK SIZE
# ============================================================

# Keep translation requests reasonably small.
MAX_TRANSLATION_CHARS = 18000


# ============================================================
# SPLIT TEXT INTO CHUNKS
# ============================================================

def split_text_into_chunks(
    text,
    max_chars=MAX_TRANSLATION_CHARS
):

    text = text.strip()

    if not text:
        return []

    paragraphs = re.split(
        r"\n\s*\n",
        text
    )

    chunks = []

    current_chunk = ""
    current_length = 0

    for paragraph in paragraphs:

        paragraph = paragraph.strip()

        if not paragraph:
            continue

        # ----------------------------------------------------
        # Normal paragraph
        # ----------------------------------------------------

        paragraph_with_spacing = (
            paragraph + "\n\n"
        )

        paragraph_length = len(
            paragraph_with_spacing
        )

        if (
            current_chunk
            and
            current_length + paragraph_length
            > max_chars
        ):

            chunks.append(
                current_chunk.strip()
            )

            current_chunk = ""
            current_length = 0

        # ----------------------------------------------------
        # Very large paragraph
        # ----------------------------------------------------

        if paragraph_length > max_chars:

            # Save current chunk first
            if current_chunk:

                chunks.append(
                    current_chunk.strip()
                )

                current_chunk = ""
                current_length = 0

            # Split large paragraph safely
            start = 0

            while start < len(paragraph):

                end = min(
                    start + max_chars,
                    len(paragraph)
                )

                piece = paragraph[
                    start:end
                ]

                chunks.append(
                    piece.strip()
                )

                start = end

            continue

        # ----------------------------------------------------
        # Add normal paragraph
        # ----------------------------------------------------

        current_chunk += (
            paragraph_with_spacing
        )

        current_length += (
            paragraph_length
        )

    # --------------------------------------------------------
    # Final chunk
    # --------------------------------------------------------

    if current_chunk.strip():

        chunks.append(
            current_chunk.strip()
        )

    return chunks


# ============================================================
# TRANSLATE ONE CHUNK
# ============================================================

def translate_chunk(
    text,
    target_language
):

    prompt = f"""
Translate the following educational document section
into {target_language}.

IMPORTANT RULES:

- Translate the complete content.
- Do NOT summarize.
- Do NOT remove information.
- Do NOT add new information.
- Preserve the original meaning.
- Preserve headings.
- Preserve paragraph order.
- Preserve lists when present.
- Keep important English technical terms in
  parentheses when useful.
- Do not explain your translation.
- Return ONLY the translated content.

CONTENT:

{text}
"""

    last_error = None

    for model_name in MODELS:

        print("=" * 60)
        print(
            f"TRANSLATION MODEL: {model_name}"
        )
        print("=" * 60)

        try:

            print(
                "Sending translation request..."
            )

            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            if not response.text:

                raise ValueError(
                    "Gemini returned an empty response."
                )

            print(
                f"TRANSLATION SUCCESS: "
                f"{model_name}"
            )

            return response.text.strip()

        except Exception as e:

            last_error = e

            error_text = str(e)

            print(
                f"TRANSLATION ERROR "
                f"({model_name}):"
            )

            print(error_text)

            # ------------------------------------------------
            # QUOTA
            # ------------------------------------------------

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
                    "Trying next model..."
                )

                continue

            # ------------------------------------------------
            # TEMPORARY UNAVAILABLE
            # ------------------------------------------------

            if (
                "503" in error_text
                or
                "UNAVAILABLE" in error_text
            ):

                print(
                    f"{model_name} temporarily "
                    f"unavailable."
                )

                print(
                    "Trying next model..."
                )

                continue

            # ------------------------------------------------
            # OTHER ERROR
            # ------------------------------------------------

            raise

    raise Exception(
        "All Gemini translation models failed. "
        "Last error: "
        + str(last_error)
    )


# ============================================================
# MAIN TRANSLATION FUNCTION
# ============================================================

def translate_text(
    text: str,
    language: str
):

    if language.lower() == "english":

        return text

    target_language = LANGUAGES.get(
        language.lower()
    )

    if not target_language:

        raise ValueError(
            f"Unsupported language: {language}"
        )

    # --------------------------------------------------------
    # Split large document
    # --------------------------------------------------------

    chunks = split_text_into_chunks(
        text
    )

    print("=" * 60)
    print(
        "STARTING CHUNKED TRANSLATION"
    )
    print(
        "TARGET LANGUAGE:",
        target_language
    )
    print(
        "TOTAL CHARACTERS:",
        len(text)
    )
    print(
        "TOTAL TRANSLATION CHUNKS:",
        len(chunks)
    )
    print("=" * 60)

    if not chunks:

        return ""

    translated_chunks = []

    # --------------------------------------------------------
    # Translate sequentially
    # --------------------------------------------------------

    for index, chunk in enumerate(
        chunks,
        start=1
    ):

        print("=" * 60)
        print(
            f"TRANSLATING CHUNK "
            f"{index}/{len(chunks)}"
        )
        print(
            f"CHUNK CHARACTERS: "
            f"{len(chunk)}"
        )
        print("=" * 60)

        translated = translate_chunk(
            chunk,
            target_language
        )

        translated_chunks.append(
            translated
        )

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    final_translation = "\n\n".join(
        translated_chunks
    )

    print("=" * 60)
    print(
        "CHUNKED TRANSLATION COMPLETE"
    )
    print(
        "TRANSLATED CHUNKS:",
        len(translated_chunks)
    )
    print("=" * 60)

    return final_translation