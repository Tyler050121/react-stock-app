"""
股票AI分析服务
"""
import logging
import json
import asyncio
from typing import Dict, List, Optional, AsyncIterator, Any
from .processor import process_actor_analysis, generate_conclusion

# 配置日志
logger = logging.getLogger(__name__)


class StockAnalyzer:
    """股票AI分析器"""
    @staticmethod
    async def analyze_stock(
        stock_code: str,
        stock_name: str,
        actors: List[Dict[str, str]],
        kline_data: Optional[List[Dict]] = None,
        max_rounds: int = 3  # 默认最大对话轮数为3轮
    ) -> AsyncIterator[str]:
        """使用AI分析股票,返回流式结果

        Args:
            stock_code: 股票代码
            stock_name: 股票名称
            actors: 分析角色列表,每个元素包含actor和model
            kline_data: K线数据(可选)
            max_rounds: 最大对话轮数(默认3轮)

        Yields:
            逐条分析结果
        """
        # 基本参数验证
        for msg in validate_params(stock_code, stock_name, actors):
            yield msg

        # 处理K线数据
        kline_text = format_kline_data(kline_data)

        # 过滤掉conclusion_model，只在最后一轮使用
        active_actors = [actor for actor in actors if actor.get(
            "actor") != "conclusion_model"]

        # 存储所有轮次的分析结果
        all_round_results = []
        current_round_results = []
        
        # 对话历史记录
        conversation_history = ""
        
        # 多轮对话循环
        for round_num in range(1, max_rounds + 1):
            # 输出当前轮次开始信息
            yield json.dumps({
                "message": f"开始第{round_num}轮分析...",
                "type": "info",
                "round": round_num,
                "detail": f"round_{round_num}_start"
            })
            
            current_round_results = []
            
            for i, actor_data in enumerate(active_actors):
                try:
                    # 复制actor数据并添加对话历史
                    actor_data_with_history = actor_data.copy()
                    
                    # 第一轮不需要添加历史，后面的轮次需要添加所有历史
                    if round_num > 1 and conversation_history:
                        actor_data_with_history["first_round_opinions"] = conversation_history
                    
                    # 设置超时时间以防止单个分析卡住整个流程
                    result = await asyncio.wait_for(
                        process_actor_analysis(
                            actor_data_with_history,
                            stock_code,
                            stock_name,
                            kline_text,
                            is_last=(i == len(active_actors) - 1),
                            is_conversation=(round_num > 1),  # 第一轮不是对话模式
                            reduced_logging=True
                        ),
                        timeout=200  # 超时
                    )

                    # 收集结果
                    if result and result.get("content"):
                        current_round_results.append(result)

                    # 将结果信息传递给调用者
                    for message in result.get("messages", []):
                        yield message
                        # 添加短暂延迟，确保前端能够接收到数据
                        await asyncio.sleep(0.1)

                    # 输出当前actor处理完成
                    yield json.dumps({
                        "message": f"角色 {actor_data.get('actor', '未知角色')} 完成第{round_num}轮分析",
                        "type": "info",
                        "round": round_num,
                        "detail": f"actor_completed_{i}"
                    })

                except asyncio.TimeoutError:
                    logger.error(f"{actor_data.get('actor', '未知角色')}分析超时")
                    yield json.dumps({
                        "error": f"{actor_data.get('actor', '未知角色')}分析超时，已跳过",
                        "type": "error",
                        "detail": "timeout"
                    })
            
            # 将当前轮次结果添加到总结果中
            all_round_results.extend(current_round_results)
            
            # 如果当前轮次没有结果但有之前的结果，使用之前的结果继续
            if not current_round_results and all_round_results:
                yield json.dumps({
                    "message": f"第{round_num}轮分析未产生结果，使用之前的结果继续",
                    "type": "warning"
                })
            # 如果第一轮就没有结果，直接结束分析
            elif not current_round_results and round_num == 1:
                yield json.dumps({
                    "message": "第一轮分析未产生结果，分析终止",
                    "type": "warning"
                })
                return
            
            # 更新对话历史记录，添加当前轮次的内容
            new_opinions = "\n\n".join([
                f"【第{round_num}轮 - {r['actor']}的观点】\n{r['content']}"
                for r in current_round_results
            ])
            
            # 如果是第一轮，直接设置对话历史，否则追加到现有历史
            if round_num == 1:
                conversation_history = new_opinions
            else:
                conversation_history = f"{conversation_history}\n\n{new_opinions}"
            
            # 如果不是最后一轮，添加轮次之间的分隔符
            if round_num < max_rounds:
                yield json.dumps({
                    "message": f"第{round_num}轮分析完成，准备开始第{round_num+1}轮对话讨论...",
                    "type": "info",
                    "detail": "round_transition"
                })
                
                # 短暂延迟，确保前端能够接收前面的数据
                await asyncio.sleep(0.5)
        
        # 延迟一下，确保前端接收到前面的消息
        await asyncio.sleep(1.0)

        # 生成综合结论 (只在所有轮次分析后进行)
        if all_round_results:
            # 提取conclusion_model(如果有)
            conclusion_model = None
            for actor_data in actors:
                if (actor_data.get("actor") == "conclusion_model"):
                    conclusion_model = actor_data.get("model")
                    break

            # 如果没有指定结论模型,使用第一个角色的模型
            if not conclusion_model and active_actors:
                conclusion_model = active_actors[0].get("model")

            yield json.dumps({
                "message": "开始生成最终综合结论...",
                "type": "info",
                "detail": "conclusion_generation_start"
            })

            try:
                # 设置结论生成超时
                async with asyncio.timeout(360):  # 6分钟超时
                    async for message in generate_conclusion(
                        all_round_results, stock_code, stock_name, conclusion_model, reduced_logging=True
                    ):
                        yield message
                        # 添加短暂延迟，确保前端能够接收到数据
                        await asyncio.sleep(0.1)
            except asyncio.TimeoutError:  # 修正这里的异常类型
                logger.error("综合结论生成超时")
                yield json.dumps({
                    "error": "综合结论生成超时，请检查您的网络连接或模型服务状态",
                    "type": "error",
                    "detail": "conclusion_timeout"
                })

                # 虽然超时但仍发送完成信号
                yield json.dumps({
                    "message": "分析已完成(但结论生成超时)",
                    "type": "complete"
                })
            else:
                # 正常完成
                yield json.dumps({
                    "message": "分析已完成",
                    "type": "complete"
                })


def validate_params(stock_code: str, stock_name: str, actors: List[Dict[str, str]]) -> AsyncIterator[str]:
    """验证参数并返回错误信息(如果有)"""
    import json

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
