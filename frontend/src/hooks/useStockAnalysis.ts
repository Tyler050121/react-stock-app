import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { message } from 'antd';

export interface AnalysisActor {
  actor: string;
  model: string;
}

export interface AnalysisResult {
  type: string;
  actor: string;
  content: string;
  timestamp: string;
  stats?: {
    model: string;
  };
}

export interface ChatMessage {
  type: string;
  content?: string;
  message?: string;
  error?: string;
  actor?: string;
  timestamp: string;
  details?: any;
  stats?: {
    model: string;
  };
}

/**
 * 自定义Hook用于处理股票分析
 */
export const useStockAnalysis = (stockCode: string | undefined) => {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 开始分析
  const startAnalysis = async (selectedActorsWithModels: AnalysisActor[], stock: { code: string; name: string }) => {
    if (!stockCode || selectedActorsWithModels.length === 0) {
      message.error('请至少选择一个角色和对应的模型');
      return;
    }

    try {
      // 重置分析状态
      setAnalyzing(true);
      setAnalysisResults([]);
      setChatMessages([]);
      setAnalysisStatus('loading');
      message.loading({ content: '正在分析中...', key: 'analysis', duration: 0 });

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

      // 转换数据格式为后端期望的格式
      const requestData = {
        actors: selectedActorsWithModels.map(item => ({
          actor: item.actor,
          model: item.model
        }))
      };

      console.log('发送分析请求,数据:', requestData);

      // 发送分析请求, 传递角色和模型数组
      await axios.post(`http://localhost:8000/api/analysis/${stockCode}`, requestData);

      // 将选中的角色和模型转换为查询字符串,用于SSE连接
      const actorsQueryString = encodeURIComponent(JSON.stringify(selectedActorsWithModels));
      
      // 创建新的事件源接收分析结果,使用POST发送的相同数据
      const eventSource = new EventSource(
        `http://localhost:8000/api/analysis/${stockCode}?actors=${actorsQueryString}`,
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

  return {
    analysisResults,
    chatMessages,
    analysisStatus,
    analyzing,
    startAnalysis
  };
};