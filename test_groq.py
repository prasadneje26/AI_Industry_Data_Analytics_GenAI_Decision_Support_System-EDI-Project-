import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

key = os.getenv("GROQ_API_KEY")
print(f"Loaded Key: {key[:10]}...")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=key,
)

# Active supported model ID on Groq
response = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[{"role": "user", "content": "Hello, respond with 'Groq Working!'"}]
)

print(response.choices[0].message.content)