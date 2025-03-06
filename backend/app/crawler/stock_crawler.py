"""
股票爬虫模块
"""
import os
import logging
import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from functools import partial

from app.crawler.base import BaseCrawler
from app.crawler.data_processor import DataProcessor

# 配置日志
logger = logging.getLogger(__name__)

class StockCrawler(BaseCrawler):
    """股票数据爬虫类"""
    
    def __init__(self, progress_callback: Optional[Callable] = None):
        """初始化爬虫
        
        Args:
            progress_callback: 进度回调函数
        """
        super().__init__()
        self.progress_callback = progress_callback
        self.total_stocks = 0
        self.processed_stocks = 0
        
    async def update_progress(self, current: int, total: int):
        """更新进度并调用回调函数
        
        Args:
            current: 当前处理数量
            total: 总数量
        """
        if self.progress_callback:
            try:
                logger.info(f"发送进度更新: {current}/{total}")
                await self.progress_callback(current, total)
                await asyncio.sleep(0.1)  # 确保进度更新被接收
            except Exception as e:
                logger.error(f"发送进度失败: {e}")
    
    async def get_stock_list(self, limit: int = 10) -> List[Dict[str, str]]:
        """获取股票列表
        
        Args:
            limit: 要获取的股票数量
        
        Returns:
            股票列表,每个元素包含code、name、market字段
        """
        logger.info(f"开始获取股票列表,数量: {limit}...")
        try:
            async with aiohttp.ClientSession() as session:
                url = "http://query.sse.com.cn/security/stock/getStockListData.do"
                params = {
                    'stockType': 1,
                    'pageHelp.beginPage': 1,
                    'pageHelp.pageSize': max(50, limit)  # 确保获取足够数量的股票
                }
                headers = {
                    **self.headers,
                    'Referer': 'http://www.sse.com.cn/'
                }
                
                logger.info(f"请求URL: {url}")
                data = await self.make_request(session, url, params, headers)
                
                if not data:
                    return []
                    
                sh_stocks = [
                    {
                        'code': item['SECURITY_CODE_A'],
                        'name': item['SECURITY_ABBR_A'],
                        'market': 'SH'
                    }
                    for item in data.get('pageHelp', {}).get('data', [])
                ]
                
                logger.info(f"成功获取到 {len(sh_stocks)} 支股票")
                return sh_stocks[:limit]  # 返回指定数量的股票
        except Exception as e:
            logger.error(f"获取股票列表失败: {str(e)}", exc_info=True)
            return []
    
    async def get_kline_data(self, stock_code: str, market: str, resolution: str = "1d") -> List[Dict[str, Any]]:
        """获取K线数据
        
        Args:
            stock_code: 股票代码
            market: 市场标识(SH/SZ)
            resolution: 时间粒度, 1m:1分钟, 1d:日线
            
        Returns:
            K线数据列表
        """
        logger.info(f"获取K线数据: {stock_code}, 时间粒度: {resolution}")
        try:
            async with aiohttp.ClientSession() as session:
                current_date = datetime.now()
                end_date = current_date.strftime("%Y%m%d")
                
                # 根据分辨率决定起始日期
                if resolution == "1m":
                    # 1分钟数据只获取最近3天
                    start_date = (current_date - timedelta(days=3)).strftime("%Y%m%d")
                else:
                    # 日线数据获取年初至今
                    start_date = f"{current_date.year}0101"
                
                url = "http://push2his.eastmoney.com/api/qt/stock/kline/get"
                params = {
                    'secid': f"{1 if market == 'SH' else 0}.{stock_code}",
                    'fields1': 'f1,f2,f3,f4,f5,f6,f7,f8',
                    'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58',
                    'klt': '1' if resolution == "1m" else '101',  # 1:1分钟, 101:日线
                    'fqt': '1',
                    'beg': start_date,
                    'end': end_date,
                }
                
                data = await self.make_request(session, url, params)
                if not data or 'data' not in data:
                    return []

                klines = []
                for kline in data['data'].get('klines', []):
                    try:
                        date_str, open_price, close, high, low, volume, turnover, *_ = kline.split(',')
                        
                        # 根据分辨率解析不同格式的日期
                        if resolution == "1m":
                            date_obj = datetime.strptime(date_str, '%Y-%m-%d %H:%M')
                        else:
                            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                            
                        klines.append({
                            'date': date_obj,
                            'resolution': resolution,
                            'open': float(open_price),
                            'close': float(close),
                            'high': float(high),
                            'low': float(low),
                            'volume': float(volume),
                            'turnover': float(turnover)
                        })
                    except (ValueError, IndexError) as e:
                        logger.warning(f"解析K线数据失败: {kline}, 错误: {str(e)}")
                        continue

                return klines
        except Exception as e:
            logger.error(f"获取K线数据失败 {stock_code}: {str(e)}", exc_info=True)
            return []
    
    async def get_financial_data(self, stock_code: str, market: str = 'SH') -> Optional[Dict[str, Any]]:
        """获取财务数据
        
        Args:
            stock_code: 股票代码
            market: 市场标识(SH/SZ)
            
        Returns:
            财务数据字典
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = "http://push2.eastmoney.com/api/qt/stock/get"
                params = {
                    'secid': f"{1 if market == 'SH' else 0}.{stock_code}",
                    'fields': 'f57,f58,f162,f167,f183,f184,f185'
                }
                
                data = await self.make_request(session, url, params)
                if not data or 'data' not in data:
                    return None

                return {
                    'pe_ratio': float(data['data'].get('f162', 0)),
                    'pb_ratio': float(data['data'].get('f167', 0)),
                    'total_market_value': float(data['data'].get('f183', 0)),
                    'circulating_market_value': float(data['data'].get('f184', 0)),
                    'revenue': 0,
                    'net_profit': 0,
                    'roe': 0,
                    'date': datetime.now()
                }
        except Exception as e:
            logger.error(f"获取财务数据失败 {stock_code}: {str(e)}", exc_info=True)
            return None
    
    async def process_stock(self, stock: Dict[str, str], resolution: Optional[str] = None):
        """处理单个股票数据
        
        Args:
            stock: 股票信息字典
            resolution: 时间粒度,None表示同时获取日线和分钟线
        """
        try:
            logger.info(f"开始处理股票: {stock['code']}, 分辨率: {resolution or '全部'}")
            
            klines = []
            
            # 根据resolution决定获取哪种数据
            if resolution is None or resolution == "1d":
                daily_klines = await self.get_kline_data(stock['code'], stock['market'], resolution="1d")
                logger.info(f"获取到 {len(daily_klines)} 条日K线数据: {stock['code']}")
                klines.extend(daily_klines)
                
            if resolution is None or resolution == "1m":
                minute_klines = await self.get_kline_data(stock['code'], stock['market'], resolution="1m")
                logger.info(f"获取到 {len(minute_klines)} 条分钟K线数据: {stock['code']}")
                klines.extend(minute_klines)
            
            # 获取财务数据
            financial = await self.get_financial_data(stock['code'], stock['market'])
            if not financial:
                logger.warning(f"未获取到财务数据: {stock['code']}")
            
            # 组装数据
            stock_data = {
                **stock,
                'klines': klines,
                'financial': financial
            }
            
            # 保存数据
            await DataProcessor.save_to_db(stock_data)
            
            # 更新进度
            self.processed_stocks += 1
            await self.update_progress(self.processed_stocks, self.total_stocks)
            
        except Exception as e:
            logger.error(f"处理股票失败 {stock['code']}: {str(e)}", exc_info=True)
    
    async def run(self, stock_count: int = 10, resolution: Optional[str] = None):
        """运行爬虫
        
        Args:
            stock_count: 要爬取的股票数量
            resolution: 时间粒度,1m(分钟线)或1d(日线),None表示两种都爬取
        """
        logger.info(f"爬虫开始运行... 股票数量:{stock_count}, 时间粒度:{resolution or '全部'}")
        try:
            # 获取指定数量的股票
            stocks = await self.get_stock_list(limit=stock_count)
            self.total_stocks = len(stocks)
            self.processed_stocks = 0
            
            # 发送初始进度
            await self.update_progress(0, self.total_stocks)
            await asyncio.sleep(1)  # 等待初始进度发送完成
            
            # 处理每个股票
            for stock in stocks:
                await self.process_stock(stock, resolution)
                await asyncio.sleep(1)  # 控制请求频率
            
            # 发送最终进度
            await self.update_progress(self.total_stocks, self.total_stocks)
            logger.info("爬虫运行完成")
            
        except Exception as e:
            logger.error(f"爬虫运行失败: {str(e)}", exc_info=True)
            raise
