import React, { useState, useEffect, useRef } from 'react';
import { Select, Card, Button, message, Row, Col, Typography, Space, Divider, Spin, Timeline, Avatar } from 'antd';
import type { SelectProps } from 'antd';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ExperimentOutlined, RobotOutlined, LineChartOutlined, FundOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

const { Title, Text, Paragraph } = Typography;

// 初始空选项列表
const initialModelOptions: SelectProps['options'] = [];
const initialActorOptions: SelectProps['options'] = [];

interface AnalysisModalProps {
  stock?: {
    code: string;
    name: string;
  };
}

const AnalysisPage: React.FC<AnalysisModalProps> = () => {
  const { code } = useParams<{ code: string }>();
  const [stock, setStock] = useState<{ code: string; name: string; }>({ code: '', name: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  
  const [modelOptions, setModelOptions] = useState<SelectProps['options']>(initialModelOptions);
  const [actorOptions, setActorOptions] = useState<SelectProps['options']>(initialActorOptions);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(true);

  // 为每个角色设置单独的模型选择状态
  const [selectedModel1, setSelectedModel1] = useState<string>('');
  const [selectedModel2, setSelectedModel2] = useState<string>('');
  const [selectedModel3, setSelectedModel3] = useState<string>('');
  const [selectedActor1, setSelectedActor1] = useState<string>('');
  const [selectedActor2, setSelectedActor2] = useState<string>('');
  const [selectedActor3, setSelectedActor3] = useState<string>('');
  
  // 综合结论模型选择
  const [conclusionModel, setConclusionModel] = useState<string>('');

  // 分析结果状态
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // EventSource 引用
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // 结果容器引用，用于自动滚动
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // 角色图标映射函数
  const getActorIcon = (actorName: string) => {
    if (actorName === '宏观策划师') return <LineChartOutlined />;
    if (actorName === '技术操盘手') return <RobotOutlined />;
    if (actorName === '风险管理师') return <FundOutlined />;
    return <ExperimentOutlined />;
  };
  
  // 获取模型和角色列表
  useEffect(() => {
    const fetchModelsAndRoles = async () => {
      try {
        setLoadingOptions(true);
        const response = await axios.get('http://localhost:8000/api/analysis/models');
        if (response.data) {
          // 设置模型列表
          if (response.data.models && response.data.models.length > 0) {
            setModelOptions(response.data.models);
            // 为每个角色设置默认模型
            setSelectedModel1(response.data.models[0].value);
            setSelectedModel2(response.data.models[0].value);
            setSelectedModel3(response.data.models[0].value);
          }

          // 设置角色列表
          if (response.data.roles && response.data.roles.length > 0) {
            // 添加图标到角色选项
            const rolesWithIcons = response.data.roles.map((role: any) => ({
              ...role,
              icon: getActorIcon(role.value)
            }));
            setActorOptions(rolesWithIcons);
            
            // 如果有至少3个角色,设置默认选中的角色
            if (response.data.roles.length >= 3) {
              setSelectedActor1(response.data.roles[0].value);
              setSelectedActor2(response.data.roles[1].value);
              setSelectedActor3(response.data.roles[2].value);
            }
          }
        }
      } catch (error) {
        console.error('获取模型和角色列表失败:', error);
        message.error('获取模型和角色列表失败');
        
        // 设置默认值
        setModelOptions([{
          value: 'deepseek/deepseek-chat:free',
          label: 'Deepseek V3'
        }]);
        setActorOptions([
          { value: '宏观策划师', label: '宏观策划师', icon: <LineChartOutlined /> },
          { value: '技术操盘手', label: '技术操盘手', icon: <RobotOutlined /> },
          { value: '风险管理师', label: '风险管理师', icon: <FundOutlined /> },
        ]);

        // 设置默认选择(为每个角色设置默认模型)
        setSelectedModel1('deepseek/deepseek-chat:free');
        setSelectedModel2('deepseek/deepseek-chat:free');
        setSelectedModel3('deepseek/deepseek-chat:free');
        setSelectedActor1('宏观策划师');
        setSelectedActor2('技术操盘手');
        setSelectedActor3('风险管理师');
      } finally {
        setLoadingOptions(false);
      }
    };
    
    fetchModelsAndRoles();
  }, []);
  
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
          // 如果API没有返回有效数据,使用URL中的code
          setStock({ code: code || '', name: '未知股票' });
          console.log('API未返回有效数据,使用URL中的code:', code);
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

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  // 自动滚动到最新消息
  useEffect(() => {
    if (chatContainerRef.current && chatMessages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // 分析处理函数
  const handleAnalyze = async () => {
    // 校验选择
    if (!selectedActor1 && !selectedActor2 && !selectedActor3) {
      message.error('请至少选择一个分析角色');
      return;
    }

    // 检查至少选择了一个模型
    if (!selectedModel1 && !selectedModel2 && !selectedModel3) {
      message.error('请至少选择一个模型');
      return;
    }

    try {
      // 重置分析状态
      setAnalyzing(true);
      setAnalysisResults([]);
      setChatMessages([]);
      setAnalysisStatus('loading');
      message.loading({ content: '正在分析中...', key: 'analysis', duration: 0 });

      // 准备选中的角色和模型
      const selectedActorsWithModels = [
        { actor: selectedActor1, model: selectedModel1 },
        { actor: selectedActor2, model: selectedModel2 },
        { actor: selectedActor3, model: selectedModel3 },
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
        setAnalyzing(false);
        return;
      }

      // 转换数据格式为后端期望的格式
      const requestData = {
        actors: selectedActorsWithModels.map(item => ({
          actor: item.actor,
          model: item.model
        }))
      };

      console.log('发送分析请求,数据:', requestData);

      // 添加用户请求到聊天记录
      const userRequestMessage = {
        type: 'user_request',
        content: `分析请求: ${stock.name} (${stock.code})`,
        timestamp: new Date().toISOString(),
        details: {
          stock: { code: stock.code, name: stock.name },
          actors: selectedActorsWithModels.map(item => {
            // 不显示conclusion_model
            if (item.actor === 'conclusion_model') {
              return {
                type: 'conclusion_model',
                model: item.model
              };
            }
            return {
              actor: item.actor,
              model: item.model
            };
          })
        }
      };
      
      setChatMessages(prev => [...prev, userRequestMessage]);

      // 关闭之前的事件源
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // 发送分析请求, 传递角色和模型数组
      await axios.post(`http://localhost:8000/api/analysis/${stock.code}`, requestData);

      // 将选中的角色和模型转换为查询字符串,用于SSE连接
      const actorsQueryString = encodeURIComponent(JSON.stringify(selectedActorsWithModels));
      
      // 创建新的事件源接收分析结果,使用POST发送的相同数据
      const eventSource = new EventSource(
        `http://localhost:8000/api/analysis/${stock.code}?actors=${actorsQueryString}`,
        { withCredentials: false }
      );

      eventSourceRef.current = eventSource;

      // 处理事件源消息
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('收到SSE消息:', data);

          // 添加到聊天消息列表
          setChatMessages(prev => [...prev, {
            ...data,
            timestamp: new Date().toISOString()
          }]);

          // 根据消息类型处理
          if (data.type === 'analysis' || data.type === 'conclusion') {
            // 添加分析结果
            setAnalysisResults(prev => [...prev, data]);
          } else if (data.type === 'error') {
            // 显示错误消息
            message.error(data.error || '分析过程发生错误');
            setAnalysisStatus('error');
          } else if (data.type === 'complete') {
            // 分析完成
            message.success({ content: '分析完成', key: 'analysis' });
            setAnalysisStatus('success');
            setAnalyzing(false);
            // 关闭事件源
            eventSource.close();
            eventSourceRef.current = null;
          }
        } catch (error) {
          console.error('解析SSE消息失败:', error);
        }
      };

      // 错误处理
      eventSource.onerror = (error) => {
        console.error('SSE连接错误:', error);
        message.error({ content: '分析连接出错', key: 'analysis' });
        setAnalysisStatus('error');
        setAnalyzing(false);
        eventSource.close();
        eventSourceRef.current = null;
      };

    } catch (error) {
      console.error('分析股票失败:', error);
      message.error({ content: '启动分析失败', key: 'analysis' });
      setAnalysisStatus('error');
      setAnalyzing(false);
    }
  };

  // 获取消息类型对应的颜色
  const getMessageColor = (type: string) => {
    switch (type) {
      case 'analysis': return '#1890ff';
      case 'conclusion': return '#52c41a';
      case 'info': return '#722ed1';
      case 'warning': return '#faad14';
      case 'error': return '#f5222d';
      case 'user_request': return '#096dd9';
      default: return '#8c8c8c';
    }
  };

  // 渲染聊天消息
  const renderChatMessage = (message: any, index: number) => {
    // 用户请求消息
    if (message.type === 'user_request') {
      return (
        <div 
          key={index} 
          style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            marginBottom: 16 
          }}
        >
          <div style={{ 
            maxWidth: '80%', 
            backgroundColor: '#e6f7ff', 
            padding: '12px 16px', 
            borderRadius: '8px 8px 0 8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
              {message.content}
            </div>
            <div style={{ fontSize: '13px' }}>
              <div>选择的角色和模型:</div>
              <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
                {message.details.actors.filter((a: any) => a.actor).map((actor: any, i: number) => (
                  <li key={i}>
                    {actor.actor}: {actor.model}
                  </li>
                ))}
              </ul>
              {message.details.actors.find((a: any) => a.type === 'conclusion_model') && (
                <div>
                  综合结论模型: {message.details.actors.find((a: any) => a.type === 'conclusion_model').model}
                </div>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4, textAlign: 'right' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <Avatar 
            style={{ marginLeft: 8, backgroundColor: '#1890ff' }} 
            icon={<UserOutlined />} 
          />
        </div>
      );
    }
    
    // 分析结果或结论
    if (message.type === 'analysis' || message.type === 'conclusion') {
      return (
        <div 
          key={index} 
          style={{ 
            display: 'flex', 
            justifyContent: 'flex-start', 
            marginBottom: 16 
          }}
        >
          <Avatar 
            style={{ 
              marginRight: 8, 
              backgroundColor: message.type === 'conclusion' ? '#52c41a' : '#1890ff' 
            }} 
            icon={message.type === 'conclusion' ? <ExperimentOutlined /> : getActorIcon(message.actor)} 
          />
          <div style={{ 
            maxWidth: '80%', 
            backgroundColor: '#fff', 
            padding: '12px 16px', 
            borderRadius: '8px 8px 8px 0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            border: `1px solid ${getMessageColor(message.type)}`
          }}>
            <div style={{ 
              marginBottom: 8, 
              fontWeight: 'bold',
              color: getMessageColor(message.type)
            }}>
              {message.actor}
              {message.stats && (
                <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                  (使用模型: {message.stats.model})
                </Text>
              )}
            </div>
            <div className="markdown-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4, textAlign: 'right' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      );
    }
    
    // 其他系统消息
    return (
      <div 
        key={index} 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: 12 
        }}
      >
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '6px 12px', 
          borderRadius: '16px',
          fontSize: '13px',
          color: getMessageColor(message.type),
          maxWidth: '90%'
        }}>
          {message.message || message.error || JSON.stringify(message)}
        </div>
      </div>
    );
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
        <Text type="secondary">选择分析角色和模型,获取专业的股票分析报告</Text>
      </div>

      <Card 
        title={<Title level={4}>分析配置</Title>} 
        bordered={false}
        style={{ marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
      >
        <Row gutter={[24, 24]}>
          <Col span={8}>
            <Card 
              title={
                <Space>
                  {selectedActor1 ? getActorIcon(selectedActor1) : <ExperimentOutlined />}
                  <span>角色 1</span>
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
                    value={selectedActor1}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => setSelectedActor1(value)}
                    options={actorOptions}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <Text strong>模型:</Text>
                  <Select
                    loading={loadingOptions}
                    value={selectedModel1}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => setSelectedModel1(value)}
                    options={modelOptions}
                  />
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={8}>
            <Card 
              title={
                <Space>
                  {selectedActor2 ? getActorIcon(selectedActor2) : <ExperimentOutlined />}
                  <span>角色 2</span>
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
                    value={selectedActor2}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => setSelectedActor2(value)}
                    options={actorOptions}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <Text strong>模型:</Text>
                  <Select
                    loading={loadingOptions}
                    value={selectedModel2}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => setSelectedModel2(value)}
                    options={modelOptions}
                  />
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={8}>
            <Card 
              title={
                <Space>
                  {selectedActor3 ? getActorIcon(selectedActor3) : <ExperimentOutlined />}
                  <span>角色 3</span>
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
                    value={selectedActor3}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => setSelectedActor3(value)}
                    options={actorOptions}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <Text strong>模型:</Text>
                  <Select
                    loading={loadingOptions}
                    value={selectedModel3}
                    style={{ width: '100%', marginTop: 8 }}
                    onChange={(value) => setSelectedModel3(value)}
                    options={modelOptions}
                  />
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
        
        {/* 综合结论模型选择 - 放在三个角色下面 */}
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
                onChange={(value) => setConclusionModel(value)}
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
            onClick={handleAnalyze}
            loading={analyzing}
            style={{ minWidth: 150 }}
            disabled={!stock.code || (!selectedActor1 && !selectedActor2 && !selectedActor3) || (!selectedModel1 && !selectedModel2 && !selectedModel3)}
          >
            {analyzing ? '分析中...' : '开始分析'}
          </Button>
        </div>
      </Card>

      {/* 聊天式实时消息显示 */}
      {chatMessages.length > 0 && (
        <Card 
          title={<Title level={4}>实时分析对话</Title>} 
          bordered={false}
          style={{ marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          extra={analysisStatus === 'loading' && <Spin />}
        >
          <div 
            ref={chatContainerRef}
            style={{ 
              height: '400px', 
              overflowY: 'auto', 
              padding: '16px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}
            className="chat-container"
          >
            {chatMessages.map((message, index) => renderChatMessage(message, index))}
          </div>
        </Card>
      )}

      {/* 最终分析结果展示 */}
      {analysisResults.length > 0 && (
        <Card 
          title={<Title level={4}>分析结果</Title>} 
          bordered={false}
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          <Timeline>
            {analysisResults.map((result, index) => (
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
      )}
      
      {/* 添加CSS样式 */}
      <style>{`
        .chat-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .chat-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .chat-container::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 3px;
        }
        
        .chat-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        
        .markdown-content ul, .markdown-content ol {
          padding-left: 20px;
          margin: 8px 0;
        }
        
        .markdown-content h1, .markdown-content h2, .markdown-content h3, 
        .markdown-content h4, .markdown-content h5, .markdown-content h6 {
          margin-top: 16px;
          margin-bottom: 8px;
        }
        
        .markdown-content p {
          margin: 8px 0;
        }
        
        .markdown-content blockquote {
          border-left: 4px solid #f0f0f0;
          padding-left: 16px;
          margin: 8px 0;
          color: #666;
        }
        
        .markdown-content code {
          background-color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: monospace;
        }
        
        .markdown-content pre {
          background-color: #f5f5f5;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};

export default AnalysisPage;
