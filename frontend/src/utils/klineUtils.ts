/**
 * K线数据接口
 */
export interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

/**
 * 聚合K线数据函数，将1分钟数据聚合为5分钟或15分钟
 * @param data 原始K线数据
 * @param interval 聚合间隔
 * @returns 聚合后的K线数据
 */
export const aggregateKlineData = (data: KLineData[], interval: number): KLineData[] => {
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

/**
 * 创建ECharts K线图配置
 * @param klineData K线数据
 * @param resolution 时间粒度
 * @param stockCode 股票代码
 * @returns ECharts配置对象
 */
export const getKlineOption = (klineData: KLineData[], resolution: string, stockCode: string) => {
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
    title: { text: `${stockCode} K线图` },
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
            // 只显示时间部分，不显示日期
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