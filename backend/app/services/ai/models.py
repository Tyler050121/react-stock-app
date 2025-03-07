"""
AI模型和角色配置
"""

# 可用模型列表
AVAILABLE_MODELS = [
    {"value": "deepseek/deepseek-chat:free", "label": "DeepSeek V3 (free)"},
    # {"value": "deepseek/deepseek-r1:free", "label": "DeepSeek R1 (free)"},
    {"value": "google/gemini-exp-1206:free", "label": "gemini"},
    {"value": "meta-llama/llama-3-8b-instruct:free", "label": "meta-llama/llama-3-8b-instruct:free"},
]

# 角色配置(扮演的专家角色)
AVAILABLE_ROLES = [
    {
        "value": "宏观策划师", 
        "label": "宏观策划师", 
        "description": "分析宏观经济形势和行业趋势"
    },
    {
        "value": "技术操盘手", 
        "label": "技术操盘手", 
        "description": "分析K线形态和技术指标"
    },
    {
        "value": "风险管理师", 
        "label": "风险管理师", 
        "description": "评估投资风险和资金管理"
    }
]

async def get_available_models_and_roles():
    """获取可用的模型和角色列表"""
    return {
        "models": AVAILABLE_MODELS,
        "roles": AVAILABLE_ROLES
    }
