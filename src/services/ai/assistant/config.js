/**
 * AI 助手服务配置
 * 模型列表与分类服务共享，统一从 classifier/config 导入
 */

// 统一使用 classifier 的模型配置
export {
  CLASSIFIER_MODELS as ASSISTANT_MODELS,
  ASSISTANT_CONFIG,
  CLASSIFIER_CONFIG,
  SPEED_LEVELS,
  ACCURACY_LEVELS,
  COST_LEVELS,
  getModelList,
  getModelByKey,
  getRecommendedModel
} from '../classifier/config'
