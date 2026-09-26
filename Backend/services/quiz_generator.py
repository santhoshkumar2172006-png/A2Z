import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing from .env")

client = genai.Client(api_key=API_KEY)


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

    last_error = None

    for model_name in MODELS:

        print("=" * 60)
        print(f"QUIZ MODEL: {model_name}")
        print("=" * 60)

        try:

            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            if not response.text:
                raise ValueError(
                    "Gemini returned an empty response."
                )

            print(f"QUIZ SUCCESS: {model_name}")

            return response.text

        except Exception as e:

            last_error = e
            error_text = str(e)

            print(f"{model_name} ERROR:")
            print(error_text)

            if (
                "429" in error_text
                or "RESOURCE_EXHAUSTED" in error_text
                or "503" in error_text
                or "UNAVAILABLE" in error_text
            ):
                print("Trying next quiz model...")
                continue

            raise

    raise Exception(
        "All configured Gemini models are unavailable. "
        f"Last error: {last_error}"
    )


def parse_json_response(text):

    text = text.strip()

    if text.startswith("```json"):
        text = text[7:]

    elif text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


def generate_quiz(
    concepts,
    document_questions,
    language="english",
    difficulty="medium",
    question_count=10
):

    language_name = LANGUAGE_NAMES.get(
        language.lower(),
        "English"
    )

    # Limit the amount of source information sent to Gemini.
    concepts = concepts[:40]
    document_questions = document_questions[:30]

    source_text = ""

    source_text += "\n\n===== CONCEPTS =====\n"

    for concept in concepts:

        source_text += f"""
Concept: {concept.get("name_en", "")}
Explanation: {concept.get("explanation_en", "")}
Importance: {concept.get("importance_en", "")}
Page: {concept.get("page", "")}
"""

    source_text += "\n\n===== QUESTIONS FOUND IN DOCUMENT =====\n"

    for question in document_questions:

        source_text += f"""
Question: {question.get("question_en", "")}
Page: {question.get("page", "")}
"""

    prompt = f"""
You are the quiz generation engine of Learn A2Z.

Create an educational quiz based ONLY on the supplied
concepts and questions extracted from the uploaded document.

Selected language:
{language_name}

Difficulty:
{difficulty}

Number of questions:
{question_count}

IMPORTANT RULES:

1. Questions must be related to the supplied document.
2. Do not introduce unrelated topics.
3. Do not invent document-specific facts.
4. Questions should test understanding, not only memorization.
5. Keep questions suitable for a college student.
6. Each question must have exactly one correct answer.
7. Use four options for every question.
8. Avoid duplicate questions.
9. Provide explanations for the correct answer.
10. Provide the question in English and {language_name}.
11. Provide every option in English.
12. Keep the selected-language question natural.
13. If the selected language is English, use English for both fields.
14. Return ONLY valid JSON.

Use this exact structure:

{{
    "title": "Learn A2Z Quiz",
    "questions": [
        {{
            "id": "q1",
            "question_en": "",
            "question_target": "",
            "options": [
                {{
                    "id": "A",
                    "text": ""
                }},
                {{
                    "id": "B",
                    "text": ""
                }},
                {{
                    "id": "C",
                    "text": ""
                }},
                {{
                    "id": "D",
                    "text": ""
                }}
            ],
            "correct_answer": "A",
            "explanation_en": "",
            "explanation_target": "",
            "page": 1
        }}
    ]
}}

SOURCE MATERIAL:

{source_text}
"""

    result = call_gemini(prompt)

    quiz = parse_json_response(result)

    return quiz