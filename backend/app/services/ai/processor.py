"""
AI处理器模块,处理角色分析和结论生成
"""
import json
import logging
import asyncio
import requests
from datetime import datetime
from typing import Dict, List, Any, AsyncIterator, Optional

from ...core.config import config
from .role_prompts import ROLE_PROMPTS

# 配置日志
logger = logging.getLogger(__name__)

# 请求速率限制配置
REQUEST_LIMIT = 3  # 每分钟最大请求数
REQUEST_INTERVAL = 60 / REQUEST_LIMIT  # 请求间隔时间（秒）

# 最后一次请求时间
last_request_time = None

async def process_actor_analysis(
    actor_data: Dict[str, str],
    stock_code: str,
    stock_name: str,
    kline_text: str,
    is_last: bool = False
) -> Dict[str, Any]:
    """处理单个角色的分析
    
    Args:
        actor_data: 角色数据,包含actor和model字段
        stock_code: 股票代码
        stock_name: 股票名称
        kline_text: 格式化的K线数据
        is_last: 是否最后一个角色
        
    Returns:
        包含分析结果和消息列表的字典
    """
    global last_request_time
    
    # 实现速率限制
    if last_request_time:
        elapsed = (datetime.now() - last_request_time).total_seconds()
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)
    
    last_request_time = datetime.now()
    actor = actor_data.get("actor", "")
    model = actor_data.get("model", "")
    messages = []
    
    if not actor or not model:
        messages.append(json.dumps({
            "message": f"警告: 角色或模型未指定,跳过",
            "type": "warning"
        }))
        return {"messages": messages}
        
    if actor not in ROLE_PROMPTS:
        messages.append(json.dumps({
            "message": f"警告: 未找到角色'{actor}'的提示词,跳过",
            "type": "warning"
        }))
        return {"messages": messages}
    
    # 输出更详细的进度信息
    messages.append(json.dumps({
        "message": f"正在使用{model}进行{actor}分析...",
        "type": "progress",
        "actor": actor
    }))
    
    # 准备提示词
    prompt = ROLE_PROMPTS[actor].format(
        stock_name=stock_name,
        stock_code=stock_code,
        kline_data=kline_text
    )
    
    # 添加分析开始的详细信息
    messages.append(json.dumps({
        "message": f"已准备{actor}分析提示词,字数:{len(prompt)}",
        "type": "info",
        "detail": "prompt_ready"
    }))
    
    try:
        # 输出API请求开始的信息
        messages.append(json.dumps({
            "message": f"开始请求{model} API进行{actor}分析...",
            "type": "info",
            "detail": "api_request_start",
            "model": model
        }))
        
        # 记录请求开始时间
        request_start_time = datetime.now()
        logger.info(f"开始请求 {model} API 进行 {actor} 分析, 提示词长度: {len(prompt)}")
        
        # 记录API密钥信息（不记录完整密钥）
        api_key = config.openrouter_api_key
        key_status = "未设置" if not api_key else f"已设置 (以{api_key[:8]}...开头)"
        logger.info(f"OpenRouter API密钥状态: {key_status}")
        
        # 准备请求头
        headers = {
            "Authorization": f"Bearer {config.openrouter_api_key}",
            "HTTP-Referer": config.site_url,
            "X-Title": config.site_name,
            "Content-Type": "application/json"
        }
        
        # 准备请求体
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个专业的股票分析AI助手"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        # 记录请求信息
        logger.info(f"请求URL: https://openrouter.ai/api/v1/chat/completions")
        logger.info(f"请求头: {headers}")
        logger.info(f"请求模型: {model}")
        
        # 调用AI API
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60  # 增加超时时间
        )
        
        # 计算请求耗时
        request_time = (datetime.now() - request_start_time).total_seconds()
        
        # 输出API响应信息
        messages.append(json.dumps({
            "message": f"{actor}分析API请求完成,耗时:{request_time:.2f}秒",
            "type": "info",
            "detail": "api_request_complete",
            "time_taken": f"{request_time:.2f}"
        }))
        
        logger.info(f"{actor}分析API请求完成,耗时:{request_time:.2f}秒,状态码:{response.status_code}")
        
        # 记录响应状态码
        logger.info(f"API响应状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            
            # 记录完整响应（用于调试）
            logger.info(f"API响应内容: {json.dumps(response_data, ensure_ascii=False)}")
            
            if response.status_code == 200 and "choices" in response_data:
                analysis_result = response_data["choices"][0]["message"]["content"]
                
                # 添加词数统计
                word_count = len(analysis_result.split())
                character_count = len(analysis_result)
                
                result_message = json.dumps({
                    "actor": actor,
                    "content": analysis_result,
                    "type": "analysis",
                    "stats": {
                        "word_count": word_count,
                        "character_count": character_count,
                        "model": model
                    }
                })
                
                messages.append(result_message)
                
                return {
                    "actor": actor,
                    "content": analysis_result,
                    "type": "analysis",
                    "messages": messages
                }
            else:
                # 提取详细错误信息
                error_obj = response_data.get("error", {})
                error_msg = error_obj.get("message", "未知错误")
                error_type = error_obj.get("type", "unknown")
                error_code = error_obj.get("code", "")
                
                # 记录详细错误
                logger.error(f"API错误: 类型={error_type}, 代码={error_code}, 消息={error_msg}")
                
                # 特别处理认证错误
                if "auth" in error_msg.lower() or error_type == "authentication_error" or error_code == "auth_required":
                    error_detail = "API认证失败，请检查OpenRouter API密钥是否有效"
                    logger.critical(f"认证错误: {error_msg}")
                else:
                    error_detail = error_msg
                
                messages.append(json.dumps({
                    "error": f"{actor}分析出错: {error_detail}",
                    "type": "error",
                    "detail": {
                        "error_type": error_type,
                        "error_code": error_code
                    }
                }))
                
                return {"messages": messages}
        except ValueError as e:
            # 处理JSON解析错误
            logger.error(f"解析API响应失败: {str(e)}")
            logger.error(f"原始响应内容: {response.text[:500]}...")
            
            messages.append(json.dumps({
                "error": f"{actor}分析出错: 无法解析API响应",
                "type": "error"
            }))
            
            return {"messages": messages}
    
    except Exception as e:
        logger.error(f"AI分析错误: {e}")
        messages.append(json.dumps({
            "error": f"{actor}分析出错: {str(e)}",
            "type": "error"
        }))
        
        return {"messages": messages}
    
    finally:
        # 如果不是最后一个角色,添加短暂延迟
        if not is_last:
            await asyncio.sleep(0.5)

async def generate_conclusion(
    results: List[Dict[str, Any]], 
    stock_code: str, 
    stock_name: str,
    conclusion_model: Optional[str] = None
) -> AsyncIterator[str]:
    """生成综合结论
    
    Args:
        results: 各个角色的分析结果列表
        stock_code: 股票代码
        stock_name: 股票名称
        conclusion_model: 结论生成使用的模型
    
    Yields:
        结论相关的消息
    """
    try:
        # 创建结论提示词
        analysis_parts = []
        for r in results:
            analysis_parts.append(f"【{r['actor']}分析】\n{r['content']}\n\n")
        
        analysis_text = "".join(analysis_parts)
        
        conclusion_prompt = (
            f"作为金融分析总结专家,请综合以下分析结果,为{stock_name}({stock_code})给出最终投资建议:\n\n"
            f"{analysis_text}\n"
            f"请综合上述分析,提供:\n"
            f"1. 投资评级(强烈推荐/推荐/中性/减持/强烈减持)\n"
            f"2. 主要投资理由(3点)\n"
            f"3. 主要风险提示(2点)\n"
            f"4. 投资时间框架建议(短期/中期/长期)"
        )

        # 输出生成结论的信息
        yield json.dumps({
            "message": "开始生成综合结论...",
            "type": "info",
            "detail": "conclusion_start"
        })
        
        # 确保有可用的模型
        if not conclusion_model:
            conclusion_model = "deepseek/deepseek-chat:free"
        
        logger.info(f"开始生成综合结论,使用模型:{conclusion_model}")
        
        # 记录请求开始时间
        conclusion_start_time = datetime.now()
        
        # 准备请求头
        headers = {
            "Authorization": f"Bearer {config.openrouter_api_key}",
            "HTTP-Referer": config.site_url,
            "X-Title": config.site_name,
            "Content-Type": "application/json"
        }
        
        # 准备请求体
        payload = {
            "model": conclusion_model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个专业的股票分析综合评估专家"
                },
                {
                    "role": "user",
                    "content": conclusion_prompt
                }
            ]
        }
        
        # 记录请求信息
        logger.info(f"结论生成 - 请求URL: https://openrouter.ai/api/v1/chat/completions")
        logger.info(f"结论生成 - 请求模型: {conclusion_model}")
        
        # 调用AI API获取结论
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60  # 增加超时时间
        )
        
        # 记录响应状态码
        logger.info(f"结论API响应状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            
            # 记录完整响应（用于调试）
            logger.info(f"结论API响应内容: {json.dumps(response_data, ensure_ascii=False)}")
            
            if response.status_code == 200 and "choices" in response_data:
                conclusion = response_data["choices"][0]["message"]["content"]
                
                # 计算结论生成耗时
                conclusion_time = (datetime.now() - conclusion_start_time).total_seconds()
                
                # 添加词数统计
                conclusion_word_count = len(conclusion.split())
                conclusion_char_count = len(conclusion)
                
                yield json.dumps({
                    "actor": "综合结论",
                    "content": conclusion,
                    "type": "conclusion",
                    "stats": {
                        "word_count": conclusion_word_count,
                        "character_count": conclusion_char_count,
                        "time_taken": f"{conclusion_time:.2f}秒",
                        "model": conclusion_model
                    }
                })
                
                logger.info(f"综合结论生成完成,耗时:{conclusion_time:.2f}秒,字数:{conclusion_char_count}")
            else:
                # 提取详细错误信息
                error_obj = response_data.get("error", {})
                error_msg = error_obj.get("message", "未知错误")
                error_type = error_obj.get("type", "unknown")
                error_code = error_obj.get("code", "")
                
                # 记录详细错误
                logger.error(f"结论API错误: 类型={error_type}, 代码={error_code}, 消息={error_msg}")
                
                # 特别处理认证错误
                if "auth" in error_msg.lower() or error_type == "authentication_error" or error_code == "auth_required":
                    error_detail = "API认证失败，请检查OpenRouter API密钥是否有效"
                    logger.critical(f"结论生成认证错误: {error_msg}")
                else:
                    error_detail = error_msg
                
                yield json.dumps({
                    "error": f"生成结论出错: {error_detail}",
                    "type": "error",
                    "detail": {
                        "error_type": error_type,
                        "error_code": error_code
                    }
                })
        except ValueError as e:
            # 处理JSON解析错误
            logger.error(f"解析结论API响应失败: {str(e)}")
            logger.error(f"原始结论响应内容: {response.text[:500]}...")
            
            yield json.dumps({
                "error": f"生成结论出错: 无法解析API响应",
                "type": "error"
            })
    
    except Exception as e:
        logger.error(f"生成结论错误: {e}")
        yield json.dumps({
            "error": f"生成结论出错: {str(e)}",
            "type": "error"
        })
    
    # 输出总结信息
    total_actors = len(results)
    yield json.dumps({
        "message": f"分析完成,总共分析了{total_actors}个角色",
        "type": "complete"
    })
