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

export const queryRAG = (
  question: string,
  history: Array<{ role: string; content: string }>,
  apiKey?: string,
) =>
  API.post('/api/rag/query', {
    question,
    conversation_history: history,
    ...(apiKey ? { api_key: apiKey } : {}),
  })

export const getAccuracy = () => API.get('/api/forecast/accuracy')

export const getRagStatus = () => API.get('/api/rag/status')

export const getHealth = () => API.get('/health')

export const compareModels = (city: string, date?: string) =>
  API.post('/api/forecast/compare', { city, date })

export const getRangeForecast = (city: string, startDate: string, endDate: string) =>
  API.post('/api/forecast/range', { city, start_date: startDate, end_date: endDate })

export const getInsights = (city: string, month: number) =>
  API.post('/api/forecast/insights', { city, month })

export const compareInsights = (
  city1: string, month1: number, city2: string, month2: number,
) =>
  API.post('/api/forecast/compare-insights', { city1, month1, city2, month2 })

export const getWeeklyForecast = (city: string) =>
  API.get(`/api/forecast/weekly/${city}`)

export const getForecastHistory = () =>
  API.get('/api/forecast/history')

export const clearForecastHistory = () =>
  API.post('/api/forecast/history/clear')

export const getCurrentWeather = (city: string) =>
  API.get(`/api/weather/current/${city}`)

export const getWeatherForecast = (city: string) =>
  API.get(`/api/weather/forecast/${city}`)

export const getTips = (city: string) =>
  API.get(`/api/tips/${city}`)

export const getTipsFromShap = (featureImportances: Array<{feature: string, importance: number}>, city: string) =>
  API.post('/api/tips/from-shap', { feature_importances: featureImportances, city })

export default API
