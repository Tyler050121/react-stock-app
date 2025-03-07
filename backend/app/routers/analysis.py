import json
import logging
from fastapi import APIRouter, Request, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.database import get_db
from ..models import Stock, KLineData
from ..services.ai import StockAnalyzer, get_available_models_and_roles

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/models")
async def get_models():
    """获取可用的AI模型和角色列表"""
    try:
        models_and_roles = await get_available_models_and_roles()
        return models_and_roles
    except Exception as e:
        logger.error(f"获取模型列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")


@router.api_route("/{code}", methods=["GET", "POST"])
async def analyze_stock(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """分析股票,流式返回结果。支持POST和GET请求。
    POST: 从请求体中获取actors参数
    GET: 从查询参数中获取actors参数(用于SSE连接)
    """
    try:
        actors = None
        # 如果是GET请求,从查询参数中解析actors数据
        if request.method == "GET":
            actors_str = request.query_params.get("actors")
            if not actors_str:
                raise HTTPException(status_code=400, detail="缺少actors参数")
            try:
                actors = json.loads(actors_str)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="actors参数格式错误")
        # 如果是POST请求,从请求体中获取actors参数
        else:
            body = await request.json()
            actors = body.get("actors")
            if not actors:
                raise HTTPException(status_code=400, detail="缺少actors参数")

        # 1. 获取股票基本信息
        query = select(Stock).where(Stock.code == code)
        result = await db.execute(query)
        stock = result.scalar_one_or_none()

        if not stock:
            raise HTTPException(status_code=404, detail="股票不存在")
        
        logger.info(f"已查询到股票信息,即将开始分析股票: {code}")

        # 2. 获取K线数据(用于技术分析)
        kline_query = (
            select(KLineData)
            .where(KLineData.stock_id == stock.id)
            .where(KLineData.resolution == "1d")  # 使用日线数据
            .order_by(KLineData.date.desc())
            .limit(30)  # 最近30天数据
        )
        result = await db.execute(kline_query)
        klines = result.scalars().all()

        # 转换为字典列表
        kline_data = [
            {
                "date": kline.date,
                "open": kline.open,
                "high": kline.high,
                "low": kline.low,
                "close": kline.close,
                "volume": kline.volume,
                "turnover": kline.turnover
            } for kline in klines
        ]

        # 3. 流式返回AI分析结果
        analyzer = StockAnalyzer()
        return EventSourceResponse(
            analyzer.analyze_stock(
                stock_code=stock.code,
                stock_name=stock.name,
                actors=actors,
                kline_data=kline_data
            ),
            media_type="text/event-stream"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"分析股票失败: {e}")
        raise HTTPException(status_code=500, detail=f"分析股票失败: {str(e)}")
