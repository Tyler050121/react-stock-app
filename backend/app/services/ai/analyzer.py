"""
股票AI分析服务
"""
import logging
from typing import Dict, List, Optional, AsyncIterator, Any

from .processor import process_actor_analysis, generate_conclusion
from .models import get_available_models_and_roles

# 配置日志
logger = logging.getLogger(__name__)

class StockAnalyzer:
    """股票AI分析器"""
    
    @staticmethod
    async def get_models_and_roles():
        """获取可用的模型和角色列表"""
        return await get_available_models_and_roles()
    
    @staticmethod
    async def analyze_stock(
        stock_code: str,
        stock_name: str,
        actors: List[Dict[str, str]],
        kline_data: Optional[List[Dict]] = None
    ) -> AsyncIterator[str]:
        """使用AI分析股票,返回流式结果
        
        Args:
            stock_code: 股票代码
            stock_name: 股票名称
            actors: 分析角色列表,每个元素包含actor和model
            kline_data: K线数据(可选)
            
        Yields:
            逐条分析结果
        """
        # 基本参数验证
        for msg in validate_params(stock_code, stock_name, actors):
            yield msg
        
        # 处理K线数据
        kline_text = format_kline_data(kline_data)
        
        # 处理每个角色的分析
        results = []
        for i, actor_data in enumerate(actors):
            # 排除结论模型(不是真正的角色)
            if actor_data.get("actor") == "conclusion_model":
                continue
                
            # 处理角色分析
            result = await process_actor_analysis(
                actor_data, 
                stock_code, 
                stock_name, 
                kline_text, 
                is_last=(i == len(actors) - 1)
            )
            
            # 收集结果
            if result and result.get("content"):
                results.append(result)
                
            # 将结果信息传递给调用者
            for message in result.get("messages", []):
                yield message
        
        # 生成综合结论
        if results:
            # 提取conclusion_model(如果有)
            conclusion_model = None
            for actor_data in actors:
                if actor_data.get("actor") == "conclusion_model":
                    conclusion_model = actor_data.get("model")
                    break
            
            # 如果没有指定结论模型,使用第一个角色的模型
            if not conclusion_model and actors:
                conclusion_model = actors[0].get("model")
                
            # 生成综合结论
            async for message in generate_conclusion(
                results, stock_code, stock_name, conclusion_model
            ):
                yield message

def validate_params(stock_code: str, stock_name: str, actors: List[Dict[str, str]]) -> AsyncIterator[str]:
    """验证参数并返回错误信息(如果有)"""
    import json
    
    if not stock_code or not stock_name:
        yield json.dumps({
            "error": "股票代码或名称不能为空",
            "type": "error"
        })
        return
        
    if not actors or len(actors) < 1:
        yield json.dumps({
            "error": "至少需要一个分析角色",
            "type": "error"
        })
        return
    
    # 开始分析过程
    yield json.dumps({
        "message": f"开始分析 {stock_name}({stock_code})",
        "type": "info"
    })

def format_kline_data(kline_data: Optional[List[Dict]]) -> str:
    """格式化K线数据为文本格式"""
    if not kline_data or len(kline_data) == 0:
        return "数据暂不可用"
        
    # 只取最近的20条数据(减少提示词长度)
    recent_data = kline_data[:20]
    return "\n".join([
        f"日期: {k.get('date', 'NA')}, 开盘: {k.get('open', 'NA')}, "
        f"最高: {k.get('high', 'NA')}, 最低: {k.get('low', 'NA')}, "
        f"收盘: {k.get('close', 'NA')}, 成交量: {k.get('volume', 'NA')}"
        for k in recent_data
    ])
