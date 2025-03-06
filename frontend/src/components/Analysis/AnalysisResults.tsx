import React from 'react';
import { Card, Timeline, Typography, Space } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { AnalysisResult } from '../../hooks/useStockAnalysis';
import { getActorIcon } from './AnalysisConfig';

const { Title, Text } = Typography;

interface AnalysisResultsProps {
  results: AnalysisResult[];
}

/**
 * 分析结果组件
 */
const AnalysisResults: React.FC<AnalysisResultsProps> = ({ results }) => {
  // 如果没有结果，不显示组件
  if (results.length === 0) {
    return null;
  }

  return (
    <Card 
      title={<Title level={4}>分析结果</Title>} 
      bordered={false}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
    >
      <Timeline>
        {results.map((result, index) => (
          <Timeline.Item
            key={index}
            dot={result.type === 'conclusion' ? <ExperimentOutlined style={{ fontSize: '16px' }} /> : getActorIcon(result.actor)}
            color={result.type === 'conclusion' ? 'blue' : 'green'}
          >
            <Card 
              title={
                <Space>
                  <span>{result.actor}</span>
                  {result.stats && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      (使用模型: {result.stats.model})
                    </Text>
                  )}
                </Space>
              }
              size="small" 
              style={{ marginBottom: 16 }}
              bordered
            >
              <ReactMarkdown>{result.content}</ReactMarkdown>
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
};

export default AnalysisResults;