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

# 重试配置
MAX_RETRIES = 3  # 最大重试次数
RETRY_DELAY = 2  # 重试间隔（秒）

# 备用模型配置
FALLBACK_MODELS = [
    "deepseek/deepseek-chat:free",
    "google/gemini-exp-1206:free",
    "google/gemini-2.0-flash-lite-preview-02-05:free"
]

# 最后一次请求时间
last_request_time = None

async def process_actor_analysis(
    actor_data: Dict[str, str],
    stock_code: str,
    stock_name: str,
    kline_text: str,
    is_last: bool = False,
    is_conversation: bool = False,
    reduced_logging: bool = False,
    retry_count: int = 0,
    fallback_model_index: int = -1
) -> Dict[str, Any]:
    """处理单个角色的分析
    
    Args:
        actor_data: 角色数据,包含actor和model字段
        stock_code: 股票代码
        stock_name: 股票名称
        kline_text: 格式化的K线数据
        is_last: 是否最后一个角色
        is_conversation: 是否以对话形式进行分析
        reduced_logging: 是否减少日志输出
        
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
    base_prompt = ROLE_PROMPTS[actor].format(
        stock_name=stock_name,
        stock_code=stock_code,
        kline_data=kline_text
    )
    
    # 如果是对话模式，修改提示词以包含所有之前的对话记录
    # 不再仅限于 "first_round_opinions"，而是处理任何轮次的对话
    if is_conversation:
        previous_opinions = actor_data.get("first_round_opinions", "")
        if previous_opinions:
            prompt = (
                f"{base_prompt}\n\n"
                f"以下是之前的分析和观点记录，请基于这些信息继续进行分析，重点关注新的见解或反驳现有观点：\n\n"
                f"{previous_opinions}"
            )
        else:
            prompt = base_prompt
    else:
        prompt = base_prompt
    
    # 减少不必要的详细日志
    if not reduced_logging:
        # 添加分析开始的详细信息
        messages.append(json.dumps({
            "message": f"已准备{actor}分析提示词,字数:{len(prompt)}",
            "type": "info",
            "detail": "prompt_ready"
        }))
    
    try:
        # 只输出必要的API请求信息
        if not reduced_logging:
            messages.append(json.dumps({
                "message": f"开始请求{model} API进行{actor}分析...",
                "type": "info",
                "detail": "api_request_start",
                "model": model
            }))
        
        # 记录请求开始时间
        request_start_time = datetime.now()
        if not reduced_logging:
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
        # 修改系统提示词，更好地引导模型进行多轮对话分析
        system_prompt = "你是一个专业的股票分析AI助手"
        if is_conversation:
            system_prompt += "，正在参与多轮分析讨论。请基于之前的分析进行深入评论，可以同意、补充或反驳其他观点。"
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "timeout": 120  # 增加请求超时时间到120秒
        }
        
        # 减少不必要的日志
        if not reduced_logging:
            # 记录请求信息
            logger.info(f"请求URL: https://openrouter.ai/api/v1/chat/completions")
            logger.info(f"请求头: {headers}")
            logger.info(f"请求模型: {model}")
        
        # 添加API请求信息到前端消息中
        messages.append(json.dumps({
            "message": f"{actor}分析API请求详情",
            "type": "api_request",
            "details": {
                "model": model,
                "content": prompt,  # 将提示词内容添加到详情中
                "timestamp": datetime.now().isoformat()
            }
        }))
        
        # 调用AI API - 增加超时时间
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=180  # 增加超时时间到3分钟
        )
        
        # 计算请求耗时
        request_time = (datetime.now() - request_start_time).total_seconds()
        
        # 只输出必要的响应信息
        messages.append(json.dumps({
            "message": f"{actor}分析API请求完成,耗时:{request_time:.2f}秒",
            "type": "info",
            "detail": "api_request_complete",
            "time_taken": f"{request_time:.2f}"
        }))
        
        if not reduced_logging:
            logger.info(f"{actor}分析API请求完成,耗时:{request_time:.2f}秒,状态码:{response.status_code}")
            # 记录响应状态码
            logger.info(f"API响应状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            
            # 减少不必要的日志
            if not reduced_logging:
                # 记录完整响应（用于调试）
                logger.info(f"API响应内容: {json.dumps(response_data, ensure_ascii=False)}")
            
            if response.status_code == 200 and "choices" in response_data:
                analysis_result = response_data["choices"][0]["message"]["content"]
                
                # 添加词数统计
                word_count = len(analysis_result.split())
                character_count = len(analysis_result)
                
                # 修改: 统一设置为分析类型为"analysis"，无论是否是会话模式
                # 即使是conversation类型的消息也设置为analysis类型，确保前端能正确渲染
                analysis_type = "analysis"
                
                result_message = json.dumps({
                    "actor": actor,
                    "content": analysis_result,
                    "type": analysis_type,  # 统一输出为 "analysis" 类型
                    "stats": {
                        "word_count": word_count,
                        "character_count": character_count,
                        "model": model
                    },
                    "api_details": {
                        "payload": {
                            "content": prompt  # 将提示词内容添加到API详情中
                        }
                    }
                })
                
                messages.append(result_message)
                
                return {
                    "actor": actor,
                    "content": analysis_result,
                    "type": analysis_type,  # 统一输出为 "analysis" 类型
                    "messages": messages,
                    "api_details": {
                        "payload": {
                            "content": prompt  # 将提示词内容添加到API详情中
                        }
                    }
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
                    # 添加通用错误处理
                    error_detail = error_msg
                    
                    # 处理提供商错误
                    if "provider" in error_msg.lower() or error_code == 400:
                        # 检查是否可以重试
                        if retry_count < MAX_RETRIES:
                            next_retry = retry_count + 1
                            retry_delay = RETRY_DELAY * next_retry  # 递增延迟
                            
                            messages.append(json.dumps({
                                "message": f"{actor}分析遇到临时错误，正在进行第{next_retry}次重试...",
                                "type": "retry",
                                "retry_count": next_retry
                            }))
                            
                            logger.info(f"Provider错误，正在进行第{next_retry}次重试，延迟{retry_delay}秒")
                            await asyncio.sleep(retry_delay)
                            
                            return await process_actor_analysis(
                                actor_data, stock_code, stock_name, kline_text,
                                is_last, is_conversation, reduced_logging,
                                retry_count=next_retry
                            )
                        # 尝试使用备用模型
                        elif fallback_model_index < len(FALLBACK_MODELS) - 1:
                            next_fallback_index = fallback_model_index + 1
                            fallback_model = FALLBACK_MODELS[next_fallback_index]
                            
                            # 如果当前模型已经是备用模型之一，跳过
                            if model == fallback_model:
                                next_fallback_index += 1
                                if next_fallback_index >= len(FALLBACK_MODELS):
                                    error_detail = "所有可用模型均已尝试，请稍后重试"
                                else:
                                    fallback_model = FALLBACK_MODELS[next_fallback_index]
                            
                            if next_fallback_index < len(FALLBACK_MODELS):
                                messages.append(json.dumps({
                                    "message": f"{actor}分析使用模型{model}失败，正在尝试备用模型{fallback_model}...",
                                    "type": "fallback",
                                    "original_model": model,
                                    "fallback_model": fallback_model
                                }))
                                
                                logger.info(f"正在尝试备用模型: {fallback_model}")
                                
                                # 使用备用模型重试
                                actor_data_copy = actor_data.copy()
                                actor_data_copy["model"] = fallback_model
                                
                                return await process_actor_analysis(
                                    actor_data_copy, stock_code, stock_name, kline_text,
                                    is_last, is_conversation, reduced_logging,
                                    retry_count=0,  # 重置重试计数
                                    fallback_model_index=next_fallback_index
                                )
                        
                        error_detail = "AI服务提供商暂时不可用，已尝试所有可用选项"
                    
                    messages.append(json.dumps({
                        "error": f"{actor}分析出错: {error_detail}",
                        "type": "error",
                        "detail": {
                            "error_type": error_type,
                            "error_code": error_code,
                            "model": model,
                            "timestamp": datetime.now().isoformat()
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
    conclusion_model: Optional[str] = None,
    reduced_logging: bool = False,
    retry_count: int = 0,
    fallback_model_index: int = -1
) -> AsyncIterator[str]:
    """生成综合结论
    
    Args:
        results: 各个角色的分析结果列表
        stock_code: 股票代码
        stock_name: 股票名称
        conclusion_model: 结论生成使用的模型
        reduced_logging: 是否减少日志输出
    
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
        
        if not reduced_logging:
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
            ],
            "timeout": 120  # 增加请求超时时间到120秒
        }
        
        if not reduced_logging:
            # 记录请求信息
            logger.info(f"结论生成 - 请求URL: https://openrouter.ai/api/v1/chat/completions")
            logger.info(f"结论生成 - 请求模型: {conclusion_model}")
        
        # 调用AI API获取结论 - 增加超时时间
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=180  # 增加超时时间到3分钟
        )
        
        if not reduced_logging:
            # 记录响应状态码
            logger.info(f"结论API响应状态码: {response.status_code}")
        
        try:
            response_data = response.json()
            
            if not reduced_logging:
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
                
                if not reduced_logging:
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
                    # 处理提供商错误
                    error_detail = error_msg
                    if "provider" in error_msg.lower() or error_code == 400:
                        # 检查是否可以重试
                        if retry_count < MAX_RETRIES:
                            next_retry = retry_count + 1
                            retry_delay = RETRY_DELAY * next_retry  # 递增延迟
                            
                            yield json.dumps({
                                "message": f"结论生成遇到临时错误，正在进行第{next_retry}次重试...",
                                "type": "retry",
                                "retry_count": next_retry
                            })
                            
                            logger.info(f"结论生成Provider错误，正在进行第{next_retry}次重试，延迟{retry_delay}秒")
                            await asyncio.sleep(retry_delay)
                            
                            # 递归调用自身重试
                            async for message in generate_conclusion(
                                results, stock_code, stock_name, conclusion_model,
                                reduced_logging, retry_count=next_retry
                            ):
                                yield message
                            return  # 重试后返回
                            
                        # 尝试使用备用模型
                        elif fallback_model_index < len(FALLBACK_MODELS) - 1:
                            next_fallback_index = fallback_model_index + 1
                            fallback_model = FALLBACK_MODELS[next_fallback_index]
                            
                            # 如果当前模型已经是备用模型之一，跳过
                            if conclusion_model == fallback_model:
                                next_fallback_index += 1
                                if next_fallback_index >= len(FALLBACK_MODELS):
                                    error_detail = "所有可用模型均已尝试，请稍后重试"
                                else:
                                    fallback_model = FALLBACK_MODELS[next_fallback_index]
                            
                            if next_fallback_index < len(FALLBACK_MODELS):
                                yield json.dumps({
                                    "message": f"结论生成使用模型{conclusion_model}失败，正在尝试备用模型{fallback_model}...",
                                    "type": "fallback",
                                    "original_model": conclusion_model,
                                    "fallback_model": fallback_model
                                })
                                
                                logger.info(f"结论生成正在尝试备用模型: {fallback_model}")
                                
                                # 使用备用模型重试
                                async for message in generate_conclusion(
                                    results, stock_code, stock_name, fallback_model,
                                    reduced_logging, retry_count=0,
                                    fallback_model_index=next_fallback_index
                                ):
                                    yield message
                                return  # 重试后返回
                        
                        error_detail = "AI服务提供商暂时不可用，已尝试所有可用选项"
                
                yield json.dumps({
                    "error": f"生成结论出错: {error_detail}",
                    "type": "error",
                    "detail": {
                        "error_type": error_type,
                        "error_code": error_code,
                        "model": conclusion_model,
                        "timestamp": datetime.now().isoformat()
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
