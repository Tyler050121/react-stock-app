import { useState, useEffect, useRef } from 'react';
import { message } from 'antd';

interface EventSourceOptions {
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onOpen?: () => void;
}

/**
 * 自定义Hook用于管理EventSource连接
 * @param url SSE连接的URL
 * @param options 配置选项
 * @returns 包含EventSource实例和关闭连接的方法
 */
export const useEventSource = (url: string | null, options: EventSourceOptions = {}) => {
  const [connected, setConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 关闭SSE连接
  const closeEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
      console.log('SSE连接已关闭');
    }
  };

  // 设置SSE连接
  useEffect(() => {
    if (!url) {
      closeEventSource();
      return;
    }

    console.log(`尝试建立SSE连接: ${url}`);
    
    try {
      // 先关闭已存在的连接
      closeEventSource();
      
      // 创建新的SSE连接
      const newEventSource = new EventSource(url);
      
      // 处理连接打开
      newEventSource.onopen = () => {
        console.log('SSE连接已打开');
        setConnected(true);
        if (options.onOpen) {
          options.onOpen();
        }
      };
      
      // 处理消息接收
      newEventSource.onmessage = (event) => {
        try {
          // 检查是否为心跳消息
          if (event.data.startsWith(": heartbeat")) {
            console.log('收到心跳消息');
            return;
          }
          
          // 处理数据消息
          if (event.data.startsWith("data: ")) {
            // 移除"data: "前缀并解析JSON
            const jsonStr = event.data.substring(6);
            const data = JSON.parse(jsonStr);
            console.log('收到SSE消息:', data);
            
            if (options.onMessage) {
              options.onMessage(data);
            }
          }
        } catch (error) {
          console.error('解析SSE消息失败:', error);
        }
      };
      
      // 处理错误
      newEventSource.onerror = (error) => {
        console.error('SSE连接错误:', error);
        if (options.onError) {
          options.onError(error);
        } else {
          message.error('实时更新连接失败，请刷新页面');
        }
        closeEventSource();
      };
      
      // 保存EventSource实例
      eventSourceRef.current = newEventSource;
      
    } catch (error) {
      console.error('创建SSE连接失败:', error);
      message.error('建立实时更新连接失败');
      setConnected(false);
    }

    // 清理函数
    return () => {
      closeEventSource();
    };
  }, [url]);

  return { eventSource: eventSourceRef.current, connected, closeEventSource };
};