import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Navbar from './components/Navbar';
import { createRoutes } from './routes';
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
              {createRoutes({ refreshTrigger }).map((route) => (
                <Route key={route.path} {...route} />
              ))}
            </Routes>
          </div>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;
