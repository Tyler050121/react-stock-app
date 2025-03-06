import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Layout } from 'antd';
import StockList from './components/StockList';
import StockDetail from './components/StockDetail';
import Navbar from './components/Navbar';
import AnalysisPage from './components/AnalysisModal';
import './App.css';

const { Header, Content } = Layout;

const App: React.FC = () => {
  // 添加刷新触发器状态
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  // 刷新股票列表的函数
  const refreshStocks = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  return (
    <Router>
      <Layout className="layout" style={{ minHeight: '100vh' }}>
        <Header style={{ position: 'fixed', zIndex: 1, width: '100%', padding: 0 }}>
          <Navbar onDataUpdated={refreshStocks} />
        </Header>
        <Content style={{ padding: '0 50px', marginTop: 64 }}>
          <div style={{ background: '#fff', padding: 24, minHeight: 380 }}>
            <Routes>
              <Route path="/" element={<StockList refreshTrigger={refreshTrigger} />} />
              <Route path="/stock/:code" element={<StockDetail />} />
              <Route path="/stock/:code/analysis/select" element={<AnalysisPage stock={{ code: '', name: '' }} />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;
