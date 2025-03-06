"""
爬虫相关API路由
"""
import asyncio
import logging
import json
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from datetime import datetime
from typing import Dict, List, Optional, AsyncIterator
from functools import partial

from ..utils.progress import progress_manager
from app.crawler.stock_crawler import StockCrawler

# 配置日志
logger = logging.getLogger(__name__)

# 存储爬虫任务状态
crawler_tasks: Dict[str, dict] = {}

router = APIRouter()

async def progress_callback(task_id: str, current: int, total: int):
    """爬虫进度回调"""
    logger.info(f"进度回调: {task_id} - {current}/{total}")
    try:
        # 更新任务状态
        status_str = "running"
        if current >= total and total > 0:
            status_str = "completed"
            crawler_tasks[task_id]["status"] = status_str

        if task_id in crawler_tasks:
            crawler_tasks[task_id].update({
                "total": total,
                "current": current,
                "progress": int(current * 100 / total) if total > 0 else 0
            })
        
        # 发送WebSocket进度
        try:
            await progress_manager.send_ws_progress(task_id, current, total, status_str)
        except Exception as e:
            logger.error(f"发送WebSocket进度失败: {e}", exc_info=True)
            
        # 发送SSE进度
        try:
            await progress_manager.send_sse_progress(task_id, current, total, status_str)
        except Exception as e:
            logger.error(f"发送SSE进度失败: {e}", exc_info=True)
            
    except Exception as e:
        logger.error(f"处理进度回调失败: {e}", exc_info=True)
        crawler_tasks[task_id]["status"] = "failed"
        crawler_tasks[task_id]["error"] = str(e)

@router.post("/start")
async def start_crawler(request: Request):
    """启动爬虫任务"""
    task_id = datetime.now().strftime("%Y%m%d%H%M%S")
    logger.info(f"创建爬虫任务: {task_id}")
    
    # 从请求中获取stock_count参数
    stock_count = 10  # 默认值
    try:
        # 尝试从查询参数获取
        stock_count = int(request.query_params.get("stock_count", 10))
        logger.info(f"从查询参数获取股票数量: {stock_count}")
    except ValueError:
        try:
            # 尝试从请求体获取
            data = await request.json()
            stock_count = int(data.get("stock_count", 10))
            logger.info(f"从请求体获取股票数量: {stock_count}")
        except (json.JSONDecodeError, TypeError, ValueError):
            logger.warning(f"无法解析股票数量参数,使用默认值: {stock_count}")
    
    # 创建带有进度回调的爬虫实例
    spider = StockCrawler(
        progress_callback=partial(progress_callback, task_id)
    )
    
    # 初始化任务状态
    crawler_tasks[task_id] = {
        "status": "running",
        "start_time": datetime.now(),
        "current": 0,
        "total": 0,
        "progress": 0
    }
    
    # 启动爬虫任务,传递股票数量参数
    try:
        task = asyncio.create_task(spider.run(stock_count=stock_count))
        
        def on_task_done(t):
            try:
                t.result()  # 这会抛出任何任务中的异常
                crawler_tasks[task_id]["status"] = "completed"
                logger.info(f"爬虫任务完成: {task_id}")
            except Exception as e:
                crawler_tasks[task_id].update({
                    "status": "failed",
                    "error": str(e)
                })
                logger.error(f"爬虫任务失败: {task_id}, 错误: {e}")

        task.add_done_callback(on_task_done)
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        crawler_tasks[task_id]["status"] = "failed"
        crawler_tasks[task_id]["error"] = str(e)
        logger.error(f"启动爬虫任务失败: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )

@router.get("/status/{task_id}")
async def get_crawler_status(task_id: str):
    """获取爬虫任务状态"""
    if task_id not in crawler_tasks:
        return JSONResponse(
            status_code=404,
            content={"detail": "Task not found"}
        )
        
    task_info = crawler_tasks[task_id].copy()
    if task_info.get("status") == "running":
        task_info["message"] = "爬虫任务进行中"
    elif task_info.get("status") == "completed":
        task_info["message"] = "爬虫任务已完成"
    elif task_info.get("status") == "failed":
        task_info["message"] = f"爬虫任务失败: {task_info.get('error', '未知错误')}"
    return task_info

@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket连接处理进度推送"""
    await progress_manager.connect_ws(task_id, websocket)
    logger.info(f"新的WebSocket连接: {task_id}")
    
    try:
        # 等待任务存在且初始化完成
        retry_count = 0
        while retry_count < 10:  # 最多等待5秒
            if task_id in crawler_tasks:
                break
            await asyncio.sleep(0.5)
            retry_count += 1

        if task_id not in crawler_tasks:
            logger.warning(f"任务不存在: {task_id}")
            await websocket.send_json({
                "error": "Task not found",
                "status": "failed"
            })
            return

        # 发送初始状态
        await websocket.send_json({
            "current": 0,
            "total": 0,
            "percentage": 0,
            "status": "running"
        })
        
        # 持续监控进度
        while True:
            if task_id not in crawler_tasks:
                break
            
            try:
                task_info = crawler_tasks[task_id]
                current = task_info.get("current", 0)
                total = task_info.get("total", 0)
                status = task_info.get("status", "running")
                
                # 发送进度更新
                message = {
                    "current": current,
                    "total": total,
                    "percentage": int(current * 100 / total) if total > 0 else 0,
                    "status": status
                }
                
                await websocket.send_json(message)
                logger.info(f"发送WebSocket进度消息: {message}")
                
                if status == "completed":
                    logger.info(f"任务完成: {task_id}")
                    await websocket.send_json({
                        "current": total,
                        "total": total,
                        "percentage": 100,
                        "status": "completed"
                    })
                    break
                elif status == "failed":
                    error_msg = task_info.get("error", "未知错误")
                    logger.error(f"任务失败: {task_id}, 错误: {error_msg}")
                    await websocket.send_json({
                        "error": error_msg,
                        "status": "failed"
                    })
                    break
                
                # 减少检查频率,但保持响应性
                await asyncio.sleep(0.3)
            except Exception as e:
                logger.error(f"发送WebSocket消息失败: {e}", exc_info=True)
                break
    except WebSocketDisconnect:
        logger.info(f"WebSocket连接断开: {task_id}")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
    finally:
        progress_manager.disconnect_ws(task_id)

async def sse_event_generator(request: Request, task_id: str) -> AsyncIterator[str]:
    """SSE事件生成器"""
    queue = await progress_manager.add_sse_client(task_id)
    
    # 发送初始消息
    initial_message = {
        "current": 0,
        "total": 0,
        "percentage": 0,
        "status": "running"
    }
    
    if task_id in crawler_tasks:
        task_info = crawler_tasks[task_id]
        initial_message.update({
            "current": task_info.get("current", 0),
            "total": task_info.get("total", 0),
            "percentage": task_info.get("progress", 0),
            "status": task_info.get("status", "running")
        })
    
    await queue.put(f"data: {json.dumps(initial_message)}\n\n")
    
    try:
        # 监听队列消息
        while True:
            # 检查客户端是否断开连接
            if await request.is_disconnected():
                break
                
            try:
                # 使用超时,避免无限阻塞
                message = await asyncio.wait_for(queue.get(), timeout=1.0)
                yield message
            except asyncio.TimeoutError:
                # 发送心跳消息,保持连接
                yield ": heartbeat\n\n"
    finally:
        await progress_manager.remove_sse_client(task_id, queue)

@router.get("/sse/{task_id}")
async def sse_endpoint(request: Request, task_id: str):
    """SSE端点,用于发送爬虫进度更新"""
    logger.info(f"新的SSE连接请求: {task_id}")
    
    if task_id not in crawler_tasks:
        # 等待任务初始化
        retry_count = 0
        while retry_count < 10:  # 最多等待5秒
            await asyncio.sleep(0.5)
            if task_id in crawler_tasks:
                break
            retry_count += 1
        
        if task_id not in crawler_tasks:
            # 如果任务仍不存在,返回错误
            error_message = json.dumps({"error": "Task not found", "status": "failed"})
            return EventSourceResponse(
                [f"data: {error_message}\n\n"],
                media_type="text/event-stream"
            )
    
    return EventSourceResponse(
        sse_event_generator(request, task_id),
        media_type="text/event-stream"
    )
