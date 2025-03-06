import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Statistic, Spin, message, Space, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { CSSTransition } from 'react-transition-group';

interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

interface FinancialData {
  pe_ratio: number;
  pb_ratio: number;
  total_market_value: number;
  circulating_market_value: number;
  revenue: number;
  net_profit: number;
  roe: number;
  date: string;
}

const StockDetail: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolution, setResolution] = useState<string>("1d"); // 默认日K线
  const [isPreMarket, setIsPreMarket] = useState(false); // 是否为盘前时间
  const [showChart, setShowChart] = useState(true);
  const nodeRef = React.useRef(null);
  const currentRequest = React.useRef<AbortController | null>(null);

  useEffect(() => {
    if (code) {
      // 检查是否为盘前时间(9:30前)
      const now = new Date();
      const marketOpenHour = 9;
      const marketOpenMinute = 30;
      setIsPreMarket(
        now.getHours() < marketOpenHour || 
        (now.getHours() === marketOpenHour && now.getMinutes() < marketOpenMinute)
      );

      fetchInitialData();
    }
    
    // 清理函数
    return () => {
      if (currentRequest.current) {
        currentRequest.current.abort();
      }
    };
  }, [code]); // 仅在code变化时获取数据

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchKlineData(resolution),
        fetchFinancialData()
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 时间粒度变化处理函数
  const handleResolutionChange = async (value: string) => {
    if (value === resolution || loading) {
      return; // 如果点击相同的分辨率或正在加载，直接返回
    }
    
    setShowChart(false); // 触发淡出动画
    
    // 等待淡出动画完成
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 取消之前的请求
    if (currentRequest.current) {
      currentRequest.current.abort();
    }
    
    setResolution(value);
    setLoading(true);
    
    try {
      await fetchKlineData(value);
    } finally {
      setLoading(false);
      setShowChart(true); // 触发淡入动画
    }
  };

  // 刷新数据函数
  const refreshData = async () => {
    if (refreshing || !code) return;
    
    try {
      setRefreshing(true);
      message.loading({ content: '正在刷新数据...', key: 'refreshing' });
      
      // 调用后端API刷新此股票数据
      await axios.get(`http://localhost:8000/api/stocks/${code}/refresh`);
      
      // 刷新前端数据
      await Promise.all([
        fetchKlineData(resolution),
        fetchFinancialData()
      ]);
      
      message.success({ content: '数据刷新成功', key: 'refreshing' });
    } catch (error) {
      message.error({ content: '数据刷新失败', key: 'refreshing' });
      console.error('刷新数据失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // AI分析函数
  const showAIAnalysis = () => {
    // 跳转到分析页面
    window.location.href = `/stock/${code}/analysis/select`;
  };
  
  // 聚合K线数据函数,将1分钟数据聚合为5分钟或15分钟
  const aggregateKlineData = (data: KLineData[], interval: number): KLineData[] => {
    if (!data?.length || interval <= 1) return data;
    
    // 确保数据按时间正确排序
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const result: KLineData[] = [];
    for (let i = 0; i < sortedData.length; i += interval) {
      const chunk = sortedData.slice(i, i + interval);
      if (chunk.length === 0) continue;
      
      const aggregated: KLineData = {
        date: chunk[0].date,  // 使用区间第一个时间点
        open: chunk[0].open,  // 开盘价取第一个
        close: chunk[chunk.length - 1].close, // 收盘价取最后一个
        high: Math.max(...chunk.map(item => item.high)),
        low: Math.min(...chunk.map(item => item.low)),
        volume: chunk.reduce((sum, item) => sum + item.volume, 0),
        turnover: chunk.reduce((sum, item) => sum + item.turnover, 0)
      };
      
      result.push(aggregated);
    }
    
    return result;
  };

  const fetchKlineData = async (currentResolution: string) => {
    // 创建新的AbortController
    currentRequest.current = new AbortController();
    
    try {
      // 构建请求参数
      const params: any = {};
      
      // 根据是否为分钟线设置参数
      if (currentResolution.includes('m')) {
        params.resolution = '1m';
        
        // 如果是盘前时间,添加特殊参数获取前一交易日数据
        if (isPreMarket) {
          params.preMarket = true;
        }
      } else {
        params.resolution = currentResolution;
      }
      
      const response = await axios.get(`http://localhost:8000/api/stocks/${code}/kline`, {
        params,
        signal: currentRequest.current.signal
      });
      
      let data = response.data;
      
      // 验证数据
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format');
      }
      
      // 检查是否有数据
      if (!data || data.length === 0) {
        // 如果分钟级数据为空,但选择了分钟粒度,显示友好提示
        if (currentResolution.includes('m')) {
          // 如果是盘前时间,显示特殊提示
          if (isPreMarket) {
            message.info('盘前时段,显示前一交易日分钟数据');
          } else {
            message.info('暂无分钟级数据,请先更新数据或选择日K线');
            // 自动切换回日K线
            setResolution('1d');
            // 重新获取日K线数据
            const dailyResponse = await axios.get(`http://localhost:8000/api/stocks/${code}/kline`, {
              params: { resolution: '1d' }
            });
            if (Array.isArray(dailyResponse.data)) {
              setKlineData(dailyResponse.data);
            }
            return;
          }
        }
      } else {
        // 根据选择的时间粒度聚合数据
        if (currentResolution === '5m') {
          data = aggregateKlineData(data, 5);
        } else if (currentResolution === '15m') {
          data = aggregateKlineData(data, 15);
        }
      }
      
      // 最终验证数据是否为数组
      if (Array.isArray(data)) {
        setKlineData(data);
      } else {
        throw new Error('Invalid data format after processing');
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request canceled');
      } else {
        message.error('获取K线数据失败');
        console.error('获取K线数据失败:', error);
      }
    }
  };

  const fetchFinancialData = async () => {
    try {
      const response = await axios.get(`http://localhost:8000/api/stocks/${code}/financial`);
      setFinancialData(response.data);
    } catch (error) {
      message.error('获取财务数据失败');
      console.error('获取财务数据失败:', error);
    }
  };

  const getKlineOption = () => {
    const sortedData = [...klineData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const data = sortedData.map(item => [
      item.date,
      item.open,
      item.close,
      item.low,
      item.high,
      item.volume
    ]);

    return {
      title: { text: `${code} K线图` },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['K线', '成交量']
      },
      grid: [
        {
          left: '10%',
          right: '8%',
          height: '50%'
        },
        {
          left: '10%',
          right: '8%',
          top: '65%',
          height: '25%'
        }
      ],
      xAxis: [
        {
          type: 'category',
          data: sortedData.map(item => item.date),
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          splitNumber: 20,
          inverse: false,
          axisLabel: {
            formatter: function (value: string) {
              // 只显示时间部分,不显示日期
              if (resolution.includes('m')) {
                const time = value.split(' ')[1]; // 假设日期格式为"YYYY-MM-DD HH:MM:SS"
                return time ? time.substring(0, 5) : value; // 只取HH:MM
              }
              return value;
            }
          }
        },
        {
          type: 'category',
          gridIndex: 1,
          data: sortedData.map(item => item.date),
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          splitNumber: 20,
          inverse: resolution !== '1d' // 与K线图保持一致，除了日K线都反转
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: {
            show: true
          }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 50,
          end: 100
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: '85%',
          start: 50,
          end: 100
        }
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: data.map(item => item.slice(1, 5)),
          itemStyle: {
            color: '#ec0000',
            color0: '#00da3c',
            borderColor: '#ec0000',
            borderColor0: '#00da3c'
          }
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: data.map(item => item[5])
        }
      ]
    };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>行情走势</span>
                  <ReloadOutlined 
                    spin={refreshing}
                    style={{ 
                      marginLeft: '10px', 
                      cursor: 'pointer', 
                      color: '#1890ff',
                      fontSize: '16px'
                    }} 
                    onClick={refreshData}
                    title="刷新数据"
                  />
                </div>
                <Space>
                  {isPreMarket && resolution.includes('m') && (
                    <span style={{ color: '#ff9800', fontSize: '12px' }}>
                      (盘前数据)
                    </span>
                  )}
                  <Button.Group>
                    <Button
                      type={resolution === '1d' ? 'primary' : 'default'}
                      onClick={() => handleResolutionChange('1d')}
                      disabled={loading}
                    >
                      日K线
                    </Button>
                    <Button
                      type={resolution === '1m' ? 'primary' : 'default'}
                      onClick={() => handleResolutionChange('1m')}
                      disabled={loading}
                    >
                      1分钟
                    </Button>
                    <Button
                      type={resolution === '5m' ? 'primary' : 'default'}
                      onClick={() => handleResolutionChange('5m')}
                      disabled={loading}
                    >
                      5分钟
                    </Button>
                    <Button
                      type={resolution === '15m' ? 'primary' : 'default'}
                      onClick={() => handleResolutionChange('15m')}
                      disabled={loading}
                    >
                      15分钟
                    </Button>
                  </Button.Group>
                  <Button 
                    type="primary" 
                    onClick={showAIAnalysis}
                    disabled={loading}
                  >
                    AI分析
                  </Button>
                </Space>
              </div>
            }
          >
            <CSSTransition
              nodeRef={nodeRef}
              in={showChart}
              timeout={150}
              classNames="chart-fade"
              unmountOnExit
            >
              <div ref={nodeRef} className="chart-container">
                <ReactECharts 
                  option={getKlineOption()} 
                  style={{ height: '500px' }} 
                  notMerge={true}
                />
              </div>
            </CSSTransition>
          </Card>
        </Col>
      </Row>
      
      {financialData && (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col span={24}>
            <Card title="基本面数据">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="市盈率" value={financialData.pe_ratio} precision={2} />
                </Col>
                <Col span={6}>
                  <Statistic title="市净率" value={financialData.pb_ratio} precision={2} />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="总市值" 
                    value={financialData.total_market_value / 100000000} 
                    precision={2}
                    suffix="亿"
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="ROE" 
                    value={financialData.roe} 
                    precision={2}
                    suffix="%"
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default StockDetail;
