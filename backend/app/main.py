"""
主应用模块
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging

from .core.database import init_db
from .core.config import config
from .routers import stocks_router, crawler_router, analysis_router

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="股票数据API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加路由
app.include_router(stocks_router, prefix="/api/stocks", tags=["stocks"])
app.include_router(crawler_router, prefix="/api/crawler", tags=["crawler"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])

@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("正在初始化数据库...")
    await init_db()
    logger.info("数据库初始化完成")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
