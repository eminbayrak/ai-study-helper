const ENV = {
  development: {
    API_URL: 'http://127.0.0.1:8000/api',
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