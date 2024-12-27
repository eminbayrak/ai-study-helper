import { Platform } from 'react-native';

const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api';
  } else if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  } else {
    return 'http://localhost:8000/api';  // default for iOS and others
  }
};

const ENV = {
  development: {
    API_URL: getApiUrl(),
  },
  production: {
    API_URL: 'https://your-production-api.com/api',
  },
  staging: {
    API_URL: 'https://your-staging-api.com/api',
  }
};

const getEnvVars = (env = (process.env.NODE_ENV as 'development' | 'production' | 'staging' | 'test') || 'development') => {
  if (env === 'production') {
    return ENV.production;
  } else if (env === 'staging') {
    return ENV.staging;
  } else {
    return ENV.development;
  }
};

export default getEnvVars(); 