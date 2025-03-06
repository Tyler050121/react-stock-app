"""
API路由模块
"""
from .stocks import router as stocks_router
from .crawler import router as crawler_router
from .analysis import router as analysis_router

__all__ = ["stocks_router", "crawler_router", "analysis_router"]
