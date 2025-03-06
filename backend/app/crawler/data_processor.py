"""
爬虫数据处理模块
"""
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import select, delete

from app.core.database import AsyncSessionLocal
from app.models import Stock, KLineData, FinancialData

# 配置日志
logger = logging.getLogger(__name__)

class DataProcessor:
    """爬虫数据处理类"""
    
    @staticmethod
    async def save_to_db(data: Dict[str, Any]):
        """保存数据到数据库
        
        Args:
            data: 股票数据,包含基本信息、K线和财务数据
        """
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(
                    select(Stock).where(Stock.code == data['code'])
                )
                existing_stock = result.scalar_one_or_none()

                if existing_stock:
                    existing_stock.name = data['name']
                    existing_stock.market = data['market']
                    existing_stock.updated_at = datetime.now()
                    stock = existing_stock
                else:
                    stock = Stock(
                        code=data['code'],
                        name=data['name'],
                        market=data['market'],
                        updated_at=datetime.now()
                    )
                    session.add(stock)

                await session.commit()
                await session.refresh(stock)

                if data.get('klines'):
                    delete_stmt = delete(KLineData).where(KLineData.stock_id == stock.id)
                    await session.execute(delete_stmt)
                    klines = [KLineData(stock_id=stock.id, **kline) for kline in data['klines']]
                    session.add_all(klines)

                if data.get('financial'):
                    result = await session.execute(
                        select(FinancialData).where(FinancialData.stock_id == stock.id)
                    )
                    existing_financial = result.scalar_one_or_none()

                    if existing_financial:
                        for key, value in data['financial'].items():
                            setattr(existing_financial, key, value)
                    else:
                        financial = FinancialData(stock_id=stock.id, **data['financial'])
                        session.add(financial)

                await session.commit()
                logger.info(f"已保存股票数据: {data['code']}")
                return True
                
            except Exception as e:
                await session.rollback()
                logger.error(f"保存数据失败 {data['code']}: {str(e)}", exc_info=True)
                raise
