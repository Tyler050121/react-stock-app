"""
股票相关API路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import List, Optional, Dict

from ..models import Stock, KLineData, FinancialData
from ..core.database import get_db
from ..services.ai import StockAnalyzer
from ..crawler.stock_crawler import StockCrawler

router = APIRouter()


@router.get("/", response_model=List[dict])
async def get_stocks(db: AsyncSession = Depends(get_db)):
    """获取所有股票基本信息"""
    query = select(Stock)
    result = await db.execute(query)
    stocks = result.scalars().all()
    return [
        {
            "code": stock.code,
            "name": stock.name,
            "market": stock.market,
            "updated_at": stock.updated_at
        } for stock in stocks
    ]


@router.get("/{code}")
async def get_stock_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """根据股票代码从数据库获取单个股票信息"""
    query = select(Stock).where(Stock.code == code)
    result = await db.execute(query)
    stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(status_code=404, detail="股票不存在")

    return {
        "code": stock.code,
        "name": stock.name,
        "market": stock.market,
        "updated_at": stock.updated_at
    }


@router.get("/{code}/kline")
async def get_stock_kline(
    code: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    resolution: str = "1d",  # 新增参数: 1m(分钟) 或 1d(日线)
    preMarket: bool = False,  # 是否获取盘前数据(仅对分钟线有效)
    db: AsyncSession = Depends(get_db)
):
    """获取股票K线数据

    Args:
        code: 股票代码
        start_date: 起始日期
        end_date: 结束日期
        resolution: 时间粒度(1m: 分钟线, 1d: 日线)
    """
    query = select(Stock).where(Stock.code == code)
    result = await db.execute(query)
    stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(status_code=404, detail="股票不存在")

    kline_query = select(KLineData).where(
        KLineData.stock_id == stock.id,
        KLineData.resolution == resolution
    )

    current_time = datetime.now()

    # 处理盘前数据请求
    if resolution == "1m" and preMarket:
        market_open_time = current_time.replace(
            hour=9, minute=30, second=0, microsecond=0)

        if current_time < market_open_time:
            # 获取最近一个交易日的数据
            # 简单处理:获取最近7天内的数据,假设其中至少有一个交易日
            start_datetime = current_time - timedelta(days=7)
            end_datetime = current_time - timedelta(days=1)
            end_datetime = end_datetime.replace(
                hour=15, minute=0, second=0)  # 设置为前一天收盘时间

            kline_query = kline_query.where(
                KLineData.date >= start_datetime,
                KLineData.date <= end_datetime
            )
    else:
        # 常规处理日期过滤
        date_format = "%Y-%m-%d" if resolution == "1d" else "%Y-%m-%d %H:%M"

        if start_date:
            try:
                start_datetime = datetime.strptime(start_date, date_format)
            except ValueError:
                # 尝试用日期格式解析
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            kline_query = kline_query.where(KLineData.date >= start_datetime)

        if end_date:
            try:
                end_datetime = datetime.strptime(end_date, date_format)
            except ValueError:
                # 尝试用日期格式解析
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
                # 分钟数据的情况下,将结束时间设为当天最后一分钟
                if resolution == "1m":
                    end_datetime = end_datetime.replace(
                        hour=23, minute=59, second=59)
            kline_query = kline_query.where(KLineData.date <= end_datetime)

    # 排序: 日K按日期升序,分钟K按时间降序(展示最新的分钟数据)
    if resolution == "1d":
        kline_query = kline_query.order_by(KLineData.date.asc())
    else:
        kline_query = kline_query.order_by(KLineData.date.desc())

    result = await db.execute(kline_query)
    klines = result.scalars().all()

    return [
        {
            "date": kline.date,
            "open": kline.open,
            "high": kline.high,
            "low": kline.low,
            "close": kline.close,
            "volume": kline.volume,
            "turnover": kline.turnover,
            "resolution": kline.resolution
        } for kline in klines
    ]


@router.get("/{code}/refresh")
async def refresh_stock_data(code: str, db: AsyncSession = Depends(get_db)):
    """刷新单支股票数据"""
    query = select(Stock).where(Stock.code == code)
    result = await db.execute(query)
    stock = result.scalar_one_or_none()

    # 创建爬虫实例
    spider = StockCrawler()

    try:
        if not stock:
            # 如果股票不在数据库中,获取股票基本信息
            stocks = await spider.get_stock_list()
            stock_info = None
            for s in stocks:
                if s['code'] == code:
                    stock_info = s
                    break

            if not stock_info:
                raise HTTPException(status_code=404, detail="找不到该股票信息")
        else:
            # 如果股票已存在,使用数据库中的信息
            stock_info = {
                'code': stock.code,
                'name': stock.name,
                'market': stock.market
            }

        # 处理股票数据(获取K线和财务数据)
        await spider.process_stock(stock_info)

        # 更新股票更新时间
        stock.updated_at = datetime.now()
        await db.commit()

        return {"message": "股票数据更新成功"}
    except Exception as e:
        logger.error(f"刷新股票数据失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"刷新股票数据失败: {str(e)}")


@router.get("/{code}/financial")
async def get_stock_financial(code: str, db: AsyncSession = Depends(get_db)):
    """获取股票财务数据"""
    query = select(Stock).where(Stock.code == code)
    result = await db.execute(query)
    stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(status_code=404, detail="股票不存在")

    financial_query = (
        select(FinancialData)
        .where(FinancialData.stock_id == stock.id)
        .order_by(FinancialData.date.desc())
        .limit(1)
    )

    result = await db.execute(financial_query)
    financial = result.scalar_one_or_none()

    if not financial:
        raise HTTPException(status_code=404, detail="没有找到财务数据")

    return {
        "pe_ratio": financial.pe_ratio,
        "pb_ratio": financial.pb_ratio,
        "total_market_value": financial.total_market_value,
        "circulating_market_value": financial.circulating_market_value,
        "revenue": financial.revenue,
        "net_profit": financial.net_profit,
        "roe": financial.roe,
        "date": financial.date
    }
