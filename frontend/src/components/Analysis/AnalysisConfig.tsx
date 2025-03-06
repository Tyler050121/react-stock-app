import React from 'react';
import { Card, Row, Col, Space, Select, Button, Typography } from 'antd';
import { ExperimentOutlined, LineChartOutlined, RobotOutlined, FundOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';

const { Text, Title } = Typography;

export interface ActorConfig {
  actor: string;
  model: string;
}

interface AnalysisConfigProps {
  stockInfo: { code: string; name: string };
  modelOptions: SelectProps['options'];
  actorOptions: SelectProps['options'];
  selectedActors: [string, string, string]; // [actor1, actor2, actor3]
  selectedModels: [string, string, string]; // [model1, model2, model3]
  conclusionModel: string;
  loadingOptions: boolean;
  analyzing: boolean;
  onActorChange: (index: number, value: string) => void;
  onModelChange: (index: number, value: string) => void;
  onConclusionModelChange: (value: string) => void;
  onStartAnalysis: () => void;
}

/**
 * 获取角色图标
 */
export const getActorIcon = (actorName: string) => {
  if (actorName === '宏观策划师') return <LineChartOutlined />;
  if (actorName === '技术操盘手') return <RobotOutlined />;
  if (actorName === '风险管理师') return <FundOutlined />;
  return <ExperimentOutlined />;
};

/**
 * 分析配置组件
 */
const AnalysisConfig: React.FC<AnalysisConfigProps> = ({
  stockInfo,
  modelOptions,
  actorOptions,
  selectedActors,
  selectedModels,
  conclusionModel,
  loadingOptions,
  analyzing,
  onActorChange,
  onModelChange,
  onConclusionModelChange,
  onStartAnalysis
}) => {
  // 检查是否有有效的选择
  const hasValidSelection = selectedActors.some((actor, index) => actor && selectedModels[index]);

  return (
    <Card 
      title={<Title level={4}>分析配置</Title>} 
      bordered={false}
      style={{ marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
    >
      <Row gutter={[24, 24]}>
        {[0, 1, 2].map((index) => (
          <Col span={8} key={index}>
            <Card 
              title={
                <Space>
                  {selectedActors[index] ? getActorIcon(selectedActors[index]) : <ExperimentOutlined />}
                  <span>角色 {index + 1}</span>
                </Space>
              } 
              bordered={false}
              style={{ background: '#f9f9f9' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>角色:</Text>
                  <Select
                    loading={loadingOptions}
                    value={selectedActors[index]}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => onActorChange(index, value)}
                    options={actorOptions}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <Text strong>模型:</Text>
                  <Select
                    loading={loadingOptions}
                    value={selectedModels[index]}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => onModelChange(index, value)}
                    options={modelOptions}
                  />
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      
      {/* 综合结论模型选择 */}
      <div style={{ marginTop: 24 }}>
        <Card 
          title={
            <Space>
              <ExperimentOutlined />
              <span>综合结论模型</span>
            </Space>
          } 
          bordered={false}
          style={{ background: '#f0f7ff' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>选择用于生成综合结论的AI模型：</Text>
            <Select
              loading={loadingOptions}
              value={conclusionModel}
              style={{ width: '100%', marginTop: 8 }}
              onChange={onConclusionModelChange}
              options={modelOptions}
              placeholder="默认使用第一个角色的模型"
              allowClear
            />
          </Space>
        </Card>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Button 
          type="primary" 
          size="large"
          icon={<ExperimentOutlined />}
          onClick={onStartAnalysis}
          loading={analyzing}
          style={{ minWidth: 150 }}
          disabled={!stockInfo.code || !hasValidSelection}
        >
          {analyzing ? '分析中...' : '开始分析'}
        </Button>
      </div>
    </Card>
  );
};

export default AnalysisConfig;