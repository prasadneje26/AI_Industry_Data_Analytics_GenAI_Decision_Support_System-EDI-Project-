import json
import os
from dotenv import load_dotenv

# Masigurado a ma-load dagiti environment variables manipud `.env`
load_dotenv()


def build_prompt(question, evidence):
    return (
        "You are an enterprise business decision-support copilot.\n"
        "Rules:\n"
        "1. Use ONLY the supplied evidence.\n"
        "2. Never invent numbers, causes, or business facts.\n"
        "3. Separate observed evidence from inference.\n"
        "4. If evidence is insufficient, explicitly say so.\n"
        "5. Give concise, practical recommendations with priority and rationale.\n\n"
        "STRUCTURED EVIDENCE:\n"
        + json.dumps(evidence, indent=2, default=str)
        + "\n\n"
        "MANAGER QUESTION:\n"
        + question
    )


def generate(question, evidence):
    # Siguraduhin natin na ma-reload dynamic variables
    load_dotenv()

    provider = os.getenv("GENAI_PROVIDER", "groq").lower()
    prompt = build_prompt(question, evidence)

    # 1. Subok ti GROQ
    groq_key = os.getenv("GROQ_API_KEY")
    if provider == "groq" or groq_key:
        if groq_key:
            try:
                from openai import OpenAI

                client = OpenAI(
                    base_url="https://api.groq.com/openai/v1", api_key=groq_key
                )
                model_name = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an enterprise decision-support copilot.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                )
                return response.choices[0].message.content
            except Exception as e:
                return f"Groq Provider Error: {e}"

    # 2. Subok ti GEMINI
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            from google import genai

            client = genai.Client(api_key=gemini_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            return f"Gemini Provider Error: {e}"

    return "GenAI is not configured. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in .env. All non-GenAI analytics remain available."