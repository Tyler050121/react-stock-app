"""
爬虫基础模块
"""
import logging
import aiohttp
import asyncio
from typing import Dict, Any, Optional, Callable

# 配置日志
logger = logging.getLogger(__name__)

class BaseCrawler:
    """爬虫基类"""
    
    def __init__(self, timeout: int = 30):
        """初始化爬虫
        
        Args:
            timeout: 请求超时时间(秒)
        """
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
        }
        self.timeout = aiohttp.ClientTimeout(total=timeout)
    
    async def make_request(self, session, url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None):
        """通用请求方法
        
        Args:
            session: aiohttp客户端会话
            url: 请求URL
            params: 请求参数
            headers: 请求头
        
        Returns:
            请求结果,通常是JSON数据,失败则返回None
        """
        try:
            _headers = {**self.headers, **(headers or {})}
            async with session.get(url, params=params, headers=_headers, timeout=self.timeout) as response:
                if response.status != 200:
                    logger.error(f"请求失败: {url}, 状态码: {response.status}")
                    return None
                return await response.json()
        except asyncio.TimeoutError:
            logger.error(f"请求超时: {url}")
            return None
        except Exception as e:
            logger.error(f"请求异常: {url}, 错误: {str(e)}")
            return None
