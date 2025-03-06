import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';

export interface FinancialDataType {
  pe_ratio: number;
  pb_ratio: number;
  total_market_value: number;
  circulating_market_value: number;
  revenue: number;
  net_profit: number;
  roe: number;
  date: string;
}

interface FinancialDataProps {
  data: FinancialDataType;
}

/**
 * 财务数据展示组件
 */
const FinancialDataComponent: React.FC<FinancialDataProps> = ({ data }) => {
  return (
    <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
      <Col span={24}>
        <Card title="基本面数据">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="市盈率" value={data.pe_ratio} precision={2} />
            </Col>
            <Col span={6}>
              <Statistic title="市净率" value={data.pb_ratio} precision={2} />
            </Col>
            <Col span={6}>
              <Statistic 
                title="总市值" 
                value={data.total_market_value / 100000000} 
                precision={2}
                suffix="亿"
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="ROE" 
                value={data.roe} 
                precision={2}
                suffix="%"
              />
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default FinancialDataComponent;