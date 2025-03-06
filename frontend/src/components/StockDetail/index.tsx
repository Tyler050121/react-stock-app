import React from 'react';
import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import KLineChart from './KLineChart';
import FinancialDataComponent from './FinancialData';
import { useKlineData } from '../../hooks/useKlineData';
import { useFinancialData } from '../../hooks/useFinancialData';

/**
 * 股票详情页主组件
 */
const StockDetail: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  
  // 使用自定义Hook获取K线数据
  const {
    klineData,
    loading: klineLoading,
    refreshing,
    resolution,
    isPreMarket,
    showChart,
    handleResolutionChange,
    refreshData
  } = useKlineData({ stockCode: code, initialResolution: "1d" });
  
  // 使用自定义Hook获取财务数据
  const {
    financialData,
    loading: financialLoading
  } = useFinancialData(code);
  
  // AI分析函数
  const showAIAnalysis = () => {
    // 跳转到分析页面
    window.location.href = `/stock/${code}/analysis/select`;
  };
  
  // 加载中显示
  if (klineLoading || financialLoading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* K线图组件 */}
      <KLineChart
        klineData={klineData}
        stockCode={code || ''}
        resolution={resolution}
        refreshing={refreshing}
        showChart={showChart}
        isPreMarket={isPreMarket}
        onRefresh={refreshData}
        onResolutionChange={handleResolutionChange}
        onAIAnalysis={showAIAnalysis}
      />
      
      {/* 财务数据组件 */}
      {financialData && <FinancialDataComponent data={financialData} />}
    </div>
  );
};

export default StockDetail;