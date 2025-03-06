import React, { useState, useEffect } from 'react';
import { Table, Card, message, Button, Modal, Progress, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import { ReloadOutlined, ExperimentOutlined } from '@ant-design/icons';
import AnalysisModal from './AnalysisModal';

interface StockData {
  code: string;
  name: string;
  market: string;
  industry: string; // 尽管不再使用,但保留以兼容后端返回的数据
  updated_at: string;
}

interface StockListProps {
  refreshTrigger: number;
}

interface CrawlerProgress {
  current: number;
  total: number;
  percentage: number;
}

const StockList: React.FC<StockListProps> = ({ refreshTrigger }) => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [progress, setProgress] = useState<CrawlerProgress>({ current: 0, total: 0, percentage: 0 });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [stockCount, setStockCount] = useState<number>(10); // 默认股票获取数量
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);

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
      const newEventSource = new EventSource(`http://localhost:8000/api/crawler/sse/${taskId}`);
      
      // 处理连接打开
      newEventSource.onopen = () => {
        console.log('SSE连接已打开');
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
                fetchStocks();
                // 显示完成消息后延迟关闭,让用户有时间看到完成状态
                setTimeout(() => {
                  setIsModalVisible(false);
                  closeEventSource();
                }, 3000); // 延长到3秒,让用户看得更清楚
              }
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

  useEffect(() => {
    fetchStocks();
  }, [refreshTrigger]); // 当refreshTrigger变化时,重新获取数据

    useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, []);

  const fetchStocks = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/stocks');
      setStocks(response.data);
    } catch (error) {
      message.error('获取股票列表失败');
      console.error('获取股票列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新单支股票数据
  const refreshSingleStock = async (stockCode: string) => {
    try {
      message.loading({ content: '正在更新...', key: stockCode });
      // 发起API请求更新单支股票
      await axios.get(`http://localhost:8000/api/stocks/${stockCode}/refresh`);
      message.success({ content: '更新成功', key: stockCode });
      // 重新获取所有股票数据以更新列表
      fetchStocks();
    } catch (error) {
      message.error({ content: '更新失败', key: stockCode });
      console.error('更新单支股票失败:', error);
    }
  };

  const columns: ColumnsType<StockData> = [
    {
      title: '股票代码',
      dataIndex: 'code',
      key: 'code',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: '股票名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '市场',
      dataIndex: 'market',
      key: 'market',
      filters: [
        { text: '上证', value: 'SH' },
        { text: '深证', value: 'SZ' },
      ],
      onFilter: (value, record) => record.market === value,
    },
    // 删除行业列
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: '25%',
      render: (text: string, record: StockData) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <span>{new Date(text).toLocaleString('zh-CN')}</span>
          <ReloadOutlined
            style={{ cursor: 'pointer', color: '#1890ff', marginLeft: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              refreshSingleStock(record.code);
            }}
            title="刷新此股票数据"
          />
        </div>
      ),
    },
    {
      title: <div style={{ textAlign: 'center' }}>AI分析</div>,
      key: 'ai_analysis',
      width: '10%',
      render: (_: any, record: StockData) => (
        <div style={{ textAlign: 'center' }}>
            <Button
              icon={<ExperimentOutlined style={{ fontSize: '20px', color: '#1890ff' }} />}
              onClick={(e) => {
                e.stopPropagation();
                // 跳转到分析页面
                window.location.href = `/stock/${record.code}/analysis/select`;
                console.log('AI分析按钮点击', record); // 添加调试信息
              }}
              type="text"
            />
        </div>
      ),
    },
  ];

 return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{marginRight: '10px'}}>股票列表</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => {
              setIsModalVisible(true);
              setProgress({ current: 0, total: 0, percentage: 0 });
            }}
          >
            <span style={{ color: '#1890ff', fontSize: '12px' }}>更新数据</span>
            <ReloadOutlined style={{ marginLeft: '4px', color: '#1890ff', fontSize: '12px' }} />
          </div>
        </div>
      }
      bordered={false}
    >
      <Table
        columns={columns}
        dataSource={stocks}
        rowKey="code"
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/stock/${record.code}`),
          style: { cursor: 'pointer' }
        })}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
      />
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

    </Card>
  );
};

export default StockList;
