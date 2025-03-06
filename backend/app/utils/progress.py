"""
进度更新相关工具函数
"""
import asyncio
import logging
import json
from typing import Dict, List, Optional, Any, Callable

# 配置日志
logger = logging.getLogger(__name__)

class ProgressManager:
    """进度管理器,处理WebSocket和SSE连接的进度更新"""
    
    def __init__(self):
        """初始化进度管理器"""
        # WebSocket连接
        self.ws_connections: Dict[str, Any] = {}
        # SSE连接队列
        self.sse_connections: Dict[str, List[asyncio.Queue]] = {}
    
    async def add_sse_client(self, task_id: str) -> asyncio.Queue:
        """添加一个新的SSE客户端连接"""
        if task_id not in self.sse_connections:
            self.sse_connections[task_id] = []
        
        queue = asyncio.Queue()
        self.sse_connections[task_id].append(queue)
        logger.info(f"SSE客户端已连接: {task_id}, 当前连接数: {len(self.sse_connections[task_id])}")
        return queue
    
    async def remove_sse_client(self, task_id: str, queue: asyncio.Queue):
        """移除一个SSE客户端连接"""
        if task_id in self.sse_connections and queue in self.sse_connections[task_id]:
            self.sse_connections[task_id].remove(queue)
            logger.info(f"SSE客户端已断开: {task_id}, 剩余连接数: {len(self.sse_connections[task_id])}")
            if not self.sse_connections[task_id]:
                del self.sse_connections[task_id]
    
    async def send_sse_progress(self, task_id: str, current: int, total: int, status: str = "running"):
        """向所有SSE客户端发送进度更新"""
        if task_id in self.sse_connections and self.sse_connections[task_id]:
            message = {
                "current": current,
                "total": total,
                "percentage": int(current * 100 / total) if total > 0 else 0,
                "status": status
            }
            data_str = json.dumps(message)
            # 发送到所有连接的客户端
            for queue in self.sse_connections[task_id]:
                await queue.put(f"data: {data_str}\n\n")
            
            logger.info(f"发送SSE进度: {current}/{total}, 状态: {status}, 客户端数量: {len(self.sse_connections[task_id])}")
            
            # 如果是完成状态,发送额外的完成消息
            if status == "completed":
                complete_message = {
                    "current": total,
                    "total": total,
                    "percentage": 100,
                    "status": "completed"
                }
                complete_data_str = json.dumps(complete_message)
                for queue in self.sse_connections[task_id]:
                    await queue.put(f"data: {complete_data_str}\n\n")
    
    async def connect_ws(self, task_id: str, websocket: Any):
        """建立WebSocket连接"""
        await websocket.accept()
        self.ws_connections[task_id] = websocket
        logger.info(f"WebSocket连接已建立: {task_id}")

    def disconnect_ws(self, task_id: str):
        """断开WebSocket连接"""
        self.ws_connections.pop(task_id, None)
        logger.info(f"WebSocket连接已断开: {task_id}")

    async def send_ws_progress(self, task_id: str, current: int, total: int, status: str = "running"):
        """通过WebSocket发送进度更新"""
        if task_id in self.ws_connections:
            websocket = self.ws_connections[task_id]
            try:
                message = {
                    "current": current,
                    "total": total,
                    "percentage": int(current * 100 / total) if total > 0 else 0,
                    "status": status
                }
                await websocket.send_json(message)
                logger.info(f"发送WebSocket进度: {current}/{total}, 状态: {status}")

                # 如果是完成状态,发送额外的完成消息
                if status == "completed":
                    await websocket.send_json({
                        "current": total,
                        "total": total,
                        "percentage": 100,
                        "status": "completed"
                    })
            except Exception as e:
                logger.error(f"发送WebSocket进度失败: {e}")
                self.disconnect_ws(task_id)
                raise

# 创建全局进度管理器实例
progress_manager = ProgressManager()
