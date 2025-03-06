import React from 'react';
import StockList from './components/StockList/index';
import StockDetail from './components/StockDetail/index';
import AnalysisPage from './components/Analysis/index';

interface RouteConfig {
  path: string;
  element: React.ReactNode;
  caseSensitive?: boolean;
  index?: boolean;
}

interface RouteProps {
  refreshTrigger: number;
}

export const createRoutes = ({ refreshTrigger }: RouteProps): RouteConfig[] => [
  {
    path: '/',
    element: <StockList refreshTrigger={refreshTrigger} />,
  },
  {
    path: '/stock/:code',
    element: <StockDetail />,
  },
  {
    path: '/stock/:code/analysis/select',
    element: <AnalysisPage stock={{ code: '', name: '' }} />,
  },
];