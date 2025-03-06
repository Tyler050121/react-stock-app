import { useState, useEffect } from 'react';
import { message } from 'antd';
import axios from 'axios';
import type { SelectProps } from 'antd';
import { getActorIcon } from '../components/Analysis/AnalysisConfig';

/**
 * 自定义Hook用于获取模型和角色列表
 */
export const useModelsAndRoles = () => {
  const [modelOptions, setModelOptions] = useState<SelectProps['options']>([]);
  const [actorOptions, setActorOptions] = useState<SelectProps['options']>([]);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(true);
  
  // 为每个角色设置单独的模型选择状态
  const [selectedModel1, setSelectedModel1] = useState<string>('');
  const [selectedModel2, setSelectedModel2] = useState<string>('');
  const [selectedModel3, setSelectedModel3] = useState<string>('');
  const [selectedActor1, setSelectedActor1] = useState<string>('');
  const [selectedActor2, setSelectedActor2] = useState<string>('');
  const [selectedActor3, setSelectedActor3] = useState<string>('');
  
  // 综合结论模型选择
  const [conclusionModel, setConclusionModel] = useState<string>('');

  // 获取模型和角色列表
  useEffect(() => {
    const fetchModelsAndRoles = async () => {
      try {
        setLoadingOptions(true);
        const response = await axios.get('http://localhost:8000/api/analysis/models');
        if (response.data) {
          // 设置模型列表
          if (response.data.models && response.data.models.length > 0) {
            setModelOptions(response.data.models);
            // 为每个角色设置默认模型
            setSelectedModel1(response.data.models[0].value);
            setSelectedModel2(response.data.models[0].value);
            setSelectedModel3(response.data.models[0].value);
          }

          // 设置角色列表
          if (response.data.roles && response.data.roles.length > 0) {
            // 添加图标到角色选项
            const rolesWithIcons = response.data.roles.map((role: any) => ({
              ...role,
              icon: getActorIcon(role.value)
            }));
            setActorOptions(rolesWithIcons);
            
            // 如果有至少3个角色，设置默认选中的角色
            if (response.data.roles.length >= 3) {
              setSelectedActor1(response.data.roles[0].value);
              setSelectedActor2(response.data.roles[1].value);
              setSelectedActor3(response.data.roles[2].value);
            }
          }
        }
      } catch (error) {
        console.error('获取模型和角色列表失败:', error);
        message.error('获取模型和角色列表失败');
        
        // 设置默认值
        setModelOptions([{
          value: 'deepseek/deepseek-chat:free',
          label: 'Deepseek V3'
        }]);
        setActorOptions([
          { value: '宏观策划师', label: '宏观策划师', icon: getActorIcon('宏观策划师') },
          { value: '技术操盘手', label: '技术操盘手', icon: getActorIcon('技术操盘手') },
          { value: '风险管理师', label: '风险管理师', icon: getActorIcon('风险管理师') },
        ]);

        // 设置默认选择(为每个角色设置默认模型)
        setSelectedModel1('deepseek/deepseek-chat:free');
        setSelectedModel2('deepseek/deepseek-chat:free');
        setSelectedModel3('deepseek/deepseek-chat:free');
        setSelectedActor1('宏观策划师');
        setSelectedActor2('技术操盘手');
        setSelectedActor3('风险管理师');
      } finally {
        setLoadingOptions(false);
      }
    };
    
    fetchModelsAndRoles();
  }, []);

  // 角色变化处理函数
  const handleActorChange = (index: number, value: string) => {
    switch (index) {
      case 0:
        setSelectedActor1(value);
        break;
      case 1:
        setSelectedActor2(value);
        break;
      case 2:
        setSelectedActor3(value);
        break;
    }
  };

  // 模型变化处理函数
  const handleModelChange = (index: number, value: string) => {
    switch (index) {
      case 0:
        setSelectedModel1(value);
        break;
      case 1:
        setSelectedModel2(value);
        break;
      case 2:
        setSelectedModel3(value);
        break;
    }
  };

  return {
    modelOptions,
    actorOptions,
    loadingOptions,
    selectedActors: [selectedActor1, selectedActor2, selectedActor3] as [string, string, string],
    selectedModels: [selectedModel1, selectedModel2, selectedModel3] as [string, string, string],
    conclusionModel,
    setConclusionModel,
    handleActorChange,
    handleModelChange
  };
};