import React, { useRef } from 'react';
import { Card, Space, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { CSSTransition } from 'react-transition-group';
import { KLineData, getKlineOption } from '../../utils/klineUtils';

interface KLineChartProps {
  klineData: KLineData[];
  stockCode: string;
  resolution: string;
  refreshing: boolean;
  showChart: boolean;
  isPreMarket: boolean;
  onRefresh: () => void;
  onResolutionChange: (resolution: string) => void;
  onAIAnalysis: () => void;
}

/**
 * K线图组件
 */
const KLineChart: React.FC<KLineChartProps> = ({
  klineData,
  stockCode,
  resolution,
  refreshing,
  showChart,
  isPreMarket,
  onRefresh,
  onResolutionChange,
  onAIAnalysis
}) => {
  const nodeRef = useRef(null);

  return (
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
              onClick={onRefresh}
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
                onClick={() => onResolutionChange('1d')}
                disabled={refreshing}
              >
                日K线
              </Button>
              <Button
                type={resolution === '1m' ? 'primary' : 'default'}
                onClick={() => onResolutionChange('1m')}
                disabled={refreshing}
              >
                1分钟
              </Button>
              <Button
                type={resolution === '5m' ? 'primary' : 'default'}
                onClick={() => onResolutionChange('5m')}
                disabled={refreshing}
              >
                5分钟
              </Button>
              <Button
                type={resolution === '15m' ? 'primary' : 'default'}
                onClick={() => onResolutionChange('15m')}
                disabled={refreshing}
              >
                15分钟
              </Button>
            </Button.Group>
            <Button 
              type="primary" 
              onClick={onAIAnalysis}
              disabled={refreshing}
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
            option={getKlineOption(klineData, resolution, stockCode)} 
            style={{ height: '500px' }} 
            notMerge={true}
          />
        </div>
      </CSSTransition>
      
      {/* 添加CSS样式 */}
      <style>{`
        .chart-fade-enter {
          opacity: 0;
        }
        .chart-fade-enter-active {
          opacity: 1;
          transition: opacity 150ms;
        }
        .chart-fade-exit {
          opacity: 1;
        }
        .chart-fade-exit-active {
          opacity: 0;
          transition: opacity 150ms;
        }
      `}</style>
    </Card>
  );
};

export default KLineChart;