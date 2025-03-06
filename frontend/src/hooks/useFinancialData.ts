import { useState, useEffect } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { FinancialDataType } from '../components/StockDetail/FinancialData';

/**
 * 自定义Hook用于获取财务数据
 */
export const useFinancialData = (stockCode: string | undefined) => {
  const [financialData, setFinancialData] = useState<FinancialDataType | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFinancialData = async () => {
    if (!stockCode) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:8000/api/stocks/${stockCode}/financial`);
      setFinancialData(response.data);
    } catch (error) {
      message.error('获取财务数据失败');
      console.error('获取财务数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载数据
  useEffect(() => {
    if (stockCode) {
      fetchFinancialData();
    }
  }, [stockCode]);

  return {
    financialData,
    loading,
    fetchFinancialData
  };
};