import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Menu, Layout, Modal, Progress, message, Select, Space } from 'antd';
import { SearchOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Search } = Input;

interface CrawlerProgress {
  current: number;
  total: number;
  percentage: number;
}

interface NavbarProps {
  onDataUpdated: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onDataUpdated }) => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState('home');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [progress, setProgress] = useState<CrawlerProgress>({ current: 0, total: 0, percentage: 0 });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [stockCount, setStockCount] = useState<number>(10); // 默认股票获取数量

  // 关闭SSE连接
  const closeEventSource = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      console.log('SSE连接已关闭');
    }
  };
  
  // 股票数量变化处理函数
  const handleStockCountChange = (value: number) => {
    setStockCount(value);
  };

  // 设置SSE连接
  const setupEventSource = (taskId: string) => {
    console.log(`尝试建立SSE连接: ${taskId}`);
    
    try {
      // 先关闭已存在的连接
      closeEventSource();
      
      // 创建新的SSE连接
      const newEventSource = new EventSource(`http://localhost:8000/api/sse/crawler/${taskId}`);
      
      // 处理连接打开
      newEventSource.onopen = () => {
        console.log('SSE连接已打开');
      };
      
      // 处理消息接收
      newEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('收到SSE消息:', data);
          
          if (data.error) {
            message.error(data.error);
            setIsModalVisible(false);
            closeEventSource();
          } else {
            setProgress({
              current: data.current || 0,
              total: data.total || 0,
              percentage: data.percentage || 0
            });
            
            if (data.status === "completed") {
              message.success('数据更新完成');
              // 调用回调函数,刷新股票列表
              onDataUpdated();
              // 显示完成消息后延迟关闭,让用户有时间看到完成状态
              setTimeout(() => {
                setIsModalVisible(false);
                closeEventSource();
              }, 3000); // 延长到3秒,让用户看得更清楚
            }
          }
        } catch (error) {
          console.error('解析SSE消息失败:', error);
        }
      };
      
      // 处理错误
      newEventSource.onerror = (error) => {
        console.error('SSE连接错误:', error);
        message.error('实时更新连接失败,请刷新页面');
        closeEventSource();
      };
      
      // 保存EventSource实例
      setEventSource(newEventSource);
      
    } catch (error) {
      console.error('创建SSE连接失败:', error);
      message.error('建立实时更新连接失败');
      setIsModalVisible(false);
    }
  };

  const startCrawler = async () => {
    try {
      // 防止点击开始更新后进度条弹窗闪烁,先设置等待状态
      setProgress({ current: 0, total: 0, percentage: 0 }); // 修改为符合用户期望的初始值
      
      // 启动爬虫任务,传递股票数量参数
      console.log(`准备开始更新,股票数量: ${stockCount}`);
      
      // 在URL上添加参数,确保参数被传递到后端
      // 由于后端API可能没有定义接收参数,我们尝试两种方式传递
      const response = await axios.post(
        `http://localhost:8000/api/crawler/start?stock_count=${stockCount}`, 
        { stock_count: stockCount } // 同时在body中也传递参数
      );
      
      const { task_id } = response.data;
      setTaskId(task_id);
      
      console.log(`爬虫任务已启动: ${task_id}, 股票数量: ${stockCount}`);
      
      // 使用更长的等待时间,确保后端任务初始化完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 不再设置硬编码的进度,直接通过SSE接收进度
      
      // 建立SSE连接
      setupEventSource(task_id);
    } catch (error) {
      console.error('启动爬虫失败:', error);
      message.error('启动爬虫失败');
      setIsModalVisible(false);
      setProgress({ current: 0, total: 0, percentage: 0 });
    }
  };

  const handleClick = (e: { key: string }) => {
    setCurrent(e.key);
    if (e.key === 'home') {
      navigate('/');
    } else if (e.key === 'crawler') {
      // 只显示弹窗,不立即开始爬虫任务
      setIsModalVisible(true);
      setProgress({ current: 0, total: 0, percentage: 0 });
    }
  };

  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, []);

const onSearch = async (value: string) => {
    if (value) {
      try {
        await axios.get(`http://localhost:8000/api/stocks/${value}/financial`);
        navigate(`/stock/${value}`);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          message.error('该股票不存在');
        } else {
          message.error('获取股票详情失败');
          console.error('获取股票详情失败:', error);
        }
      }
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[current]}
          onClick={handleClick}
          style={{ flex: 1 }}
        >
          <Menu.Item
            key="home"
            icon={<HomeOutlined />}
            className="custom-menu-item"
            style={{
              background: 'none',
              backgroundColor: 'transparent'
            }}
          >
            首页
          </Menu.Item>
          
        </Menu>
        <Search
          placeholder="输入股票代码"
          onSearch={onSearch}
          style={{
            width: 200,
            margin: '0 24px'
          }}
        />
      </div>
      <Modal
        title="数据更新"
        open={isModalVisible}
        footer={null}
        closable={progress.percentage === 0} // 只有在未开始任务时允许关闭
        maskClosable={progress.percentage === 0}
        onCancel={() => setIsModalVisible(false)}
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
                    // 先改变按钮状态,避免多次点击
                    const button = e.currentTarget;
                    button.disabled = true;
                    button.innerText = '更新中...';
                    button.style.background = '#b7b7b7';
                    
                    // 先显示弹窗,等状态更新完成后再开始爬虫任务
                    setProgress({ current: 0, total: 0, percentage: 0 });
                    
                    // 延迟一小段时间后修改状态,避免闪烁
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
    </>
  );
};

export default Navbar;
