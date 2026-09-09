import os, json
from dotenv import load_dotenv
load_dotenv()

def build_prompt(question,evidence):
    return '''You are an enterprise business decision-support copilot.\nRules:\n1. Use ONLY the supplied evidence.\n2. Never invent numbers, causes, or business facts.\n3. Separate observed evidence from inference.\n4. If evidence is insufficient, explicitly say so.\n5. Give concise, practical recommendations with priority and rationale.\n\nSTRUCTURED EVIDENCE:\n''' + json.dumps(evidence,indent=2,default=str) + '\n\nMANAGER QUESTION:\n' + question

def generate(question,evidence):
    provider=os.getenv('GENAI_PROVIDER','gemini').lower(); prompt=build_prompt(question,evidence)
    try:
        if provider=='openai' and os.getenv('OPENAI_API_KEY'):
            from openai import OpenAI
            client=OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            r=client.chat.completions.create(model=os.getenv('OPENAI_MODEL','gpt-5-mini'),messages=[{'role':'system','content':'You are a grounded business analytics copilot.'},{'role':'user','content':prompt}],temperature=.1)
            return r.choices[0].message.content
        if provider=='gemini' and os.getenv('GEMINI_API_KEY'):
            import google.generativeai as genai
            genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
            model=genai.GenerativeModel(os.getenv('GEMINI_MODEL','gemini-2.5-flash'))
            return model.generate_content(prompt).text
    except Exception as e:
        message = str(e).lower()
        if '429' in message or 'credit' in message or 'quota' in message or 'insufficient' in message:
            return ('GenAI is temporarily unavailable because the configured provider account has no remaining credits. '
                    'Add provider credits or configure a different provider key in .env. '
                    'Analytics, anomaly detection, forecasting, inventory risk, and PDF reports remain available.')
        return f'GenAI provider error: {e}'
    return 'GenAI is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY in .env. All non-GenAI analytics remain available.'
