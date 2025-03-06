import React from 'react';
import { Button } from 'antd';
import { ReloadOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

export interface StockData {
  code: string;
  name: string;
  market: string;
  industry: string; // 尽管不再使用，但保留以兼容后端返回的数据
  updated_at: string;
}

interface ColumnProps {
  refreshSingleStock: (stockCode: string) => Promise<void>;
}

/**
 * 创建股票列表表格的列定义
 */
export const createColumns = ({ refreshSingleStock }: ColumnProps): ColumnsType<StockData> => [
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