import os
from pydantic_ai.models.openai import OpenAIChatModel

def get_llm(model_name: str = None) -> OpenAIChatModel:
    """
    Returns a Pydantic AI OpenAIChatModel configured for OpenRouter.
    If the model_name is not provided, it defaults to the OPENROUTER_MODEL env variable.
    """
    model = model_name or os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5")
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    
    if not api_key:
        api_key = "sk-or-dummy-key"
    
    try:
        from pydantic_ai.providers.openrouter import OpenRouterProvider
        provider = OpenRouterProvider(api_key=api_key)
    except (ImportError, ModuleNotFoundError):
        from pydantic_ai.providers.openai import OpenAIProvider
        provider = OpenAIProvider(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        
    return OpenAIChatModel(
        model,
        provider=provider
    )
