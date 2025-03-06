import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { KLineData, aggregateKlineData } from '../utils/klineUtils';

interface UseKlineDataProps {
  stockCode: string | undefined;
  initialResolution: string;
}

/**
 * 自定义Hook用于获取和处理K线数据
 */
export const useKlineData = ({ stockCode, initialResolution }: UseKlineDataProps) => {
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolution, setResolution] = useState<string>(initialResolution);
  const [isPreMarket, setIsPreMarket] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const currentRequest = useRef<AbortController | null>(null);

  // 检查是否为盘前时间
  useEffect(() => {
    // 检查是否为盘前时间(9:30前)
    const now = new Date();
    const marketOpenHour = 9;
    const marketOpenMinute = 30;
    setIsPreMarket(
      now.getHours() < marketOpenHour || 
      (now.getHours() === marketOpenHour && now.getMinutes() < marketOpenMinute)
    );
  }, []);

  // 获取K线数据
  const fetchKlineData = async (currentResolution: string) => {
    if (!stockCode) return;
    
    // 创建新的AbortController
    currentRequest.current = new AbortController();
    
    try {
      // 构建请求参数
      const params: any = {};
      
      // 根据是否为分钟线设置参数
      if (currentResolution.includes('m')) {
        params.resolution = '1m';
        
        // 如果是盘前时间，添加特殊参数获取前一交易日数据
        if (isPreMarket) {
          params.preMarket = true;
        }
      } else {
        params.resolution = currentResolution;
      }
      
      const response = await axios.get(`http://localhost:8000/api/stocks/${stockCode}/kline`, {
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
        // 如果分钟级数据为空，但选择了分钟粒度，显示友好提示
        if (currentResolution.includes('m')) {
          // 如果是盘前时间，显示特殊提示
          if (isPreMarket) {
            message.info('盘前时段，显示前一交易日分钟数据');
          } else {
            message.info('暂无分钟级数据，请先更新数据或选择日K线');
            // 自动切换回日K线
            setResolution('1d');
            // 重新获取日K线数据
            const dailyResponse = await axios.get(`http://localhost:8000/api/stocks/${stockCode}/kline`, {
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
    if (refreshing || !stockCode) return;
    
    try {
      setRefreshing(true);
      message.loading({ content: '正在刷新数据...', key: 'refreshing' });
      
      // 调用后端API刷新此股票数据
      await axios.get(`http://localhost:8000/api/stocks/${stockCode}/refresh`);
      
      // 刷新前端数据
      await fetchKlineData(resolution);
      
      message.success({ content: '数据刷新成功', key: 'refreshing' });
    } catch (error) {
      message.error({ content: '数据刷新失败', key: 'refreshing' });
      console.error('刷新数据失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 初始加载数据
  useEffect(() => {
    if (stockCode) {
      setLoading(true);
      fetchKlineData(resolution).finally(() => setLoading(false));
    }
    
    // 清理函数
    return () => {
      if (currentRequest.current) {
        currentRequest.current.abort();
      }
    };
  }, [stockCode]);

  return {
    klineData,
    loading,
    refreshing,
    resolution,
    isPreMarket,
    showChart,
    handleResolutionChange,
    refreshData
  };
};