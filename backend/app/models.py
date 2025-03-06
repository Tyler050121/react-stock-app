from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Stock(Base):
    __tablename__ = "stocks"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)  # 股票代码
    name = Column(String)  # 股票名称
    market = Column(String)  # 市场(上证/深证)
    updated_at = Column(DateTime)  # 最后更新时间

class KLineData(Base):
    __tablename__ = "kline_data"
    
    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    date = Column(DateTime, index=True)  # 日期时间,精确到分钟
    resolution = Column(String, default="1d", index=True)  # 时间粒度: 1m(1分钟), 1d(日线)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    turnover = Column(Float)  # 成交额

class FinancialData(Base):
    __tablename__ = "financial_data"
    
    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    date = Column(DateTime, index=True)
    pe_ratio = Column(Float)  # 市盈率
    pb_ratio = Column(Float)  # 市净率
    total_market_value = Column(Float)  # 总市值
    circulating_market_value = Column(Float)  # 流通市值
    revenue = Column(Float)  # 营收
    net_profit = Column(Float)  # 净利润
    roe = Column(Float)  # 净资产收益率
