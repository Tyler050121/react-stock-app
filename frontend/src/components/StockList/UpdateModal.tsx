import React, { useState } from 'react';
import { Modal, Progress, Select, message } from 'antd';
import axios from 'axios';
import { useEventSource } from '../../hooks/useEventSource';

interface UpdateModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUpdateComplete: () => void;
}

interface CrawlerProgress {
  current: number;
  total: number;
  percentage: number;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ isVisible, onClose, onUpdateComplete }) => {
  const [stockCount, setStockCount] = useState<number>(10); // 默认股票获取数量
  const [progress, setProgress] = useState<CrawlerProgress>({ current: 0, total: 0, percentage: 0 });
  const [taskId, setTaskId] = useState<string | null>(null);

  // 使用自定义Hook处理SSE连接
  const { closeEventSource } = useEventSource(
    taskId ? `http://localhost:8000/api/crawler/sse/${taskId}` : null,
    {
      onMessage: (data) => {
        if (data.error) {
          message.error(data.error);
          onClose();
          closeEventSource();
        } else {
          setProgress({
            current: data.current || 0,
            total: data.total || 0,
            percentage: data.percentage || 0
          });
          
          if (data.status === "completed") {
            message.success('数据更新完成');
            // 调用回调函数，刷新股票列表
            onUpdateComplete();
            // 显示完成消息后延迟关闭，让用户有时间看到完成状态
            setTimeout(() => {
              onClose();
              closeEventSource();
            }, 3000); // 延长到3秒，让用户看得更清楚
          }
        }
      },
      onError: () => {
        message.error('实时更新连接失败，请刷新页面');
        onClose();
      }
    }
  );

  // 股票数量变化处理函数
  const handleStockCountChange = (value: number) => {
    setStockCount(value);
  };

  // 开始爬虫任务
  const startCrawler = async () => {
    try {
      // 防止点击开始更新后进度条弹窗闪烁，先设置等待状态
      setProgress({ current: 0, total: 0, percentage: 0 });
      
      // 启动爬虫任务，传递股票数量参数
      console.log(`准备开始更新，股票数量: ${stockCount}`);
      
      // 在URL上添加参数，确保参数被传递到后端
      const response = await axios.post(
        `http://localhost:8000/api/crawler/start?stock_count=${stockCount}`, 
        { stock_count: stockCount } // 同时在body中也传递参数
      );
      
      const { task_id } = response.data;
      setTaskId(task_id);
      
      console.log(`爬虫任务已启动: ${task_id}, 股票数量: ${stockCount}`);
      
      // 使用更长的等待时间，确保后端任务初始化完成
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('启动爬虫失败:', error);
      message.error('启动爬虫失败');
      onClose();
      setProgress({ current: 0, total: 0, percentage: 0 });
    }
  };

  return (
    <Modal
      title="数据更新"
      open={isVisible}
      footer={null}
      closable={progress.percentage === 0} // 只有在未开始任务时允许关闭
      maskClosable={progress.percentage === 0}
      onCancel={onClose}
      destroyOnClose
      width={400}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        {progress.percentage === 0 ? (
          // 未开始更新时显示选择界面
          <div>
            <h3 style={{ marginBottom: 20 }}>请选择更新股票数量</h3>
            <Select
              value={stockCount}
              onChange={handleStockCountChange}
              style={{ width: 200, marginBottom: 20 }}
              options={[
                { value: 5, label: '5只股票' },
                { value: 10, label: '10只股票' },
                { value: 20, label: '20只股票' },
                { value: 50, label: '50只股票' },
              ]}
            />
            <div style={{ marginTop: 20 }}>
              <button
                onClick={(e) => {
                  e.preventDefault(); // 阻止默认行为
                  // 先改变按钮状态，避免多次点击
                  const button = e.currentTarget;
                  button.disabled = true;
                  button.innerText = '更新中...';
                  button.style.background = '#b7b7b7';
                  
                  // 先显示弹窗，等状态更新完成后再开始爬虫任务
                  setProgress({ current: 0, total: 0, percentage: 0 });
                  
                  // 延迟一小段时间后修改状态，避免闪烁
                  setTimeout(() => {
                    startCrawler();
                  }, 300);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                开始更新
              </button>
            </div>
          </div>
        ) : (
          // 更新进行中显示进度
          <>
            <h3 style={{ marginBottom: 20 }}>正在更新股票数据</h3>
            <Progress
              percent={progress.percentage}
              status={progress.percentage < 100 ? "active" : "success"}
              format={() => `${progress.current || 0}/${progress.total || 0}`}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              strokeWidth={12}
            />
            <p style={{ marginTop: 15, color: '#666' }}>
              {progress.current === 0 ? '准备中...' : `已处理: ${progress.current}个 / 共${progress.total}个`}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default UpdateModal;