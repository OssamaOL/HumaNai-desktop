import asyncio
import os
from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

from app.ai.llm import get_llm
from pydantic_ai import Agent

async def main():
    print("--- STARTING SYSTEM INTEGRATION TEST ---")
    
    # 1. Test LLM / OpenRouter Connection
    model_name = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5")
    print(f"\n1. Testing OpenRouter connection using model: {model_name}...")
    try:
        model = get_llm()
        agent = Agent(model)
        result = await agent.run("Dis bonjour et confirme que tu es operationnel pour HumaNai en une phrase courte.")
        print("[SUCCESS] OpenRouter Response SUCCESSFUL:")
        print(f"   Response: {result.output}")
    except Exception as e:
        print("[ERROR] OpenRouter Error:")
        import traceback
        traceback.print_exc()
        
if __name__ == "__main__":
    asyncio.run(main())
