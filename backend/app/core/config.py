"""
核心配置模块,用于加载和管理配置
"""
import os
import json
import logging
from typing import Dict, Any, Optional

# 日志配置
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'app.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class Config:
    """应用程序配置管理类"""
    
    def __init__(self):
        """初始化配置"""
        self.config_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config.json')
        self._config: Dict[str, Any] = {}
        self._load_config()
        
    def _load_config(self):
        """从配置文件加载配置"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                logger.info(f"已从 {self.config_file} 加载配置")
            else:
                logger.error(f"配置文件 {self.config_file} 不存在,请先创建配置文件")
        except Exception as e:
            logger.error(f"加载配置失败: {str(e)}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        keys = key.split('.')
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
            
    @property
    def database_url(self) -> str:
        """获取数据库URL"""
        return self.get('database.url')
        
    @property
    def cors_origins(self) -> list:
        """获取CORS设置"""
        return self.get('cors.origins', [])
        
    @property
    def openrouter_api_key(self) -> str:
        """获取OpenRouter API密钥"""
        return self.get('ai_service.openrouter_api_key')
        
    @property
    def site_url(self) -> str:
        """获取站点URL"""
        return self.get('ai_service.site_url')
        
    @property
    def site_name(self) -> str:
        """获取站点名称"""
        return self.get('ai_service.site_name')
        
    @property
    def available_models(self) -> list:
        """获取可用模型列表"""
        return self.get('available_models', [])
        
    @property
    def available_roles(self) -> list:
        """获取可用角色列表"""
        return self.get('available_roles', [])


# 创建单例实例
config = Config()
