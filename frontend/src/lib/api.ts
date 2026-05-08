import axios from 'axios'

const API = axios.create({ baseURL: 'http://localhost:8000' })

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error?.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const getForecast = (inputSequence: number[][], city: string, model: string) =>
  API.post('/api/forecast/predict', { input_sequence: inputSequence, city, model })

export const getLiveForecast = (city: string, model: string) =>
  API.post('/api/forecast/live', { city, model })

export const getDemoForecast = () => API.get('/api/demo')

export const getCities = () => API.get('/api/forecast/cities')

export const getModels = () => API.get('/api/forecast/models')

export const getShapGlobal = (model: string) =>
  API.post('/api/xai/shap-global', { model, n_background_samples: 50 })

export const getShapLocal = (model: string, instanceIdx: number, inputSequence: number[][]) =>
  API.post('/api/xai/shap-local', { model, instance_idx: instanceIdx, input_sequence: inputSequence })

export const getLime = (model: string, inputSequence: number[][], featureNames: string[]) =>
  API.post('/api/xai/lime', { model, input_sequence: inputSequence, feature_names: featureNames })

export const queryRAG = (question: string, history: Array<{ role: string; content: string }>) =>
  API.post('/api/rag/query', { question, conversation_history: history })

export const getRagStatus = () => API.get('/api/rag/status')

export const getHealth = () => API.get('/health')

export default API
