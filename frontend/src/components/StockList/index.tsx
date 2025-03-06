import React, { useState, useEffect } from 'react';
import { Table, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ReloadOutlined } from '@ant-design/icons';
import { createColumns, StockData } from './columns';
import UpdateModal from './UpdateModal';

interface StockListProps {
  refreshTrigger: number;
}

const StockList: React.FC<StockListProps> = ({ refreshTrigger }) => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigate = useNavigate();

  // 初始化时获取股票列表
  useEffect(() => {
    fetchStocks();
  }, [refreshTrigger]); // 当refreshTrigger变化时，重新获取数据

  // 获取股票列表
  const fetchStocks = async () => {
    try {
      setLoading(true);
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

  // 创建表格列定义
  const columns = createColumns({ refreshSingleStock });

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
      
      {/* 数据更新模态框 */}
      <UpdateModal 
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onUpdateComplete={fetchStocks}
      />
    </Card>
  );
};

export default StockList;