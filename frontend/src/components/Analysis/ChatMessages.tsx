import React, { useRef, useEffect, useState } from 'react';
import { Card, Spin, Typography, Avatar, Button } from 'antd';
import { UserOutlined, ExperimentOutlined, ApiOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../hooks/useStockAnalysis';
import { getActorIcon } from './AnalysisConfig';

const { Title } = Typography;

interface ChatMessagesProps {
  messages: ChatMessage[];
  loading: boolean;
}

/**
 * 获取消息类型对应的颜色
 */
const getMessageColor = (type: string) => {
  switch (type) {
    case 'analysis': return '#1890ff';
    case 'conclusion': return '#52c41a';
    case 'api_request': return '#fa8c16'; // API请求消息的颜色
    case 'info': return '#722ed1';
    case 'warning': return '#faad14';
    case 'error': return '#f5222d';
    case 'user_request': return '#096dd9';
    default: return '#8c8c8c';
  }
};

/**
 * 聊天消息组件
 */
const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, loading }) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // 记录每条消息是否展开API详情
  const [expandedApiDetails, setExpandedApiDetails] = useState<{[key: number]: boolean}>({});
  
  // 切换API详情展开状态
  const toggleApiDetails = (index: number) => {
    setExpandedApiDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  // 自动滚动到最新消息
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // 如果没有消息，不显示组件
  if (messages.length === 0) {
    return null;
  }

  /**
   * 渲染单个聊天消息
   */
  const renderChatMessage = (message: ChatMessage, index: number) => {
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
                {message.details?.actors.filter((a: any) => a.actor).map((actor: any, i: number) => (
                  <li key={i}>
                    {actor.actor}: {actor.model}
                  </li>
                ))}
              </ul>
              {message.details?.actors.find((a: any) => a.type === 'conclusion_model') && (
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
    
    // API请求消息 - 修改为右侧显示
    if (message.type === 'api_request') {
      const isExpanded = !!expandedApiDetails[index];
      
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
            backgroundColor: '#fff', 
            padding: '12px 16px', 
            borderRadius: '8px 8px 0 8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            border: `1px solid ${getMessageColor('api_request')}`
          }}>
            <div style={{ 
              marginBottom: 8, 
              fontWeight: 'bold',
              color: getMessageColor('api_request'),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{message.message || 'API请求'}</span>
              <Button 
                size="small"
                type="text"
                onClick={() => toggleApiDetails(index)}
              >
                {isExpanded ? '收起' : '查看详情'}
              </Button>
            </div>
            
            {isExpanded && message.details && (
              <div style={{ fontSize: '13px' }}>
                <div>使用模型: {message.details.model || '未指定'}</div>
                {message.details.content && (
                  <>
                    <div style={{ marginTop: 10, marginBottom: 4 }}>提示词内容:</div>
                    <div 
                      style={{ 
                        backgroundColor: '#fafafa', 
                        padding: 10, 
                        borderRadius: 4,
                        border: '1px solid #f0f0f0',
                        maxHeight: '200px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    >
                      {message.details.content}
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4, textAlign: 'right' }}>
              {message.details?.timestamp ? new Date(message.details.timestamp).toLocaleTimeString() : new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <Avatar 
            style={{ 
              marginLeft: 8, 
              backgroundColor: '#fa8c16' 
            }} 
            icon={<ApiOutlined />} 
          />
        </div>
      );
    }
    
    // 分析结果或结论
    if (message.type === 'analysis' || message.type === 'conclusion') {
      // 添加安全检查
      const hasApiDetails = Boolean(
        message.api_details && 
        message.api_details.payload && 
        message.api_details.payload.content
      );
      const isExpanded = !!expandedApiDetails[index];
      
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
            icon={message.type === 'conclusion' ? <ExperimentOutlined /> : getActorIcon(message.actor || '')} 
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
              color: getMessageColor(message.type),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                {message.actor}
                {message.stats && (
                  <span style={{ fontSize: '12px', marginLeft: 8, color: '#8c8c8c' }}>
                    (使用模型: {message.stats.model})
                  </span>
                )}
              </span>
              
              {/* 添加查看API详情按钮 - 安全检查 */}
              {hasApiDetails && (
                <Button 
                  size="small"
                  type="text"
                  onClick={() => toggleApiDetails(index)}
                >
                  {isExpanded ? '收起API' : '查看API'}
                </Button>
              )}
            </div>
            
            {/* API详情显示区域 - 安全检查 */}
            {isExpanded && hasApiDetails && (
              <div style={{ fontSize: '13px', marginBottom: 10 }}>
                <div>选择的角色和模型:</div>
                <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
                  <li>
                    {message.actor}: {message.stats?.model || '未指定'}
                  </li>
                </ul>
                <div style={{ marginTop: 10, marginBottom: 4 }}>提示词内容:</div>
                <div 
                  style={{ 
                    backgroundColor: '#fafafa', 
                    padding: 10, 
                    borderRadius: 4,
                    border: '1px solid #f0f0f0',
                    maxHeight: '200px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                >
                  {message.api_details?.payload?.content || '无提示词内容'}
                </div>
              </div>
            )}
            
            <div className="markdown-content">
              <ReactMarkdown>{message.content || ''}</ReactMarkdown>
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

  return (
    <Card 
      title={<Title level={4}>实时分析对话</Title>} 
      bordered={false}
      style={{ marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
      extra={loading && <Spin />}
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
        {messages.map((message, index) => renderChatMessage(message, index))}
      </div>
      
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
    </Card>
  );
};

export default ChatMessages;