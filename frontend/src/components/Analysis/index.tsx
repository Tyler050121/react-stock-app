import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { message, Spin, Typography, Space } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import axios from 'axios';
import AnalysisConfig from './AnalysisConfig';
import ChatMessages from './ChatMessages';
import AnalysisResults from './AnalysisResults';
import { useStockAnalysis, AnalysisActor } from '../../hooks/useStockAnalysis';
import { useModelsAndRoles } from '../../hooks/useModelsAndRoles';

const { Title, Text } = Typography;

interface AnalysisPageProps {
  stock?: {
    code: string;
    name: string;
  };
}

/**
 * 分析页面主组件
 */
const AnalysisPage: React.FC<AnalysisPageProps> = () => {
  const { code } = useParams<{ code: string }>();
  const [stock, setStock] = useState<{ code: string; name: string; }>({ code: '', name: '' });
  const [loading, setLoading] = useState<boolean>(true);
  
  // 使用自定义Hook获取模型和角色
  const {
    modelOptions,
    actorOptions,
    loadingOptions,
    selectedActors,
    selectedModels,
    conclusionModel,
    setConclusionModel,
    handleActorChange,
    handleModelChange
  } = useModelsAndRoles();
  
  // 使用自定义Hook处理分析
  const {
    analysisResults,
    chatMessages,
    analysisStatus,
    analyzing,
    startAnalysis
  } = useStockAnalysis(code);

  // 获取股票信息
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:8000/api/stocks/${code}`);
        if (response.data && response.data.code) {
          setStock(response.data);
          console.log('获取到股票信息:', response.data);
        } else {
          // 如果API没有返回有效数据，使用URL中的code
          setStock({ code: code || '', name: '未知股票' });
          console.log('API未返回有效数据，使用URL中的code:', code);
        }
      } catch (error) {
        message.error('获取股票信息失败');
        console.error('获取股票信息失败:', error);
        // 出错时也使用URL中的code
        setStock({ code: code || '', name: '未知股票' });
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchStockData();
    } else {
      console.log('没有获取到code参数');
      setLoading(false);
    }
  }, [code]);

  // 开始分析处理函数
  const handleStartAnalysis = () => {
    // 准备选中的角色和模型
    const selectedActorsWithModels: AnalysisActor[] = [
      { actor: selectedActors[0], model: selectedModels[0] },
      { actor: selectedActors[1], model: selectedModels[1] },
      { actor: selectedActors[2], model: selectedModels[2] },
    ].filter(item => item.actor && item.model); // 同时过滤掉没有选择角色或模型的项

    // 如果选择了综合结论模型，添加到请求中
    if (conclusionModel) {
      selectedActorsWithModels.push({
        actor: "conclusion_model",
        model: conclusionModel
      });
    }

    // 检查是否有有效的选择
    if (selectedActorsWithModels.length === 0) {
      message.error('请至少选择一个角色和对应的模型');
      return;
    }

    // 开始分析
    startAnalysis(selectedActorsWithModels, stock);
  };

  // 加载中显示
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载股票信息中..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>
          <Space>
            <ExperimentOutlined />
            {`${stock.name} (${stock.code}) AI智能分析`}
          </Space>
        </Title>
        <Text type="secondary">选择分析角色和模型，获取专业的股票分析报告</Text>
      </div>

      {/* 分析配置组件 */}
      <AnalysisConfig
        stockInfo={stock}
        modelOptions={modelOptions}
        actorOptions={actorOptions}
        selectedActors={selectedActors}
        selectedModels={selectedModels}
        conclusionModel={conclusionModel}
        loadingOptions={loadingOptions}
        analyzing={analyzing}
        onActorChange={handleActorChange}
        onModelChange={handleModelChange}
        onConclusionModelChange={setConclusionModel}
        onStartAnalysis={handleStartAnalysis}
      />

      {/* 聊天消息组件 */}
      <ChatMessages
        messages={chatMessages}
        loading={analysisStatus === 'loading'}
      />

      {/* 分析结果组件 */}
      <AnalysisResults
        results={analysisResults}
      />
    </div>
  );
};

export default AnalysisPage;